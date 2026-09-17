import Joi from "joi";
import * as CommonModel from "#shared/models/common.model.js";
import { env } from "#config/env.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { validate } from "#shared/utils/request.validator.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { buildTablePayload } from "#shared/utils/tablePayload.js";
import { sendEmail } from "#shared/utils/email.js";
import { renderTemplate } from "#shared/utils/templateMaker.js";
import { hashPassword, verifyPassword } from "#shared/utils/password.js";
import { isSuperAdminRole } from "#shared/utils/role.utils.js";

const MODULE_TABLE = "users";

const sanitizeSqlPayload = (payload = {}) =>
  Object.entries(payload).reduce((data, [key, value]) => {
    data[key] = value === undefined ? null : value;
    return data;
  }, {});

const userSchema = Joi.object({
  user_id: Joi.number().integer().positive().allow(null),
  name: Joi.string().required(),
  default_company: Joi.number().allow(null).default(null),
  time_zone: Joi.string().allow("", null),
  company_id: Joi.number().integer().allow(null),

  is_approver: Joi.string().valid("yes", "no").default("no"),
  userName: Joi.string().required(),
  email: Joi.string().email().required(),
  isEmailSend: Joi.string().valid("yes", "no").default("no"),

  password: Joi.string().allow("", null),

  is_sys_user: Joi.string().valid("yes", "no").default("no"),
  roleID: Joi.number().integer().required(),

  address: Joi.string().allow("", null),
  google_location: Joi.string().allow("", null),

  contactNo: Joi.string().allow("", null),
  whatsappNo: Joi.string().allow("", null),

  dateOfBirth: Joi.date().allow(null),

  created_by: Joi.number().integer().allow(null),
  modified_by: Joi.number().integer().allow(null),

  status: Joi.string().default("active"),

  user_setting: Joi.any().allow(null),
  photo: Joi.string().allow("", null),

  latitude: Joi.string().allow("", null),
  longitude: Joi.string().allow("", null),
  country_code: Joi.string().allow("", null),

  otp: Joi.any().allow("", null),
  isVerified: Joi.string().valid("Y", "N").default("N"),

  lastLogin: Joi.date().allow(null),
  gfcmToken: Joi.string().allow("", null),

  is_google_sync: Joi.string().valid("y", "n").default("n"),
  is_one_drive_sync: Joi.string().valid("y", "n").default("n"),

  g_cal_token: Joi.string().allow("", null),
  one_drive_access_token: Joi.string().allow("", null),

  otp_exp_time: Joi.date().allow(null),
  active_session_id: Joi.string().allow(null),
  active_session_id_mob: Joi.string().allow(null),

  created_date: Joi.date().allow(null),
  modified_date: Joi.date().allow(null),
});
const default_columns = {
  roleID: {
    table: "user_role_master",
    alias: "r",
    column: "roleName",
    key2: "roleID",
    select: "",
  },
  company_id: {
    table: "company_master",
    alias: "dc",
    column: "company_name",
    key2: "company_id",
    select: "",
  },

};
const custom_columns = {
  modified_by: {
    table: "users",
    alias: "am",
    column: "name",
    key2: "user_id",
    select: "",
  },
  created_by: {
    table: "users",
    alias: "ad",
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
      company_id = null,
      filters,
    } = req.body;

    // const limit = 10;
    const limit = env.perPage;

    const currentPage = Number(page) || 1;
    const start = (currentPage - 1) * limit;

    const other1 = {
      orderBy,
      order,
      searchColumns: ["ad.name", "am.name", "r.roleName", 't.userName', "t.email"],
    };

    const filterData = prepareFilterData({
      filters,
      searchText,
      other: other1,
      default_columns,
      custom_columns,
    });

    const { select, where, values, join, other } = filterData;

    // HIDE SUPER ADMIN FROM LIST
    where.push("r.slug != ?");
    values.push('super_admin');

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
    const { searchText = "", getAll = "N", orderBy = "created_date", order = "DESC", company_id = null, } = req.body;
    const text = String(searchText).trim();
    const where = [];
    const values = [];
    const list = 'name, user_id, company_id, email, roleID ';
    const isCompanyWise = true;
    const wherec = 'name'

    if (text) {
      where.push(`t.${wherec} LIKE ?`);
      values.push(`%${text}%`);
    }
    if (!isSuperAdminRole(req.user?.role_slug)) {
      where.push(`t.company_id = ${req.user.company_id} `);
    }
    if (!isSuperAdminRole(req.user?.role_slug) && isCompanyWise === true) {
      where.push(`t.company_id = ${req.user.company_id} `);
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
export const getAdminDetails = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const { id: user_id = null } = req.params;

    const body = await buildTablePayload(MODULE_TABLE, req.body);

    delete body.alive_data;

    let data = {};
    if (method !== "GET") {
      const result = validate(userSchema, body);

      if (!result.isValid) {
        return failureResponse(res, {
          code: 2004,
          httpStatus: 404,
          message: result.message.replace(/"/g, ""),
        });
      }

      data = result.value;

      const duplicateCheck = await validateAdminDetails(
        data.email,
        data.userName,
        user_id
      );

      if (duplicateCheck) {
        return failureResponse(res, duplicateCheck);
      }
    }

    switch (method) {
      case "PUT": {
        const plainPassword = data.password;
        if (plainPassword) {
          data.password = await hashPassword(plainPassword);
        }

        data = await buildTablePayload(MODULE_TABLE, {
          ...data,
          created_by: req.user.user_id,
          created_date: toMysqlDateTime(),
        });

        const result = await CommonModel.saveMasterDetails({
          table: MODULE_TABLE,
          data,
        });

        const template = await renderTemplate("userAccountCredentials", "email", {
          name: data.name,
          userName: data.userName,
          password: plainPassword,
          appName: env.appName,
        });
        const { success, error } = await sendEmail({
          to: data.email,
          subject: "User Login Credentials",
          html: template,
          text: "",
          company_id: data.company_id || req.user.company_id,
        });
        if (!success) {
          return failureResponse(res, {
            code: 2008,
            httpStatus: 500,
            message: error,
          });
        }

        return successResponse(res, {
          code: 1001,
          httpStatus: 201,
          data: {
            insertId: result.insertId,
          },
        });
      }

      case "POST": {
        if (!user_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        if (data.password) {
          data.password = await hashPassword(data.password);
        } else {
          delete data.password;
        }

        if (data.userName) {
          delete data.password;
        }

        data = await buildTablePayload(MODULE_TABLE, {
          ...data,
          modified_by: req.user.user_id,
          modified_date: toMysqlDateTime(),
        });

        await CommonModel.updateMasterDetails({
          table: MODULE_TABLE,
          data,
          where: { user_id },
        });

        return successResponse(res, {
          code: 1002,
          httpStatus: 200,
          data: [],
        });
      }

      case "GET": {
        if (!user_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const details = await CommonModel.getMasterDetails(
          MODULE_TABLE,
          "*",
          { user_id }
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
export const changeStatus = async (req, res) => {
  try {
    const { action = "", ids = [], status = "active" } = req.body;

    switch (action.trim().toLowerCase()) {
      case "delete":
        await CommonModel.deleteMasterDetails({
          table: MODULE_TABLE,
          where: { user_id: ids },
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
export const updateStatus = async (req, res) => {
  try {
    const user_id = req.user?.user_id;
    const status = req.body?.status;

    if (!user_id) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message: "User not found",
      });
    }

    if (status === undefined || status === "") {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message: "Status are required",
      });
    }

    const data = sanitizeSqlPayload(await buildTablePayload(MODULE_TABLE, {
      status,
      modified_by: user_id,
      modified_date: toMysqlDateTime(),
    }));

    const result = await CommonModel.updateMasterDetails({
      table: MODULE_TABLE,
      data,
      where: { user_id },
    });
    if (!result.affectedRows) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message: "User not found",
      });
    }

    return successResponse(res, {
      code: 1002,
      httpStatus: 200,
      message: "Status updated successfully",
      data: [],
    });
  } catch (error) {
    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
}
export const getProfile = async (req, res) => {
  try {
    const user_id = req.user?.user_id;

    if (!user_id) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message: "User not found",
      });
    }

    const rows = await CommonModel.GetMasterListDetails({
      select: `
        t.user_id,
        t.name,
        t.email,
        t.dateOfBirth,
        t.userName,
        t.whatsappNo,
        t.time_zone,
        t.roleID,
        r.roleName AS roleName,
        r.slug AS role_slug,
        t.company_id,
        cm.company_name AS company_name,
        t.is_approver,
        t.google_location,
        t.status,
        t.address,
        t.contactNo,
        t.created_date,
        t.lastLogin
      `,
      table: MODULE_TABLE,
      where: ["t.user_id = ?"],
      values: [user_id],
      join: [
        {
          type: "LEFT JOIN",
          table: "user_role_master",
          alias: "r",
          key1: "roleID",
          key2: "roleID",
        },
        {
          type: "LEFT JOIN",
          table: "company_master",
          alias: "cm",
          key1: "company_id",
          key2: "company_id",
        },
      ],
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
export const updateProfile = async (req, res) => {
  try {
    const user_id = req.user?.user_id;
    if (!user_id) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message: "User not found",
      });
    }
    const editableData = {
      email: req.body.email,
      dateOfBirth: req.body.dateOfBirth,
      whatsappNo: req.body.whatsappNo ?? req.body.whatsapp_no ?? req.body.wa_no,
      address: req.body.address,
      userName: req.body.userName ?? req.body.user_name,
    };
    const profileSchema = Joi.object({
      email: Joi.string().email().required(),
      dateOfBirth: Joi.string().allow("", null),
      whatsappNo: Joi.string().allow("", null),
      address: Joi.string().allow("", null),
      userName: Joi.string().trim().min(3).required(),
    });
    const result = validate(profileSchema, editableData);
    if (!result.isValid) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message: result.message.replace(/"/g, ""),
      });
    }
    const duplicateCheck = await validateAdminDetails(
      result.value.email,
      result.value.userName,
      user_id
    );
    if (duplicateCheck) {
      return failureResponse(res, duplicateCheck);
    }
    await CommonModel.updateMasterDetails({
      table: MODULE_TABLE,
      data: {
        ...result.value,
        modified_by: user_id,
        modified_date: toMysqlDateTime(),
      },
      where: { user_id },
    });
    const updatedRows = await CommonModel.getMasterDetails(
      MODULE_TABLE,
      "*",
      { user_id }
    );
    return successResponse(res, {
      code: 1002,
      httpStatus: 200,
      message: "Profile updated successfully",
      data: {
        data: updatedRows[0] || result.value,
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
export const changeProfilePassword = async (req, res) => {
  try {
    const user_id = req.user?.user_id;
    const { current_password, currentPassword, new_password, newPassword, confirm_password, confirmPassword } = req.body;
    const current = current_password ?? currentPassword;
    const next = new_password ?? newPassword;
    const confirm = confirm_password ?? confirmPassword;

    if (!user_id) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message: "User not found",
      });
    }

    if (!current || !next || !confirm) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message: "Current password, new password and confirm password are required",
      });
    }

    if (String(next).length < 6) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message: "New password must be at least 6 characters",
      });
    }

    if (String(next) !== String(confirm)) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message: "New password and confirm password must match",
      });
    }

    const rows = await CommonModel.getMasterDetails(
      MODULE_TABLE,
      "user_id, password",
      { user_id }
    );
    const user = rows[0];

    if (!user) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message: "User not found",
      });
    }

    const isCurrentPasswordValid = await verifyPassword(current, user.password);

    if (!isCurrentPasswordValid) {
      return failureResponse(res, {
        code: 2002,
        httpStatus: 401,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await hashPassword(next);

    await CommonModel.updateMasterDetails({
      table: MODULE_TABLE,
      data: {
        password: hashedPassword,
        modified_by: user_id,
        modified_date: toMysqlDateTime(),
      },
      where: { user_id },
    });

    return successResponse(res, {
      code: 1002,
      httpStatus: 200,
      message: "Password changed successfully",
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
const validateAdminDetails = async (
  email,
  userName,
  user_id = null
) => {
  if (email) {
    const emailExist = await CommonModel.getMasterDetails(
      MODULE_TABLE,
      "*",
      { email }
    );

    if (
      emailExist.length &&
      Number(emailExist[0].user_id) !== Number(user_id)
    ) {
      return {
        code: 2002,
        httpStatus: 409,
        message: "Email already exists",
      };
    }
  }

  if (userName) {
    const userExist = await CommonModel.getMasterDetails(
      MODULE_TABLE,
      "*",
      { userName }
    );

    if (
      userExist.length &&
      Number(userExist[0].user_id) !== Number(user_id)
    ) {
      return {
        code: 2003,
        httpStatus: 409,
        message: "Username already exists",
      };
    }
  }

  return null;
};
export const getLoginAccess = async ({ mode = "create", data = {}, user_id = null, createdBy = null, }) => {
  try {
    const { name, email, userName, password, mobile_no, clinic_id, roleID, reference_module, reference_id, } = data;
    // =========================
    // CREATE
    // =========================
    if (mode === "create") {
      const duplicateCheck = await validateAdminDetails(email, userName);
      if (duplicateCheck) {
        return {
          success: false,
          ...duplicateCheck,
        };
      }

      if (!password) {
        return {
          success: false,
          code: 2001,
          httpStatus: 400,
          message: "Password is required",
        };
      }
      const hashedPassword = await hashPassword(password);
      const loginData = await buildTablePayload(MODULE_TABLE, { name, email, userName, password: hashedPassword, mobile_no, clinic_id, roleID, reference_module, reference_id, status: "active", is_sys_user: "no", created_by: createdBy, created_date: toMysqlDateTime(), });
      const result = await CommonModel.saveMasterDetails({
        table: MODULE_TABLE,
        data: loginData,
      });
      const template = await renderTemplate("userAccountCredentials", "email", {
        name: name,
        userName: userName,
        password: password,
        appName: env.appName,
      });
      const { success, error } = await sendEmail({
        to: data.email,
        subject: "User Login Credentials",
        html: template,
        text: "",
        clinic_id: clinic_id || req.user.clinic_id,
      });

      if (!success) {
        return failureResponse(res, {
          code: 2008,
          httpStatus: 500,
          message: error,
        });
      }

      return {
        success: true,
        code: 1001,
        httpStatus: 201,
        user_id: result.insertId,
      };
    }

    // =========================
    // UPDATE
    // =========================
    if (mode === "update") {
      if (!user_id) {
        return {
          success: false,
          code: 2004,
          httpStatus: 404,
          message: "User ID is required",
        };
      }

      // Check duplicate username/email
      const duplicateCheck = await validateAdminDetails(email, userName, user_id);

      if (duplicateCheck) {
        return {
          success: false,
          ...duplicateCheck,
        };
      }

      const updateData = {
        name,
        email,
        userName,
        mobile_no,
        clinic_id,
        roleID,
        reference_module,
        reference_id,
        modified_by: createdBy,
        modified_date: toMysqlDateTime(),
      };

      // Password only update when provided
      if (password) {
        updateData.password = await hashPassword(password);
      }

      const cleanData = sanitizeSqlPayload(updateData);

      await CommonModel.updateMasterDetails({ table: MODULE_TABLE, data: cleanData, where: { user_id }, });

      return {
        success: true,
        code: 1002,
        httpStatus: 200,
        user_id,
      };
    }

    return {
      success: false,
      code: 2000,
      httpStatus: 400,
      message: "Invalid mode. Use create or update",
    };

  } catch (error) {
    return {
      success: false,
      code: 2008,
      httpStatus: 500,
      message: error.message,
    };
  }
};