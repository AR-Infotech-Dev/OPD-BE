import * as CommonModel from "#shared/models/common.model.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { validateBody } from "#shared/utils/bodyValidator.js";
import { clearClinicMailerCache } from "#shared/utils/email.js";
import { clinicValidationRules, ensureClinicAssetDir } from "./clinic.utils.js";
import { env } from "#config/env.js";
import path from "node:path";
import fs from "fs";
import { getImageExtension } from "#shared/utils/files.js";

const MODULE_TABLE = "clinic_master";
const default_columns = {};

const custom_columns = {
  created_by: {
    table: "users",
    alias: "ad",
    column: "name",
    key2: "user_id",
    select: "",
  },
  modified_by: {
    table: "users",
    alias: "am",
    column: "name",
    key2: "user_id",
    select: "",
  },
};
export const list = async (req, res) => {
  try {
    const {
      page = 1,
      searchText = "",
      getAll = "N",
      orderBy = "created_date",
      order = "DESC",
      filters = [],
    } = req.body;

    const limit = env.perPage;
    // const limit = 10;
    const currentPage = Number(page) || 1;
    const start = (currentPage - 1) * limit;

    const filterData = prepareFilterData({
      filters,
      searchText,
      other: {
        orderBy,
        order,
        searchColumns: [
          "clinic_name",
          "sender_email",
          "cc_email",
          "sender_name",
          "mobile_number",
          "pan",
        ],
      },
      default_columns,
      custom_columns,
    });

    const { select, where, values, join, other } = filterData;
    other.freeTextSearch = searchText;
    other.searchColumns = [
      "t.clinic_name",
      "t.sender_email",
      "t.cc_email",
      "t.sender_name",
      "t.mobile_number",
      "t.pan",
    ];

    const total = await CommonModel.getCountsByParameter({
      table: MODULE_TABLE,
      where,
      values,
      join,
      other,
    });

    const totalPages = Math.ceil(total / limit);
    const end = Math.min(start + limit, total);

    let clinicDetails = [];
    if (getAll === "Y") {
      clinicDetails = await CommonModel.GetMasterListDetails({
        select,
        table: MODULE_TABLE,
        where,
        values,
        join,
        other,
      });
    } else {
      clinicDetails = await CommonModel.GetMasterListDetails({
        select,
        table: MODULE_TABLE,
        where,
        values,
        limit,
        start,
        join,
        other,
      });
    }

    return successResponse(res, {
      code: 1004,
      httpStatus: 200,
      data: {
        data: clinicDetails,
        pagination: {
          total,
          page: currentPage,
          limit,
          totalPages,
          start: total === 0 ? 0 : start + 1,
          end,
        },
      },
    });
  } catch (error) {
    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};
export const getClinicDetails = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const { id: clinic_id = null } = req.params;

    switch (method) {
      case "PUT": {
        const validation = validateBody(req.body, clinicValidationRules);
        if (!validation.isValid) {
          return failureResponse(res, {
            code: 2001,
            httpStatus: 400,
            message: validation.message,
          });
        }
        const data = validation.data;

        if (data.google_review_enabled === "y" && !data.google_review_link?.trim()) {
          return failureResponse(res, {
            code: 2001,
            httpStatus: 400,
            message: "Google Review Link is required",
          });
        }

        delete data.clinic_id;
        data.created_by = req.user.user_id;
        data.created_date = toMysqlDateTime();
        data.status = data.status || "active";
        const result = await CommonModel.saveMasterDetails({
          table: MODULE_TABLE,
          data,
        });
        await syncToTenant(clinic_id, async () => {
          await CommonModel.saveMasterDetails({
            table: MODULE_TABLE,
            data,
          });
        });
        clearClinicMailerCache(result.insertId);
        return successResponse(res, {
          code: 1001,
          httpStatus: 201,
          data: {
            insertId: result.insertId,
          },
        });
      }
      case "POST": {
        if (!clinic_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }
        const validation = validateBody(req.body, clinicValidationRules);
        if (!validation.isValid) {
          return failureResponse(res, {
            code: 2001,
            httpStatus: 400,
            message: validation.message,
          });
        }
        const data = validation.data;

        delete data.clinic_id;
        delete data.created_by;
        delete data.created_date;
        data.modified_by = req.user.user_id;
        data.modified_date = toMysqlDateTime();

        const result = await CommonModel.updateMasterDetails({
          table: MODULE_TABLE,
          data,
          where: { clinic_id },
        });

        if (!result.affectedRows) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }
        // clearClinicMailerCache(clinic_id);
        return successResponse(res, {
          code: 1002,
          httpStatus: 200,
          data: [],
        });
      }

      case "GET": {
        if (!clinic_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const details = await CommonModel.getMasterDetails(MODULE_TABLE, "*", {
          clinic_id,
        });

        if (!details.length) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        return successResponse(res, {
          code: 1004,
          httpStatus: 200,
          data: {
            data: details[0],
          },
        });
      }

      default:
        return failureResponse(res, {
          code: 2000,
          httpStatus: 405,
        });
    }
  } catch (error) {
    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};
