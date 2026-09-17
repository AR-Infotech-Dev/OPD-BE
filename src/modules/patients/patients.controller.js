import * as CommonModel from "#shared/models/common.model.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { validate } from "#shared/utils/request.validator.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { buildTablePayload } from "#shared/utils/tablePayload.js";
import Joi from "joi";
import { env } from "#config/env.js";
// import { hashPassword, verifyPassword } from "#shared/utils/password.js";
// import { DB_PREFIX, query } from "#config/database.js";
// import { getPatientCompanyId, isSuperAdminRole } from "#shared/utils/role.utils.js";
// // TENANT SYNC 
// import { syncToTenant } from "#shared/utils/tenantSync.js";

const MODULE_TABLE = "patients";
// ======================================================
// VALIDATION SCHEMA
// ======================================================
const patientSchema = Joi.object({
  patient_id: Joi.number().integer().positive().allow(null),
  clinic_id: Joi.number().integer().positive().allow(null),
  patient_code: Joi.string().max(30).allow("", null),
  first_name: Joi.string().max(100).required(),
  middle_name: Joi.string().max(100).allow("", null),
  last_name: Joi.string().max(100).required(),
  full_name: Joi.string().max(255).required(),
  mobile_no: Joi.string().max(15).required(),
  alternate_mobile_no: Joi.string().max(15).allow("", null),
  email: Joi.string().email().max(150).allow("", null),
  date_of_birth: Joi.date().allow(null),
  age: Joi.number().integer().min(0).allow(null),
  age_unit: Joi.string().valid("years", "months", "days").default("years"),
  gender: Joi.string().valid("male", "female", "other").default("male"),
  blood_group: Joi.string().valid("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-").allow("", null),
  marital_status: Joi.string().max(20).allow("", null),
  address: Joi.string().allow("", null),
  city: Joi.string().max(100).allow("", null),
  state: Joi.string().max(100).allow("", null),
  pincode: Joi.string().max(10).allow("", null),
  allergies: Joi.string().allow("", null),
  status: Joi.string().valid("active", "inactive", "delete").default("active"),
  created_by: Joi.number().integer().allow(null),
  created_date: Joi.date().allow(null),
  modified_by: Joi.number().integer().allow(null),
  modified_date: Joi.date().allow(null),
});

// ======================================================
// LIST PATIENTS
// ======================================================
const default_columns = {
  clinic_id: {
    table: "clinic_master",
    alias: "dc",
    column: "clinic_name",
    key2: "clinic_id",
    select: "",
  },
};

