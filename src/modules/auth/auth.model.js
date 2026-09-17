// modules/auth/auth.model.js

import { query, DB_PREFIX } from "#config/database.js";

// ===================================
// VERIFY USER DETAILS
// ===================================
export const verifyUserDetails = async (userName) => {
  const sql = `
    SELECT t.*, r.slug AS role_slug, cn.clinic_name as clinic_name,t.clinic_id 
    FROM ${DB_PREFIX}users AS t
    LEFT JOIN ${DB_PREFIX}user_role_master as r ON t.roleID = r.roleID
    LEFT JOIN ${DB_PREFIX}clinic_master as cn ON t.clinic_id = cn.clinic_id
    WHERE (
      t.email = ?
      OR t.userName = ?
      OR t.contactNo = ?
    )
    `;
    // AND t.status = 'active'
  return await query(sql, [userName, userName, userName]);
};

// ===================================
// FIND USER BY EMAIL
// ===================================
export const findUserByEmail = async (email) => {

  const sql = `
    SELECT *
    FROM ${DB_PREFIX}users
    WHERE email = ?
    LIMIT 1
    `;
    // AND status = 'active'
  const rows = await query(sql, [email]);
  return rows[0] || null;
};

// ===================================
// FIND USER BY OTP
// ===================================
export const findUserByOtp = async (otp) => {
  const sql = `
    SELECT *
    FROM ${DB_PREFIX}users
    WHERE otp = ?
      AND isEmailSend = 'yes'
      LIMIT 1
      `;
      // AND otp_exp_time >= NOW()
      // AND status = 'active'
  
  const rows = await query(sql, [otp]);
  return rows[0] || null;
};

// ===================================
// SAVE FORGOT PASSWORD OTP
// ===================================
export const saveForgotPasswordOtp = async (user_id, data = {}) => {
  return await saveusersInfo(data, user_id);
};

// ===================================
// UPDATE PASSWORD WITH OTP RESET
// ===================================
export const updatePasswordByuser_id = async (user_id, data = {}) => {
  return await saveusersInfo(data, user_id);
};

// ===================================
// UPDATE users INFO
// ===================================
export const saveusersInfo = async (data, user_id) => {
  const keys = Object.keys(data);
  const values = Object.values(data);

  const setClause = keys.map((key) => `${key} = ?`).join(", ");

  const sql = `
    UPDATE ${DB_PREFIX}users
    SET ${setClause}
    WHERE user_id = ?
  `;

  return await query(sql, [...values, user_id]);
};

// ===================================
// INSERT SESSION KEY
// ===================================
export const setSessionKey = async (
  user_id,
  sessionKey,
  ip
) => {
  const sql = `
    INSERT INTO users_sessions
    (
      user_id,
      sessionKey,
      accessDate,
      created_date,
      IP
    )
    VALUES (?, ?, NOW(), NOW(), ?)
  `;

  return await query(sql, [
    user_id,
    sessionKey,
    ip,
  ]);
};

// ===================================
// DELETE SESSION KEY
// ===================================
export const unsetSessionKey = async (
  user_id
) => {
  const sql = `
    DELETE FROM users_sessions
    WHERE user_id = ?
  `;

  return await query(sql, [user_id]);
};

// ===================================
// GET SESSION DETAILS
// ===================================
export const getSessionDetails = async (
  user_id
) => {
  const sql = `
    SELECT *
    FROM users_sessions
    WHERE user_id = ?
  `;

  return await query(sql, [user_id]);
};

// ===================================
// UPDATE SESSION TIME
// ===================================
export const updateSession = async (
  user_id
) => {
  const sql = `
    UPDATE users_sessions
    SET accessDate = NOW()
    WHERE user_id = ?
  `;

  return await query(sql, [user_id]);
};

// ===================================
// UPDATE MOBILE DEVICE
// ===================================
export const updateDeviceDetails = async (
  data,
  deviceID
) => {
  const keys = Object.keys(data);
  const values = Object.values(data);

  const setClause = keys.map((key) => `${key} = ?`).join(", ");

  const sql = `
    UPDATE mobileDevice
    SET ${setClause}
    WHERE deviceID = ?
  `;

  return await query(sql, [...values, deviceID]);
};

// ===================================
// GET MOBILE DEVICE DETAILS
// ===================================
export const getMobileDeviceDetails = async (
  deviceID
) => {
  const sql = `
    SELECT *
    FROM mobileDevice
    WHERE deviceID = ?
  `;

  return await query(sql, [deviceID]);
};

// ===================================
// SAVE MOBILE DEVICE
// ===================================
export const saveDeviceInfo = async (
  data
) => {
  const keys = Object.keys(data);
  const values = Object.values(data);

  const sql = `
    INSERT INTO mobileDevice
    (${keys.join(",")})
    VALUES (${keys.map(() => "?").join(",")})
  `;

  return await query(sql, values);
};

// ===================================
// GET USER OS
// ===================================
export const getUserOS = (
  userAgent = ""
) => {
  const osList = [
    { regex: /windows nt 10/i, name: "Windows 10" },
    { regex: /windows nt 6.3/i, name: "Windows 8.1" },
    { regex: /windows nt 6.1/i, name: "Windows 7" },
    { regex: /android/i, name: "Android" },
    { regex: /iphone/i, name: "iPhone" },
    { regex: /ipad/i, name: "iPad" },
    { regex: /mac/i, name: "Mac OS" },
    { regex: /linux/i, name: "Linux" },
  ];

  const match = osList.find((os) =>
    os.regex.test(userAgent)
  );

  return match
    ? match.name
    : "Unknown OS";
};
