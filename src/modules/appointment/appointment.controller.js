import * as CommonModel from "#shared/models/common.model.js";
import {
  successResponse,
  failureResponse,
} from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { validate } from "#shared/utils/request.validator.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { buildTablePayload } from "#shared/utils/tablePayload.js";
import Joi from "joi";
import { syncToTenant } from "#shared/utils/tenantSync.js";
import { getUserCompanyId, isSuperAdminRole } from "#shared/utils/role.utils.js";
import { query } from "#config/database.js";

const MODULE_TABLE = "appointments";

// ======================================================
// VALIDATION SCHEMA
// ======================================================

const appointmentSchema = Joi.object({
  appointment_id: Joi.number()
    .integer()
    .positive()
    .allow(null),

  clinic_id: Joi.number()
    .integer()
    .positive()
    .allow(null),

  appointment_no: Joi.string()
    .max(30)
    .allow("", null),

  patient_id: Joi.number()
    .integer()
    .positive()
    .required(),

  doctor_id: Joi.number()
    .integer()
    .positive()
    .required(),

  department_id: Joi.number()
    .integer()
    .positive()
    .required(),

  appointment_date: Joi.date()
    .required(),
  
   appointment_time: Joi.string()
    .valid("morning", "afternoon", "evening")
    .allow(null, ""),

  appointment_type: Joi.string()
    .valid("new", "follow_up", "walk_in")
    .required(),

  consultation_fee: Joi.any().allow(null, ""),

  payment_mode: Joi.string()
    .valid("pay_now", "pay_later")
    .allow(null, ""),

    payment_status: Joi.string()
  .valid("pending", "paid", "failed")
  .allow(null, ""),

  booking_source: Joi.string()
    .valid("reception", "patient", "admin")
    .default("reception"),

  status: Joi.string()
    .valid(
      "booked",
      "checked_in",
      "in_consultation",
      "completed",
      "cancelled",
      "no_show"
    )
    .default("booked"),

  token_no: Joi.number()
    .integer()
    .positive()
    .allow(null),

  checked_in_at: Joi.date()
    .allow(null),

  checked_in_by: Joi.number()
    .integer()
    .positive()
    .allow(null),

  cancelled_at: Joi.date()
    .allow(null),

  cancelled_by: Joi.number()
    .integer()
    .positive()
    .allow(null),

  cancellation_reason: Joi.string()
    .allow("", null),

  notes: Joi.string()
    .allow("", null),

  created_by: Joi.number()
    .integer()
    .allow(null),

  modified_by: Joi.number()
    .integer()
    .allow(null),

  created_date: Joi.date()
    .allow(null),

  modified_date: Joi.date()
    .allow(null),
});

// ======================================================
// DEFAULT COLUMNS
// ======================================================

const default_columns = {};

const custom_columns = {};

// ======================================================
// HELPERS
// ======================================================

const sanitizeSqlPayload = (payload = {}) =>
  Object.entries(payload).reduce((data, [key, value]) => {
    data[key] = value === undefined ? null : value;
    return data;
  }, {});

// ======================================================
// GENERATE APPOINTMENT NUMBER
// ======================================================

const generateAppointmentNo = async () => {
  const rows = await query(
    `
      SELECT appointment_no
      FROM ab_${MODULE_TABLE}
      ORDER BY appointment_id DESC
      LIMIT 1
    `
  );

  let nextNumber = 1;

  if (rows.length && rows[0]?.appointment_no) {
    const match = String(rows[0].appointment_no).match(/\d+$/);

    if (match) {
      nextNumber = Number(match[0]) + 1;
    }
  }

  return `APT-${String(nextNumber).padStart(6, "0")}`;
};

// ======================================================
// CHECK DOUBLE BOOKING
// ======================================================

