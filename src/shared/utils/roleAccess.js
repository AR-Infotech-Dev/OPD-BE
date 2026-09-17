import * as CommonModel from '#shared/models/common.model.js';
import { query, DB_PREFIX } from '#config/database.js';
import { pickActionPermissions } from './menuAccess.js';

export async function getCurrentAccessUser(user_id) {
  const rows = await query(`SELECT u.user_id, u.roleID, u.company_id, u.default_company, r.slug AS role_slug
    FROM ${DB_PREFIX}users u JOIN ${DB_PREFIX}user_role_master r ON r.roleID = u.roleID
    WHERE u.user_id = ? AND u.status = 'active' AND r.status = 'active'
      AND (r.company_id = 0 OR r.company_id = u.company_id) LIMIT 1`, [user_id]);
  return rows[0] || null;
}

export async function getRolePermissions(roleID) {
  if (!roleID) return {};
  const rows = await CommonModel.getMasterDetails('role_module_access', 'permissions', {
    role_id: roleID, status: 'active',
  });
  return pickActionPermissions(rows[0]?.permissions);
}