export const changeStatus = async (req, res) => {
  try {
    const { action = "", ids = [] } = req.body;

    if (action.trim().toLowerCase() !== "delete") {
      return failureResponse(res, {
        code: 2000,
        httpStatus: 400,
        message: "Invalid action",
      });
    }

    if (!Array.isArray(ids) || !ids.length) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message: "ids are required",
      });
    }

    await CommonModel.deleteMasterDetails({
      table: MODULE_TABLE,
      where: { clinic_id: ids },
    });

    return successResponse(res, {
      code: 1003,
      httpStatus: 200,
      data: [],
    });
  } catch (error) {
    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};
export const uploadClinicLogo = async (req, res) => {

  try {
    const clinic_id = Number(req.params.id);
    if (!clinic_id || !req.file?.buffer) {
      return failureResponse(res, { code: 2001, httpStatus: 400, message: "Clinic logo image are required" });
    }

    const clinics = await CommonModel.getMasterDetails(MODULE_TABLE, "clinic_logo", { clinic_id });
    if (!clinics.length) {
      return failureResponse(res, { code: 2004, httpStatus: 404, message: "Clinic not found" });
    }

    const assetDirectory = ensureClinicAssetDir(clinic_id);
    const extension = getImageExtension(req.file);
    const fileName = `logo-${Date.now()}${extension}`;
    const relativePath = `/images/clinic/${clinic_id}/${fileName}`;
    fs.writeFileSync(path.join(assetDirectory, fileName), req.file.buffer);

    const previousPath = clinics[0].clinic_logo;
    if (previousPath) {
      const previousFile = path.resolve(process.cwd(), previousPath.replace(/^\/+/, ""));
      if (fs.existsSync(previousFile)) fs.unlinkSync(previousFile);
    }

    const updateData = { clinic_logo: relativePath, modified_by: req.user.user_id, modified_date: toMysqlDateTime() };
    await CommonModel.updateMasterDetails({ table: MODULE_TABLE, data: updateData, where: { clinic_id } });

    return successResponse(res, {
      code: 1002,
      httpStatus: 200,
      message: "Logo uploaded successfully",
      data: { data: { clinic_logo: relativePath } },
    });
  } catch (error) {
    return failureResponse(res, { code: 2008, httpStatus: 500, message: error.message });
  }
};
export const removeClinicLogo = async (req, res) => {
  try {
    const clinic_id = Number(req.params.id);
    const clinics = await CommonModel.getMasterDetails(MODULE_TABLE, "clinic_logo", { clinic_id });
    if (!clinics.length) {
      return failureResponse(res, { code: 2004, httpStatus: 404, message: "Clinic not found" });
    }

    const logoPath = clinics[0].clinic_logo;
    if (logoPath) {
      const logoFile = path.resolve(process.cwd(), logoPath.replace(/^\/+/, ""));
      if (fs.existsSync(logoFile)) fs.unlinkSync(logoFile);
    }

    const updateData = { clinic_logo: null, modified_by: req.user.user_id, modified_date: toMysqlDateTime() };
    await CommonModel.updateMasterDetails({ table: MODULE_TABLE, data: updateData, where: { clinic_id } });

    return successResponse(res, { code: 1003, httpStatus: 200, message: "Clinic logo removed successfully", data: {} });
  } catch (error) {
    return failureResponse(res, { code: 2008, httpStatus: 500, message: error.message });
  }
};