const checkDoubleBooking = async ({
  doctor_id,
  appointment_date,
  appointment_id = null,
}) => {
  const where = [
    "doctor_id = ?",
    "DATE(appointment_date) = DATE(?)",
    "appointment_status NOT IN ('cancelled', 'no_show')",
  ];

  const values = [
    doctor_id,
    appointment_date,
  ];

  if (appointment_id) {
    where.push("appointment_id != ?");
    values.push(appointment_id);
  }

  const rows = await query(
    `
      SELECT appointment_id
      FROM ab_${MODULE_TABLE}
      WHERE ${where.join(" AND ")}
      LIMIT 1
    `,
    values
  );

  return rows.length > 0;
};

// ======================================================
// GENERATE DOCTOR + DATE TOKEN
// ======================================================

const generateToken = async ({
  doctor_id,
  appointment_date,
}) => {
  const rows = await query(
    `
      SELECT COALESCE(MAX(token_no), 0) AS last_token
      FROM ab_${MODULE_TABLE}
      WHERE doctor_id = ?
        AND DATE(appointment_date) = DATE(?)
        AND appointment_status NOT IN ('cancelled', 'no_show')
    `,
    [
      doctor_id,
      appointment_date,
    ]
  );

  const lastToken = Number(
    rows[0]?.last_token || 0
  );

  return lastToken + 1;
};

// ======================================================
// CREATE APPOINTMENT
// ======================================================

