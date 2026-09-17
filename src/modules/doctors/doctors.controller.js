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
// import { getdoctorCompanyId, isSuperAdminRole } from "#shared/utils/role.utils.js";
// // TENANT SYNC 
// import { syncToTenant } from "#shared/utils/tenantSync.js";

const MODULE_TABLE = "doctors";
// ======================================================
// VALIDATION SCHEMA
// ==============================================
// 

========
const doctorSchema = Joi.object({
  doctor_id: Joi.number().integer().positive().allow(null),
  clinic_id: Joi.number().integer().positive().allow(null),
  department_id: Joi.number().integer().positive().allow(null),
  user_id: Joi.number().integer().positive().allow(null),
  doctor_code: Joi.string().max(20).allow("", null),
  doctor_name: Joi.string().max(150).required(),
  display_name: Joi.string().max(150).allow("", null),
  mobile_no: Joi.string().max(15).required(),
  email: Joi.string().email().max(150).allow("", null),
  qualification: Joi.string().max(255).allow("", null),
  specialization: Joi.string().max(255).allow("", null),
  registration_no: Joi.string().max(100).allow("", null),
  consultation_fee: Joi.number().precision(2).min(0).allow(null),
  followup_fee: Joi.number().precision(2).min(0).allow(null),
  profile_image: Joi.string().max(500).allow("", null),
  signature_image: Joi.string().max(500).allow("", null),
  status: Joi.string().valid("active", "inactive", "delete").default("active"),

  created_by: Joi.number().integer().allow(null),
  created_date: Joi.date().allow(null),
  modified_by: Joi.number().integer().allow(null),
  modified_date: Joi.date().allow(null),
});

// ======================================================
// LIST doctorS
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
      searchColumns: ["t.doctor_code", "t.doctor_name", "t.display_name", "t.specialization", "t.registration_no"],
    };

    const filterData = prepareFilterData({
      filters,
      searchText,
      other: other1,
      default_columns,
      custom_columns,
    });

    const { select, where, values, join, other } = filterData;
    // const scopedCompanyId = isSuperAdminRole(req.doctor?.role_slug)
    //   ? null
    //   : getdoctorClinic_id(req.doctor);

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
export const getDoctorDetails = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const { id: doctor_id = null } = req.params;

    const body = await buildTablePayload(MODULE_TABLE, req.body);

    let data = {};
    if (method !== "GET") {
      const result = validate(doctorSchema, body);

      if (!result.isValid) {
        return failureResponse(res, {
          code: 2004,
          httpStatus: 404,
          message: result.message.replace(/"/g, ""),
        });
      }

      data = result.value;

      const duplicateCheck = await validateDoctorDetails(
        data.doctor_name,
        // data.full_name,
        req.user?.adminID
      );

      if (duplicateCheck) {
        return failureResponse(res, duplicateCheck);
      }
    }

    switch (method) {
      case "PUT": {

        const doctorCode = `DR${Date.now()}`;

        data = await buildTablePayload(MODULE_TABLE, {
          ...data,
          doctor_code: doctorCode,
          created_by: req.user.adminID,
          created_date: toMysqlDateTime(),
        });

        const result = await CommonModel.saveMasterDetails({
          table: MODULE_TABLE,
          data,
        });

        // // Get doctor prefix from clinic_master
        // const clinicDetails = await CommonModel.getMasterDetails(
        //   "clinic_master",
        //   "doctor_prefix",
        //   { clinic_id: data.clinic_id }
        // );

        // const prefix = clinicDetails[0]?.doctor_prefix;

        // if (!prefix) {
        //   return failureResponse(res, {
        //     code: 2004,
        //     httpStatus: 400,
        //     message: "doctor prefix is not configured for this clinic",
        //   });
        // }

        // // Generate doctor code
        // const doctorCode = `${prefix}${Date.now()}`;

        // data = await buildTablePayload(MODULE_TABLE, {
        //   ...data,
        //   doctor_code: doctorCode,
        //   created_by: req.user.adminID,
        //   created_date: toMysqlDateTime(),
        // });

        // const result = await CommonModel.saveMasterDetails({
        //   table: MODULE_TABLE,
        //   data,
        // });

        return successResponse(res, {
          code: 1001,
          httpStatus: 201,
          data: {
            insertId: result.insertId,
            doctor_code: doctorCode,
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
          where: { doctor_id },
        });

        return successResponse(res, {
          code: 1002,
          httpStatus: 200,
          data: [],
        });
      }

      case "GET": {
        if (!doctor_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const details = await CommonModel.getMasterDetails(
          MODULE_TABLE,
          "*",
          { doctor_id }
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
    const { action = "", status = "active", doctor_id, } = req.body;

    switch (action.trim().toLowerCase()) {
      case "delete":
        await CommonModel.deleteMasterDetails({
          table: MODULE_TABLE,
          where: { doctor_id },
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
//     const adminID = req.doctor?.adminID;
//     const status = req.body?.status;

//     if (!adminID) {
//       return failureResponse(res, {
//         code: 2004,
//         httpStatus: 404,
//         message: "Doctor not found",
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
//     await syncToTenant(req.doctor.company_id, async () => {
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
//         message: "Doctor not found",
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
const validateDoctorDetails = async (
  doctor_name,
  // full_name,
  adminID = null
) => {
  // if (mobile_no) {
  //   const mobile_noExist = await CommonModel.getMasterDetails(
  //     MODULE_TABLE,
  //     "*",
  //     { mobile_no }
  //   );

  //   if (
  //     mobile_noExist.length &&
  //     Number(mobile_noExist[0].adminID) !== Number(adminID)
  //   ) {
  //     return {
  //       code: 2002,
  //       httpStatus: 409,
  //       message: "Mobile number already exists",
  //     };
  //   }
  // }

  if (doctor_name) {
    const doctor_nameExist = await CommonModel.getMasterDetails(
      MODULE_TABLE,
      "*",
      { doctor_name }
    );

    if (
      doctor_nameExist.length &&
      Number(doctor_nameExist[0].adminID) !== Number(adminID)
    ) {
      return {
        code: 2003,
        httpStatus: 409,
        message: "Doctor name already exists",
      };
    }
  }

  return null;
};




