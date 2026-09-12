import * as CommonModel from '#shared/models/common.model.js';
import { query, DB_PREFIX } from '#config/database.js';
import { pickActionPermissions } from './menuAccess.js';

export async function getCurrentAccessUser(adminID) {
  const rows = await query(`SELECT u.adminID, u.roleID, u.company_id, u.default_company, r.slug AS role_slug
    FROM ${DB_PREFIX}admin u JOIN ${DB_PREFIX}user_role_master r ON r.roleID = u.roleID
    WHERE u.adminID = ? AND u.status = 'active' AND r.status = 'active' AND r.isDelete = 'N'
      AND (r.company_id = 0 OR r.company_id = u.company_id) LIMIT 1`, [adminID]);
  return rows[0] || null;
}

export async function getRolePermissions(roleID, companyId) {
  if (!roleID || !companyId) return {};
  const rows = await CommonModel.getMasterDetails('role_module_access', 'permissions', {
    role_id: roleID, company_id: companyId, status: 'active',
  });
  return pickActionPermissions(rows[0]?.permissions);
}