export const createAppointment = async (req, res) => {
  try {
    const body = {
      ...req.body,
      appointment_type: req.body.appointment_type,
    };

    const result = validate(
      appointmentSchema,
      body
    );

    if (!result.isValid) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message: result.message.replace(/"/g, ""),
      });
    }

    let data = result.value;

    const clinicId =
      data.clinic_id ||
      getUserCompanyId(req.user) ||
      req.user?.company_id ||
      null;

    // --------------------------------------------------
    // DOUBLE BOOKING
    // --------------------------------------------------

    const alreadyBooked =
      await checkDoubleBooking({
        doctor_id: data.doctor_id,
        appointment_date: data.appointment_date,
      });

    if (alreadyBooked) {
      return failureResponse(res, {
        code: 2005,
        httpStatus: 409,
        message:
          "This doctor already has an appointment for the selected date",
      });
    }

    // --------------------------------------------------
    // APPOINTMENT NUMBER
    // --------------------------------------------------

    const appointmentNo =
      await generateAppointmentNo();

    // --------------------------------------------------
    // TOKEN
    // --------------------------------------------------

    const tokenNo =
      await generateToken({
        doctor_id: data.doctor_id,
        appointment_date: data.appointment_date,
      });

    // --------------------------------------------------
    // FINAL DATA
    // --------------------------------------------------

    data = sanitizeSqlPayload(
      await buildTablePayload(
        MODULE_TABLE,
        {
          clinic_id: clinicId,

          appointment_no: appointmentNo,

          patient_id: data.patient_id,

          doctor_id: data.doctor_id,

          department_id: data.department_id,

          appointment_date: data.appointment_date,

          appointment_time: data.appointment_time,

          visit_type: data.appointment_type,

          booking_source:
            data.booking_source ||
            "reception",

          appointment_status:
            data.status ||
            "booked",

          token_no: tokenNo,

          checked_in_at:
            data.checked_in_at || null,

          checked_in_by:
            data.checked_in_by || null,

          cancelled_at:
            data.cancelled_at || null,

          cancelled_by:
            data.cancelled_by || null,

          cancellation_reason:
            data.cancellation_reason || null,

          notes:
            data.notes || null,

          created_by:
            req.user?.adminID || null,

          created_date:
            toMysqlDateTime(),
        }
      )
    );

    // --------------------------------------------------
    // MAIN DB
    // --------------------------------------------------

    const resultData =
      await CommonModel.saveMasterDetails({
        table: MODULE_TABLE,
        data,
      });

    // --------------------------------------------------
    // TENANT SYNC
    // --------------------------------------------------

    if (clinicId) {
      await syncToTenant(
        clinicId,
        async () => {
          await CommonModel.saveMasterDetails({
            table: MODULE_TABLE,
            data: {
              ...data,
              appointment_id:
                resultData.insertId,
            },
          });
        }
      );
    }

    return successResponse(res, {
      code: 1001,
      httpStatus: 201,
      message:
        "Appointment created successfully",
      data: {
        appointment_id:
          resultData.insertId,

        appointment_no:
          appointmentNo,

        token_no:
          tokenNo,

        status:
          data.appointment_status,
      },
    });
  } catch (error) {
    console.error(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

// ======================================================
// LIST APPOINTMENTS
// ======================================================

export const list = async (req, res) => {
  try {
    const {
      page = 1,
      searchText = "",
      getAll = "N",
      orderBy = "t.created_date",
      order = "DESC",
      filters,
    } = req.body;

    const limit = 20;

    const currentPage =
      Number(page) || 1;

    const start =
      (currentPage - 1) * limit;

    const other = {
      orderBy,
      order,

      searchColumns: [
        "p.full_name",
        "d.doctor_name",
        "t.appointment_no",
        "t.appointment_date",
        "t.appointment_status",
        "t.visit_type",
      ],
    };

    const filterData =
      prepareFilterData({
        filters,
        searchText,
        other,
        default_columns,
        custom_columns,
      });

    let {
      select,
      where,
      values,
      join,
    } = filterData;

    const scopedClinicId =
      isSuperAdminRole(
        req.user?.role_slug
      )
        ? null
        : getUserCompanyId(req.user);

    if (scopedClinicId) {
      where.push(
        "t.clinic_id = ?"
      );

      values.push(
        scopedClinicId
      );
    }

    // --------------------------------------------------
    // SELECT
    // --------------------------------------------------

    select = `
  t.*,
  p.full_name AS patient_name,
  p.mobile_no AS patient_mobile,
  d.doctor_name AS doctor_name
`;

    join = [
      {
        type: "LEFT JOIN",
        table: "patients",
        alias: "p",
        key1: "patient_id",
        key2: "patient_id",
      },

      {
        type: "LEFT JOIN",
        table: "doctors",
        alias: "d",
        key1: "doctor_id",
        key2: "doctor_id",
      },
    ];

    const total =
      await CommonModel.getCountsByParameter({
        table: MODULE_TABLE,
        where,
        values,
        join,
        other,
      });

    const totalPages =
      Math.ceil(total / limit);

    let end =
      start + limit;

    if (end > total) {
      end = total;
    }

    let data = [];

    if (getAll === "Y") {
      data =
        await CommonModel.GetMasterListDetails({
          select,
          table: MODULE_TABLE,
          where,
          values,
          join,
          other,
        });
    } else {
      data =
        await CommonModel.GetMasterListDetails({
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

          start:
            total === 0
              ? 0
              : start + 1,

          end,
        },
      },
    });
  } catch (error) {
    console.error(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

// ======================================================
// GET SINGLE APPOINTMENT
// ======================================================

export const getAppointmentDetails = async (
  req,
  res
) => {
  try {
    const {
      id: appointment_id,
    } = req.params;

    if (!appointment_id) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message:
          "Appointment ID is required",
      });
    }

    const rows =
      await CommonModel.GetMasterListDetails({
        select: `
          
  t.*,
  p.full_name AS patient_name,
  p.mobile_no AS patient_mobile,
  d.doctor_name AS doctor_name
`,
        table: MODULE_TABLE,

        where: [
          "t.appointment_id = ?",
        ],

        values: [
          appointment_id,
        ],

        join: [
          {
            type: "LEFT JOIN",
            table: "patients",
            alias: "p",
            key1: "patient_id",
            key2: "patient_id",
          },

          {
            type: "LEFT JOIN",
            table: "doctors",
            alias: "d",
            key1: "doctor_id",
            key2: "doctor_id",
          },
        ],
      });

    if (!rows.length) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message:
          "Appointment not found",
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
    console.error(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

// ======================================================
// UPDATE / RESCHEDULE APPOINTMENT
// ======================================================

export const updateAppointment = async (
  req,
  res
) => {
  try {
    const {
      id: appointment_id,
    } = req.params;

    if (!appointment_id) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message:
          "Appointment ID is required",
      });
    }

    const existing =
      await CommonModel.getMasterDetails(
        MODULE_TABLE,
        "*",
        {
          appointment_id,
        }
      );

    if (!existing.length) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message:
          "Appointment not found",
      });
    }

    const body =
      await buildTablePayload(
        MODULE_TABLE,
        req.body
      );

    const mergedData = {
      ...existing[0],
      ...body,
      appointment_id,
    };

    // DB names -> validation names
    const validationData = {
      ...mergedData,

      appointment_type:
        mergedData.visit_type,

      status:
        mergedData.appointment_status,
    };

    const result =
      validate(
        appointmentSchema,
        validationData
      );

    if (!result.isValid) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message:
          result.message.replace(/"/g, ""),
      });
    }

    const data =
      result.value;

    // --------------------------------------------------
    // DOUBLE BOOKING
    // --------------------------------------------------

    const alreadyBooked =
      await checkDoubleBooking({
        doctor_id:
          data.doctor_id,

        appointment_date:
          data.appointment_date,

        appointment_id,
      });

    if (alreadyBooked) {
      return failureResponse(res, {
        code: 2005,
        httpStatus: 409,
        message:
          "This doctor already has an appointment for the selected date",
      });
    }

    // --------------------------------------------------
    // TOKEN
    // --------------------------------------------------

    let tokenNo =
      existing[0].token_no;

    const dateChanged =
      String(
        existing[0].appointment_date
      ).substring(0, 10) !==
      String(
        data.appointment_date
      ).substring(0, 10);

    const doctorChanged =
      Number(
        existing[0].doctor_id
      ) !==
      Number(
        data.doctor_id
      );

    if (
      dateChanged ||
      doctorChanged
    ) {
      tokenNo =
        await generateToken({
          doctor_id:
            data.doctor_id,

          appointment_date:
            data.appointment_date,
        });
    }

    // --------------------------------------------------
    // FINAL UPDATE DATA
    // --------------------------------------------------

    const updateData =
      sanitizeSqlPayload(
        await buildTablePayload(
          MODULE_TABLE,
          {
            clinic_id:
              data.clinic_id ||
              existing[0].clinic_id,

            appointment_no:
              existing[0].appointment_no,

            patient_id:
              data.patient_id,

            doctor_id:
              data.doctor_id,

            department_id:
              data.department_id,

            appointment_date:
              data.appointment_date,

            visit_type:
              data.appointment_type,

            booking_source:
              data.booking_source ||
              existing[0].booking_source,

            appointment_status:
              data.status,

            token_no:
              tokenNo,

            checked_in_at:
              data.checked_in_at ||
              existing[0].checked_in_at ||
              null,

            checked_in_by:
              data.checked_in_by ||
              existing[0].checked_in_by ||
              null,

            cancelled_at:
              data.cancelled_at ||
              existing[0].cancelled_at ||
              null,

            cancelled_by:
              data.cancelled_by ||
              existing[0].cancelled_by ||
              null,

            cancellation_reason:
              data.cancellation_reason ||
              existing[0].cancellation_reason ||
              null,

            notes:
              data.notes ||
              existing[0].notes ||
              null,

            modified_by:
              req.user?.adminID ||
              null,

            modified_date:
              toMysqlDateTime(),
          }
        )
      );

    await CommonModel.updateMasterDetails({
      table: MODULE_TABLE,

      data: updateData,

      where: {
        appointment_id,
      },
    });

    // --------------------------------------------------
    // TENANT SYNC
    // --------------------------------------------------

    const clinicId =
      updateData.clinic_id ||
      req.user?.company_id;

    if (clinicId) {
      await syncToTenant(
        clinicId,
        async () => {
          await CommonModel.updateMasterDetails({
            table: MODULE_TABLE,

            data: updateData,

            where: {
              appointment_id,
            },
          });
        }
      );
    }

    return successResponse(res, {
      code: 1002,
      httpStatus: 200,

      message:
        "Appointment updated successfully",

      data: {
        appointment_id,

        appointment_no:
          updateData.appointment_no,

        token_no:
          tokenNo,
      },
    });
  } catch (error) {
    console.error(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

// ======================================================
// DELETE APPOINTMENT
// ======================================================

export const deleteAppointment = async (
  req,
  res
) => {
  try {
    const {
      id: appointment_id,
    } = req.params;

    if (!appointment_id) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message:
          "Appointment ID is required",
      });
    }

    const existing =
      await CommonModel.getMasterDetails(
        MODULE_TABLE,
        "*",
        {
          appointment_id,
        }
      );

    if (!existing.length) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message:
          "Appointment not found",
      });
    }

    await CommonModel.deleteMasterDetails({
      table: MODULE_TABLE,

      where: {
        appointment_id,
      },
    });

    // --------------------------------------------------
    // TENANT SYNC
    // --------------------------------------------------

    const clinicId =
      existing[0].clinic_id ||
      req.user?.company_id;

    if (clinicId) {
      await syncToTenant(
        clinicId,
        async () => {
          await CommonModel.deleteMasterDetails({
            table: MODULE_TABLE,

            where: {
              appointment_id,
            },
          });
        }
      );
    }

    return successResponse(res, {
      code: 1003,
      httpStatus: 200,

      message:
        "Appointment deleted successfully",

      data: [],
    });
  } catch (error) {
    console.error(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

// ======================================================
// CHANGE STATUS
// ======================================================

export const changeStatus = async (
  req,
  res
) => {
  try {
    const {
      ids = [],
      status,
    } = req.body;

    if (!ids.length) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message:
          "Appointment IDs are required",
      });
    }

    const validStatuses = [
      "booked",
      "checked_in",
      "in_consultation",
      "completed",
      "cancelled",
      "no_show",
    ];

    if (!validStatuses.includes(status)) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message:
          "Invalid appointment status",
      });
    }

    await CommonModel.changeMasterStatus(
      MODULE_TABLE,
      status,
      ids
    );

    // --------------------------------------------------
    // TENANT SYNC
    // --------------------------------------------------

    const clinicId =
      req.user?.company_id;

    if (clinicId) {
      await syncToTenant(
        clinicId,
        async () => {
          await CommonModel.changeMasterStatus(
            MODULE_TABLE,
            status,
            ids
          );
        }
      );
    }

    return successResponse(res, {
      code: 1002,
      httpStatus: 200,

      message:
        "Appointment status updated successfully",

      data: [],
    });
  } catch (error) {
    console.error(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

// ======================================================
// CHECK IN
// ======================================================

export const checkIn = async (
  req,
  res
) => {
  try {
    const {
      id: appointment_id,
    } = req.params;

    if (!appointment_id) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message:
          "Appointment ID is required",
      });
    }

    const existing =
      await CommonModel.getMasterDetails(
        MODULE_TABLE,
        "*",
        {
          appointment_id,
        }
      );

    if (!existing.length) {
      return failureResponse(res, {
        code: 2004,
        httpStatus: 404,
        message:
          "Appointment not found",
      });
    }

    const appointment =
      existing[0];

    if (
      appointment.appointment_status ===
      "cancelled"
    ) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message:
          "Cancelled appointment cannot be checked in",
      });
    }

    if (
      appointment.appointment_status ===
      "completed"
    ) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message:
          "Completed appointment cannot be checked in",
      });
    }

    const data = {
      appointment_status:
        "checked_in",

      checked_in_at:
        toMysqlDateTime(),

      checked_in_by:
        req.user?.adminID ||
        null,

      modified_by:
        req.user?.adminID ||
        null,

      modified_date:
        toMysqlDateTime(),
    };

    await CommonModel.updateMasterDetails({
      table: MODULE_TABLE,

      data,

      where: {
        appointment_id,
      },
    });

    // --------------------------------------------------
    // TENANT SYNC
    // --------------------------------------------------

    const clinicId =
      appointment.clinic_id ||
      req.user?.company_id;

    if (clinicId) {
      await syncToTenant(
        clinicId,
        async () => {
          await CommonModel.updateMasterDetails({
            table: MODULE_TABLE,

            data,

            where: {
              appointment_id,
            },
          });
        }
      );
    }

    return successResponse(res, {
      code: 1002,
      httpStatus: 200,

      message:
        "Patient checked-in successfully",

      data: {
        appointment_id,

        status:
          "checked_in",

        token_no:
          appointment.token_no,
      },
    });
  } catch (error) {
    console.error(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

// ======================================================
// DOCTOR DAILY QUEUE
// ======================================================

export const getDoctorQueue = async (
  req,
  res
) => {
  try {
    const {
      doctor_id,
      appointment_date,
    } = req.body;

    if (
      !doctor_id ||
      !appointment_date
    ) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,

        message:
          "Doctor and appointment date are required",
      });
    }

    const data = await query(
      `
     SELECT
      t.*,
      p.full_name AS patient_name,
      p.mobile_no AS patient_mobile,
      d.doctor_name AS doctor_name
      FROM ab_appointments t

    LEFT JOIN ab_patients p
      ON t.patient_id = p.patient_id

    LEFT JOIN ab_doctors d
      ON t.doctor_id = d.doctor_id

    WHERE t.doctor_id = ?
      AND DATE(t.appointment_date) = DATE(?)

    ORDER BY t.token_no ASC
  `,
      [
        doctor_id,
        appointment_date,
      ]
    );

    return successResponse(res, {
      code: 1004,
      httpStatus: 200,

      data: {
        data,
      },
    });
  } catch (error) {
    console.error(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

// ======================================================
// GET TODAY'S APPOINTMENTS
// ======================================================

export const getTodayAppointments = async (
  req,
  res
) => {
  try {
    const {
      doctor_id = null,
    } = req.body;

    const where = [
      "DATE(t.appointment_date) = CURDATE()",
    ];

    const values = [];

    if (doctor_id) {
      where.push(
        "t.doctor_id = ?"
      );

      values.push(
        doctor_id
      );
    }

    const clinicId =
      getUserCompanyId(req.user);

    if (
      !isSuperAdminRole(
        req.user?.role_slug
      ) &&
      clinicId
    ) {
      where.push(
        "t.clinic_id = ?"
      );

      values.push(
        clinicId
      );
    }

    const data =
      await CommonModel.GetMasterListDetails({
        select: `
          t.*,

         p.full_name AS patient_name,
         p.mobile_no AS patient_mobile,
         d.doctor_name AS doctor_name
        `,

        table: MODULE_TABLE,

        where,

        values,

        join: [
          {
            type: "LEFT JOIN",
            table: "patients",
            alias: "p",
            key1: "patient_id",
            key2: "patient_id",
          },

          {
            type: "LEFT JOIN",
            table: "doctors",
            alias: "d",
            key1: "doctor_id",
            key2: "doctor_id",
          },
        ],

        other: {
          orderBy: "t.token_no",
          order: "ASC",
        },
      });

    return successResponse(res, {
      code: 1004,
      httpStatus: 200,

      data: {
        data,
      },
    });
  } catch (error) {
    console.error(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};