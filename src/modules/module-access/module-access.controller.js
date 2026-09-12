import * as CommonModel from '#shared/models/common.model.js';
import { toMysqlDateTime } from '#shared/utils/dateTime.js';
import { sanitizeMenuPermissions } from '#shared/utils/menuAccess.js';
import { getRolePermissions } from '#shared/utils/roleAccess.js';
import { isSuperAdminRole } from '#shared/utils/role.utils.js';
import { successResponse, failureResponse } from '#shared/utils/apiResponse.js';

const fail = (res, error) => failureResponse(res, {code: 2001, httpStatus: error.status || 500, message: error.message});
const invalid = (message, status = 400) => Object.assign(new Error(message), {status});
const positiveId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
async function scope(req) {
  const roleId = Number(req.params.id);
  const requested = req.body?.company_id ?? req.query?.company_id;
  const companyId = Number(requested || req.user.company_id);
  if (!positiveId(req.params.id) || !positiveId(companyId)) throw invalid('Role and company are required');
  if (!isSuperAdminRole(req.user) && companyId !== Number(req.user.company_id)) throw invalid('Company access denied', 403);
  const [rows, companies] = await Promise.all([
    CommonModel.getMasterDetails('user_role_master', 'roleID, slug, company_id', {
      roleID: roleId, status: 'active', isDelete: 'N',
    }),
    CommonModel.getMasterDetails('company_master', 'company_id', {
      company_id: companyId, status: 'active',
    }),
  ]);
  if (!companies.length || (rows.length && Number(rows[0].company_id) !== 0 && Number(rows[0].company_id) !== companyId)) {
    throw invalid('Role is not available for this company', 404);
  }
  if (!rows.length) throw invalid('Role is not available for this company', 404);
  if (isSuperAdminRole(rows[0].slug)) throw invalid('Super Admin has full access and cannot be configured', 403);
  return {roleId, companyId};
}
export async function listAccessRoles(req, res) {
  try {
    const requested = req.body?.company_id || req.query?.company_id;
    const companyId = isSuperAdminRole(req.user) ? requested : req.user.company_id;
    if (!isSuperAdminRole(req.user) && requested && Number(requested) !== Number(companyId)) throw invalid('Company access denied', 403);
    if (companyId && !positiveId(companyId)) throw invalid('Invalid company');
    const [roles, companies, userCounts] = await Promise.all([
      CommonModel.getMasterDetails('user_role_master', 'roleID, roleName, slug, company_id', {
        status: 'active', isDelete: 'N',
      }),
      CommonModel.GetMasterListDetails({
        table: 'company_master', select: 'company_id, company_name',
        where: ["t.status = ?", ...(companyId ? ['t.company_id = ?'] : [])],
        values: ['active', ...(companyId ? [Number(companyId)] : [])],
        other: {orderBy: 't.company_name'},
      }),
      CommonModel.GetMasterListDetails({
        table: 'admin', select: 'roleID, company_id, COUNT(*) AS user_count',
        where: ["t.status = ?", ...(companyId ? ['t.company_id = ?'] : [])],
        values: ['active', ...(companyId ? [Number(companyId)] : [])],
        other: {groupBy: 'roleID, company_id'},
      }),
    ]);
    const counts = new Map(userCounts.map(row => [row.roleID + ':' + row.company_id, Number(row.user_count)]));
    const sortedRoles = roles.sort((a, b) => a.roleName.localeCompare(b.roleName));
    const rows = companies.flatMap(company => sortedRoles
      .filter(role => Number(role.company_id) === 0 || Number(role.company_id) === Number(company.company_id))
      .map(role => ({
        roleID: role.roleID, roleName: role.roleName, slug: role.slug,
        company_id: company.company_id, company_name: company.company_name,
        user_count: counts.get(role.roleID + ':' + company.company_id) || 0,
      })));

    return successResponse(res, {code:1004, httpStatus:200, data:{data:rows.filter(r => !isSuperAdminRole(r.slug))}});
  } catch(error) { return fail(res,error); }
}
export async function getModulesAccess(req,res) {
  try {
    const {roleId, companyId} = await scope(req);
    const permissions = await getRolePermissions(roleId, companyId);
    return successResponse(res,{code:1004,httpStatus:200,data:{data:{role_id:roleId,company_id:companyId,permissions}}});
  } catch(error) {return fail(res,error);}
}
export async function getMyPermissions(req,res) {
  try {
    // Legacy URL may contain a user ID, but it can only read the authenticated user's role.
    if (req.params.id && String(req.params.id) !== String(req.user.adminID)) throw invalid('Permission access denied',403);
    const permissions = await getRolePermissions(req.user.roleID, req.user.company_id);
    const menus = await CommonModel.getMasterDetails('menu_master', 'menu_id, parent_id, is_parent, status');
    return successResponse(res,{code:1004,httpStatus:200,data:{data:{role_id:req.user.roleID,role_slug:req.user.role_slug,company_id:req.user.company_id,permissions:sanitizeMenuPermissions(menus,permissions)}}});
  } catch(error) {return fail(res,error);}
}
export async function saveModulesAccess(req,res) {
  try {
    const {roleId, companyId} = await scope(req);
    if ('user_id' in req.body) throw invalid('Permissions are assigned to a role, not a user');
    if (req.body.role_id !== undefined && Number(req.body.role_id) !== roleId) throw invalid('Role ID does not match');
    const raw = req.body.permissions;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('Permissions must be a JSON object');
    const menus = await CommonModel.getMasterDetails('menu_master', 'menu_id, parent_id, is_parent, status');
    const permissions = sanitizeMenuPermissions(menus,raw);
    const permissionData = {permissions: JSON.stringify(permissions), status: 'active'};
    await CommonModel.saveMasterDetails({
      table: 'role_module_access',
      data: {role_id: roleId, company_id: companyId, ...permissionData, created_by: req.user.adminID},
      // Keep concurrent first saves atomic under the unique role/company key.
      onDuplicateUpdate: {...permissionData, modified_by: req.user.adminID, modified_date: toMysqlDateTime()},
    });
    return successResponse(res,{code:1002,httpStatus:200,message:'Role permissions updated successfully',data:{data:{role_id:roleId,company_id:companyId}}});
  } catch(error) {return fail(res,error);}
}
