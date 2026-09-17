import { getRolePermissions } from '#shared/utils/roleAccess.js';
import { hasMenuAccess } from '#shared/utils/menuAccess.js';
import { query, DB_PREFIX } from "#config/database.js";
import { failureResponse } from "#shared/utils/apiResponse.js";
import { isSuperAdminRole } from "#shared/utils/role.utils.js";

const getMenuIdByModuleKey = (moduleKey, menus) => {
  const normalize = value => String(value || '').replace(/^\/+|\/+$/g, '');
  const candidates = (Array.isArray(moduleKey) ? moduleKey : [moduleKey]).map(normalize).filter(Boolean);
  return menus.find(menu => candidates.includes(normalize(menu.module_name)) || candidates.includes(normalize(menu.menu_link)))?.menu_id || null;
};

export const requirePermission = (moduleKey, action) => {
  return async (req, res, next) => {
    try {
      if (isSuperAdminRole(req.user)) {
        return next();
      }

      const user_id = req.user?.user_id;
      const company_id = req.user?.company_id;

      if (!user_id || !company_id) {
        return failureResponse(res, {
          code: 2007,
          httpStatus: 403,
          message: "Permission denied",
        });
      }

      const permissions = await getRolePermissions(req.user.roleID, company_id);
      // Read the current hierarchy for each request, including immediately after a menu move.
      const menus = await query('SELECT menu_id, parent_id, is_parent, status, module_name, menu_link FROM ' + DB_PREFIX + 'menu_master');
      const menuId = getMenuIdByModuleKey(moduleKey, menus);
      
      if (!menuId) {
        return failureResponse(res, {
          code: 2007,
          httpStatus: 403,
          message: `Menu not configured for ${Array.isArray(moduleKey) ? moduleKey.join(", ") : moduleKey}`,
        });
      }


      if (!hasMenuAccess(menuId, menus, permissions, action)) {
        return failureResponse(res, {
          code: 2007,
          httpStatus: 403,
          message: `No ${action} permission for menu ${menuId}`,
        });
      }

      req.permissions = permissions;
      req.permissionMenuId = menuId;
      return next();
    } catch (error) {
      return failureResponse(res, {
        code: 2008,
        httpStatus: 500,
        message: error.message,
      });
    }
  };
};
