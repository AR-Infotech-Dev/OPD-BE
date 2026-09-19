import * as CommonModel from "#shared/models/common.model.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { validate } from "#shared/utils/request.validator.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { buildTablePayload } from "#shared/utils/tablePayload.js";
import Joi from "joi";
import { env } from "#config/env.js";
import { DB_PREFIX, query } from "#config/database.js";
import { getUserCompanyId, isSuperAdminRole } from "#shared/utils/role.utils.js";
// TENANT SYNC 
import { syncToTenant } from "#shared/utils/tenantSync.js";

const MODULE_TABLE = "medicines";

const sanitizeSqlPayload = (payload = {}) =>
  Object.entries(payload).reduce((data, [key, value]) => {
    data[key] = value === undefined ? null : value;
    return data;
  }, {});

// ======================================================
// VALIDATION SCHEMA
// ======================================================
const medicineSchema = Joi.object({
  medicine_id: Joi.number().integer().positive().allow(null),
  clinic_id: Joi.number().integer().positive().allow(null),
  medicine_code: Joi.string().required(),
  medicine_name: Joi.string().required(),
  generic_name: Joi.string().required(),
  strength: Joi.string().allow("", null),
  dosage_form: Joi.string().required(),
  route: Joi.string().required(),
  default_instruction: Joi.string().allow( ),
  status: Joi.string().default("active"),
});

// ======================================================
// LIST USERS
// ======================================================
const default_columns = {};

const custom_columns = {};

export const list = async (req, res) => {
  try {
    const {
      page = 1,
      searchText = "",
      getAll = "N",
      order_by = "created_date",
      order = "DESC",
      filters,
    } = req.body;

    // const limit = 10;
    const limit = env.perPage;

    const currentPage = Number(page) || 1;
    const start = (currentPage - 1) * limit;

    const other1 = {
      orderBy : order_by,
      order,
      searchColumns: ["t.medicine_code", "t.medicine_name", "t.generic_name", "t.dosage_form", "t.route",],
    };

    const filterData = prepareFilterData({
      filters,
      searchText,
      other: other1,
      default_columns,
      custom_columns,
    });

    
    const { select, where, values, join, other } = filterData;
    const total = await CommonModel.getCountsByParameter({
      table: MODULE_TABLE,
      where,
      values,
      join,
      other,
    });

    const totalPages = Math.ceil(total / limit);

    let end = start + limit;
    if (end > total) end = total;

    let data = [];

    if (getAll === "Y") {
      data = await CommonModel.GetMasterListDetails({
        select,
        table: MODULE_TABLE,
        where,
        values,
        join,
        other,
      });
    } else {
      data = await CommonModel.GetMasterListDetails({
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
        data,
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
// ======================================================
// CREATE / UPDATE / GET SINGLE
// ======================================================
export const getMedicineDetails = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const { id: medicine_id = null } = req.params;

    const body = await buildTablePayload(MODULE_TABLE, req.body);

    delete body.alive_data;
    delete body.created_by;
    delete body.created_date;
    delete body.modified_by;
    delete body.modified_date;

    let data = {};
    if (method !== "GET") {
      const result = validate(medicineSchema, body);

      if (!result.isValid) {
        return failureResponse(res, {
          code: 2004,
          httpStatus: 404,
          message: result.message.replace(/"/g, ""),
        });
      }

      data = result.value;

    }

    switch (method) {
      case "PUT": {


        data = await buildTablePayload(MODULE_TABLE, {
          ...data,
          created_by: req.user.user_id,
          created_date: toMysqlDateTime(),
        });

        const result = await CommonModel.saveMasterDetails({
          table: MODULE_TABLE,
          data,
        });
        await syncToTenant(data.company_id || req.user.company_id, async () => {
          await CommonModel.saveMasterDetails({
            table: MODULE_TABLE,
            data: {
              ...data,
              medicine_id: result.insertId,
            },
          });
        });

        return successResponse(res, {
          code: 1001,
          httpStatus: 201,
          data: {
            insertId: result.insertId,
          },
        });
      }

      case "POST": {
        if (!medicine_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
            message: "Medicine ID is required",
          });
        }

        data = await buildTablePayload(MODULE_TABLE, {
          ...data,
          modified_by: req.user?.user_id,
          modified_date: toMysqlDateTime(),
        });

        await CommonModel.updateMasterDetails({
          table: MODULE_TABLE,
          data,
          where: { medicine_id },
        });

        await syncToTenant(req.user.company_id, async () => {
          const details = await CommonModel.getMasterDetails(
            MODULE_TABLE,
            "*",
            { medicine_id }
          );

          if (!details.length) {
            await CommonModel.saveMasterDetails({
              table: MODULE_TABLE,
              data: {
                ...data,
                medicine_id,
              },
            });
          } else {
            await CommonModel.updateMasterDetails({
              table: MODULE_TABLE,
              data,
              where: { medicine_id },
            });
          }
        });

        return successResponse(res, {
          code: 1002,
          httpStatus: 200,
          message: "Medicine updated successfully",
          data: [],
        });
      }

      case "GET": {
        if (!medicine_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const details = await CommonModel.getMasterDetails(
          MODULE_TABLE,
          "*",
          { medicine_id }
        );

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
// CHANGE STATUS / DELETE
// ======================================================
export const changeStatus = async (req, res) => {
  try {
    const { action = "", ids = [], status = "active" } = req.body;

    switch (action.trim().toLowerCase()) {
      case "delete":
        await CommonModel.deleteMasterDetails({
          table: MODULE_TABLE,
          where: { medicine_id: ids },
        });

        // tenant lookup sync
        await syncToTenant(req.user.company_id, async () => {
          await CommonModel.deleteMasterDetails({
            table: MODULE_TABLE,
            where: { medicine_id: ids },
          });
        });

        return successResponse(res, {
          code: 1003,
          httpStatus: 200,
          data: [],
        });

      case "changestatus":
        await CommonModel.changeMasterStatus(
          MODULE_TABLE,
          status,
          ids
        );

        // tenant lookup sync
        await syncToTenant(req.user.company_id, async () => {
          await CommonModel.changeMasterStatus(
            MODULE_TABLE,
            status,
            ids
          );
        });

        return successResponse(res, {
          code: 1002,
          httpStatus: 200,
          data: [],
        });

      default:
        return failureResponse(res, {
          code: 2000,
          httpStatus: 400,
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

export const getProfile = async (req, res) => {
  try {
    const adminID = req.user?.adminID;

    if (!adminID) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message: "User not found",
      });
    }

    const rows = await CommonModel.GetMasterListDetails({
      select: `
        t.medicine_id,
        t.clinic_id,
        t.medicine_code,
        t.medicine_name,
        t.generic_name,
        t.strength,
        t.dosage_form,
        t.route,
        t.default_instruction,
        t.status,
        
      `,
      table: MODULE_TABLE,
      where: ["t.medicine_id = ?"],
      values: [medicine_id],
      join: [],
    });

    if (!rows.length) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message: "User not found",
      });
    }

    return successResponse(res, {
      code: 1004,
      httpStatus: 200,
      data: {
        data: rows[0],
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












