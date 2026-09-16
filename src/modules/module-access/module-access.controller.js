import { query, DB_PREFIX } from '#config/database.js';
import { sanitizeMenuPermissions } from '#shared/utils/menuAccess.js';
import { getRolePermissions } from '#shared/utils/roleAccess.js';
import { isSuperAdminRole } from '#shared/utils/role.utils.js';
import { successResponse, failureResponse } from '#shared/utils/apiResponse.js';
import * as CommonModel from "#shared/models/common.model.js";

const fail = (res, error) => failureResponse(res, { code: 2001, httpStatus: error.status || 500, message: error.message });
const invalid = (message, status = 400) => Object.assign(new Error(message), { status });
const positiveId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
async function scope(req) {
  const roleId = Number(req.params.id);
  const requested = req.body?.company_id ?? req.query?.company_id;
  const companyId = Number(requested || req.user.company_id);
  if (!positiveId(req.params.id) || !positiveId(companyId)) throw invalid('Role and company are required');
  if (!isSuperAdminRole(req.user) && companyId !== Number(req.user.company_id)) throw invalid('Company access denied', 403);
  const rows = await query(`SELECT r.roleID, r.slug FROM ${DB_PREFIX}user_role_master r
    JOIN ${DB_PREFIX}company_master c ON c.company_id = ? AND c.status = 'active'
    WHERE r.roleID = ? AND r.status = 'active' AND r.isDelete = 'N'
      AND (r.company_id = 0 OR r.company_id = c.company_id)`, [companyId, roleId]);
  if (!rows.length) throw invalid('Role is not available for this company', 404);
  if (isSuperAdminRole(rows[0].slug)) throw invalid('Super Admin has full access and cannot be configured', 403);
  return { roleId, companyId };
}
export async function listAccessRoles(req, res) {
  try {
    const requested = req.body?.company_id || req.query?.company_id;
    const companyId = isSuperAdminRole(req.user) ? requested : req.user.company_id;
    if (!isSuperAdminRole(req.user) && requested && Number(requested) !== Number(companyId)) throw invalid('Company access denied', 403);
    if (companyId && !positiveId(companyId)) throw invalid('Invalid company');
    const rows = await query(`SELECT r.roleID, r.roleName, r.slug, c.company_id, c.company_name,
      (SELECT COUNT(*) FROM ${DB_PREFIX}admin u WHERE u.roleID = r.roleID AND u.company_id = c.company_id AND u.status = 'active') AS user_count
      FROM ${DB_PREFIX}user_role_master r JOIN ${DB_PREFIX}company_master c ON (r.company_id = 0 OR r.company_id = c.company_id)
      WHERE r.status = 'active' AND r.isDelete = 'N' AND c.status = 'active'
      ${companyId ? 'AND c.company_id = ?' : ''} ORDER BY c.company_name, r.roleName`, companyId ? [Number(companyId)] : []);
    return successResponse(res, { code: 1004, httpStatus: 200, data: { data: rows.filter(r => !isSuperAdminRole(r.slug)) } });
  } catch (error) { return fail(res, error); }
}
export async function getModulesAccess(req, res) {
  try {
    const { roleId, companyId } = await scope(req);
    const permissions = await getRolePermissions(roleId, companyId);
    return successResponse(res, { code: 1004, httpStatus: 200, data: { data: { role_id: roleId, company_id: companyId, permissions } } });
  } catch (error) { return fail(res, error); }
}
export async function getMyPermissions(req, res) {
  try {
    // Legacy URL may contain a user ID, but it can only read the authenticated user's role.
    if (req.params.id && String(req.params.id) !== String(req.user.adminID)) throw invalid('Permission access denied', 403);
    const permissions = await getRolePermissions(req.user.roleID, req.user.company_id);
    const menus = await query('SELECT menu_id,parent_id,is_parent,status FROM ' + DB_PREFIX + 'menu_master');
    return successResponse(res, { code: 1004, httpStatus: 200, data: { data: { role_id: req.user.roleID, role_slug: req.user.role_slug, company_id: req.user.company_id, permissions: sanitizeMenuPermissions(menus, permissions) } } });
  } catch (error) { return fail(res, error); }
}
export async function saveModulesAccess(req, res) {
  try {
    const { roleId, companyId } = await scope(req);
    if ('user_id' in req.body) throw invalid('Permissions are assigned to a role, not a user');
    if (req.body.role_id !== undefined && Number(req.body.role_id) !== roleId) throw invalid('Role ID does not match');
    const raw = req.body.permissions;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('Permissions must be a JSON object');
    const menus = await query('SELECT menu_id,parent_id,is_parent,status FROM ' + DB_PREFIX + 'menu_master');
    const permissions = sanitizeMenuPermissions(menus, raw);
    await query(`INSERT INTO ${DB_PREFIX}role_module_access (role_id,company_id,permissions,created_by,status)
      VALUES (?,?,?,?,'active') ON DUPLICATE KEY UPDATE permissions=VALUES(permissions),status='active',modified_by=VALUES(created_by),modified_date=NOW()`,
      [roleId, companyId, JSON.stringify(permissions), req.user.adminID]);
    return successResponse(res, { code: 1002, httpStatus: 200, message: 'Role permissions updated successfully', data: { data: { role_id: roleId, company_id: companyId } } });
  } catch (error) { return fail(res, error); }
}
