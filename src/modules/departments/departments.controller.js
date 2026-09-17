 import * as CommonModel from "#shared/models/common.model.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { validate } from "#shared/utils/request.validator.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { buildTablePayload } from "#shared/utils/tablePayload.js";
import Joi from "joi";

import { env } from "#config/env.js";

const MODULE_TABLE = "departments";

// ======================================================
// VALIDATION SCHEMA
// ======================================================
const departmentSchema = Joi.object({
  department_id: Joi.number().integer().positive().allow(null),

  clinic_id: Joi.number().integer().positive().allow(null).required(),

department_code: Joi.string().trim().max(20).required(),

department_name: Joi.string().trim().max(120).required(),

  description: Joi.string().allow("", null).optional(),

  status: Joi.string()
    .valid("active", "inactive", "delete")
    .default("active"),

  created_by: Joi.number().integer().allow(null).optional(),

  created_date: Joi.date().allow(null).optional(),

  modified_by: Joi.number().integer().allow(null).optional(),

  modified_date: Joi.date().allow(null),
});

// ======================================================
// LIST DEPARTMENTS
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
      order_by,
      orderBy: order_by,
      order,
      searchColumns: [ "department_code", "department_name", "description", ],
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
export const listNoAuth = async (req, res) => {
  try {
    const { searchText = "", getAll = "N", order_by = "created_date", order = "DESC",  } = req.body;
    const text = String(searchText).trim();
    const where = [];
    const values = [];
    const list = ` department_id, clinic_id, department_code, department_name, description, status, created_by, created_date, modified_by, modified_date `;
    const wherec = 'department_name'

    if (text) {
      where.push(`t.${wherec} LIKE ?`);
      values.push(`%${text}%`);
    }
    
    const result = await CommonModel.GetMasterListDetails({ select: list, table: MODULE_TABLE, where, values });

    return successResponse(res, {
      code: 1004,
      httpStatus: 200,
      data: {
        data: result,
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
export const getDepartmentDetails = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const { id: department_id = null } = req.params;

    const body = await buildTablePayload(MODULE_TABLE, req.body);

    

    let data = {};
    if (method !== "GET") {
      const result = validate(departmentSchema, body);

      if (!result.isValid) {
        return failureResponse(res, {
          code: 2004,
          httpStatus: 404,
          message: result.message.replace(/"/g, ""),
        });
      }

      data = result.value;
const validateDepartmentDetails = async (
  department_code,
  department_id = null
) => {
  if (department_code) {
    const departmentExist = await CommonModel.getMasterDetails(
      MODULE_TABLE,
      "*",
      { department_code }
    );

    if (
      departmentExist.length &&
      Number(departmentExist[0].department_id) !== Number(department_id)
    ) {
      return {
        code: 2002,
        httpStatus: 409,
        message: "Department code already exists",
      };
    }
  }
  return null;
};
 }
    switch (method) {
      case "PUT": {
        data = await buildTablePayload(MODULE_TABLE, {
          ...data,
          created_by: req.user.department_id,
          created_date: toMysqlDateTime(),
        });

        const result = await CommonModel.saveMasterDetails({
          table: MODULE_TABLE,
          data,
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
        if (!department_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        data = await buildTablePayload(MODULE_TABLE, {
          ...data,
          modified_by: req.user.department_id,
          modified_date: toMysqlDateTime(),
        });


        await CommonModel.updateMasterDetails({
          table: MODULE_TABLE,
          data,
          where: { department_id },
        });

        return successResponse(res, {
          code: 1002,
          httpStatus: 200,
          data: [],
        });
      }

      case "GET": {
        if (!department_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const details = await CommonModel.getMasterDetails(
          MODULE_TABLE,
          "*",
          { department_id }
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
          where: { department_id: ids },
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

// ======================================================
// UNIQUE CHECK
// ======================================================

  const validateDepartmentDetails = async (
  department_code,
  department_id = null
) => {
  if (department_code) {
    const departmentExist = await CommonModel.getMasterDetails(
      MODULE_TABLE,
      "*",
      { department_code }
    );

    if (
      departmentExist.length &&
      Number(departmentExist[0].department_id) !== Number(department_id)
    ) {
      return {
        code: 2002,
        httpStatus: 409,
        message: "Department code already exists",
      };
    }
  }

  return null;
};