const custom_columns = {
  modified_by: {
    table: "admin",
    alias: "am",
    column: "name",
    key2: "adminID",
    select: "",
  },
  created_by: {
    table: "admin",
    alias: "ad",
    column: "name",
    key2: "adminID",
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
      clinic_id = null,
      filters,
    } = req.body;

    // const limit = 10;
    const limit = env.perPage;

    const currentPage = Number(page) || 1;
    const start = (currentPage - 1) * limit;

    const other1 = {
      orderBy,
      order,
      searchColumns: ["t.patient_code", "t.first_name", "t.last_name", "t.full_name", "t.mobile_no"],
    };

    const filterData = prepareFilterData({
      filters,
      searchText,
      other: other1,
      default_columns,
      custom_columns,
    });

    const { select, where, values, join, other } = filterData;
    // const scopedCompanyId = isSuperAdminRole(req.patient?.role_slug)
    //   ? null
    //   : getpatientClinic_id(req.patient);

    // if (scopedCompanyId) {
    //   where.push("t.company_id = ?");
    //   values.push(scopedCompanyId);
    // }
    // // HIDE SUPER ADMIN FROM LIST
    // where.push("r.slug != ?");
    // values.push('super_admin');

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
export const getPatientDetails = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const { id: patient_id = null } = req.params;

    const body = await buildTablePayload(MODULE_TABLE, req.body);

    let data = {};
    if (method !== "GET") {
      const result = validate(patientSchema, body);

      if (!result.isValid) {
        return failureResponse(res, {
          code: 2004,
          httpStatus: 404,
          message: result.message.replace(/"/g, ""),
        });
      }

      data = result.value;

      const duplicateCheck = await validatePatientDetails(
        data.mobile_no,
        // data.full_name,
        req.user?.adminID
      );

      if (duplicateCheck) {
        return failureResponse(res, duplicateCheck);
      }
    }

    switch (method) {
      case "PUT": {

        // const patientCode = `PAT${Date.now()}`;

        // data = await buildTablePayload(MODULE_TABLE, {
        //   ...data,
        //   patient_code: patientCode,
        //   created_by: req.user.adminID,
        //   created_date: toMysqlDateTime(),
        // });

        // const result = await CommonModel.saveMasterDetails({
        //   table: MODULE_TABLE,
        //   data,
        // });

        // Get patient prefix from clinic_master
        const clinicDetails = await CommonModel.getMasterDetails(
          "clinic_master",
          "patient_prefix",
          { clinic_id: data.clinic_id }
        );

        const prefix = clinicDetails[0]?.patient_prefix;

        if (!prefix) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 400,
            message: "Patient prefix is not configured for this clinic",
          });
        }

        // Generate patient code
        const patientCode = `${prefix}${Date.now()}`;

        data = await buildTablePayload(MODULE_TABLE, {
          ...data,
          patient_code: patientCode,
          created_by: req.user.adminID,
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
            patient_code: patientCode,
          },
        });
      }

      case "POST": {

        data = await buildTablePayload(MODULE_TABLE, {
          ...data,
          modified_by: req.user.adminID,
          modified_date: toMysqlDateTime(),
        });


        await CommonModel.updateMasterDetails({
          table: MODULE_TABLE,
          data,
          where: { patient_id },
        });

        return successResponse(res, {
          code: 1002,
          httpStatus: 200,
          data: [],
        });
      }

      case "GET": {
        if (!patient_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const details = await CommonModel.getMasterDetails(
          MODULE_TABLE,
          "*",
          { patient_id }
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
          where: { patient_id: ids },
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

// export const updateStatus = async (req, res) => {
//   try {
//     const adminID = req.patient?.adminID;
//     const status = req.body?.status;

//     if (!adminID) {
//       return failureResponse(res, {
//         code: 2004,
//         httpStatus: 404,
//         message: "Patient not found",
//       });
//     }

//     if (status === undefined || status === "") {
//       return failureResponse(res, {
//         code: 2001,
//         httpStatus: 400,
//         message: "Status are required",
//       });
//     }

//     const result = await CommonModel.updateMasterDetails({
//       table: MODULE_TABLE,
//       data,
//       where: { adminID },
//     });

//     // tenant lookup sync
//     await syncToTenant(req.patient.company_id, async () => {
//       await CommonModel.updateMasterDetails({
//         table: MODULE_TABLE,
//         data,
//         where: { adminID },
//       });
//     });

//     if (!result.affectedRows) {
//       return failureResponse(res, {
//         code: 2004,
//         httpStatus: 404,
//         message: "Patient not found",
//       });
//     }

//     return successResponse(res, {
//       code: 1002,
//       httpStatus: 200,
//       message: "Status updated successfully",
//       data: [],
//     });
//   } catch (error) {
//     return failureResponse(res, {
//       code: 2008,
//       httpStatus: 500,
//       message: error.message,
//     });
//   }
// }

// ======================================================
// UNIQUE CHECK
// ======================================================
const validatePatientDetails = async (
  mobile_no,
  // full_name,
  adminID = null
) => {
  if (mobile_no) {
    const mobile_noExist = await CommonModel.getMasterDetails(
      MODULE_TABLE,
      "*",
      { mobile_no }
    );

    if (
      mobile_noExist.length &&
      Number(mobile_noExist[0].adminID) !== Number(adminID)
    ) {
      return {
        code: 2002,
        httpStatus: 409,
        message: "Mobile number already exists",
      };
    }
  }

  // if (patientName) {
  //   const patientExist = await CommonModel.getMasterDetails(
  //     MODULE_TABLE,
  //     "*",
  //     { full_name }
  //   );

  //   if (
  //     patientExist.length &&
  //     Number(patientExist[0].adminID) !== Number(adminID)
  //   ) {
  //     return {
  //       code: 2003,
  //       httpStatus: 409,
  //       message: "Patient name already exists",
  //     };
  //   }
  // }

  return null;
};




