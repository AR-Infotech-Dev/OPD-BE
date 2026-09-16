import * as CommonModel from "#shared/models/common.model.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { validateBody } from "#shared/utils/bodyValidator.js";
import { clearClinicMailerCache } from "#shared/utils/email.js";
import { clinicValidationRules } from "./clinic.utils.js";
import { env } from "#config/env.js";
import path from "node:path";
import fs from "fs";
// TENANT SYNC 
import { syncToTenant } from "#shared/utils/tenantSync.js";

const MODULE_TABLE = "clinic_master";
const default_columns = {};

const custom_columns = {
  created_by: {
    table: "admin",
    alias: "ad",
    column: "name",
    key2: "adminID",
    select: "",
  },
  modified_by: {
    table: "admin",
    alias: "am",
    column: "name",
    key2: "adminID",
    select: "",
  },
};

// ======================================================
// LIST COMPANIES
// ======================================================
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
export const uploadClinicLogo = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message: "Clinic logo file is required",
      });
    }

    const clinicId = Number(req.params.id || req.body.clinic_id);
    if (!clinicId) return failureResponse(res, { code: 2001, httpStatus: 400, message: "Save the clinic before uploading its logo" });
    const extension = getLogoExtension(req.file);
    const fileName = `logo-${Date.now()}${extension}`;
    const relativePath = `/images/clinic/${clinicId}/${fileName}`;
    const assetDirectory = ensureClinicAssetDir(clinicId);
    const absolutePath = path.join(assetDirectory, fileName);

    fs.writeFileSync(absolutePath, req.file.buffer);

    if (clinicId) {
      const result = await CommonModel.updateMasterDetails({
        table: MODULE_TABLE,
        data: {
          email_logo: relativePath,
          modified_by: req.user.adminID,
          modified_date: toMysqlDateTime(),
        },
        where: { clinic_id: clinicId },
      });

      await syncToTenant(clinicId, async () => {
        await CommonModel.updateMasterDetails({
          table: MODULE_TABLE,
          data: {
            email_logo: relativePath,
            modified_by: req.user.adminID,
            modified_date: toMysqlDateTime(),
          },
          where: { clinic_id: clinicId },
        });
      });

      if (!result.affectedRows) {
        return failureResponse(res, {
          code: 2004,
          httpStatus: 404,
          message: "Clinic not found",
        });
      }

      clearClinicMailerCache(clinicId);
    }

    return successResponse(res, {
      code: 1002,
      httpStatus: 200,
      message: "Clinic logo uploaded successfully",
      data: {
        data: {
          email_logo: relativePath,
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
export const removeClinicLogo = async (req, res) => {
  try {
    const clinicId = req.params.id;
    const clinic = await CommonModel.getMasterDetails(MODULE_TABLE, "email_logo", {
      clinic_id: clinicId,
    });

    if (!clinic?.length) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message: "Clinic not found",
      });
    }

    const logoPath = clinic[0].email_logo;

    // Delete physical file if exists
    if (logoPath) {
      const absolutePath = path.resolve(process.cwd(), logoPath.replace(/^\/+/, ""));

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    // Update DB
    await CommonModel.updateMasterDetails({
      table: MODULE_TABLE,
      data: {
        email_logo: null,
        modified_by: req.user.adminID,
        modified_date: toMysqlDateTime(),
      },
      where: { clinic_id: clinicId },
    });

    await syncToTenant(clinicId, async () => {
      await CommonModel.updateMasterDetails({
        table: MODULE_TABLE,
        data: {
          email_logo: null,
          modified_by: req.user.adminID,
          modified_date: toMysqlDateTime(),
        },
        where: { clinic_id: clinicId },
      });

    });

    // Clear mail cache
    clearClinicMailerCache(clinicId);

    return successResponse(res, {
      code: 1003,
      httpStatus: 200,
      message: "Clinic logo removed successfully",
      data: {},
    });

  } catch (error) {
    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};
// ======================================================
// CREATE / UPDATE / GET SINGLE
// ======================================================
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
        data.created_by = req.user.adminID;
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
        data.modified_by = req.user.adminID;
        data.modified_date = toMysqlDateTime();
        console.log('data : ',data);
        
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

// ======================================================
// DELETE
// ======================================================
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
