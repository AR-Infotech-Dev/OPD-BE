import { legacyConfig } from "#config/legacy.js";
import { query } from "#config/database.js";

const table = (name) => `\`${legacyConfig.dbPrefix}${name}\``;

export async function findActiveUserByIdentity(identity) {
  const rows = await query(
    `SELECT * FROM ${table("users")}
     WHERE (email = ? OR userName = ? OR contactNo = ?)
       AND status = 'active'
     LIMIT 1`,
    [identity, identity, identity]
  );

  return rows[0] || null;
}

export async function findRoleById(roleID) {
  const rows = await query(
    `SELECT roleName, slug FROM ${table("user_role_master")} WHERE roleID = ? LIMIT 1`,
    [roleID]
  );

  return rows[0] || null;
}

export async function findCompanyById(company_id) {
  const rows = await query(
    `SELECT * FROM ${table("company_master")} WHERE company_id = ? AND status = 'active' LIMIT 1`,
    [company_id]
  );

  return rows[0] || null;
}

export async function updateusersLoginInfo(user_id, gfcmToken) {
  await query(
    `UPDATE ${table("users")}
     SET lastLogin = NOW(), gfcmToken = ?
     WHERE user_id = ?`,
    [gfcmToken, user_id]
  );
}

export async function createusersSession(user_id, sessionKey, ip) {
  await query(
    `INSERT INTO ${table("users_sessions")}
      (user_id, sessionKey, accessDate, created_date, IP)
     VALUES (?, ?, NOW(), NOW(), ?)`,
    [user_id, sessionKey, ip]
  );
}

export async function deleteusersSessions(user_id) {
  await query(`DELETE FROM ${table("users_sessions")} WHERE user_id = ?`, [user_id]);
}
