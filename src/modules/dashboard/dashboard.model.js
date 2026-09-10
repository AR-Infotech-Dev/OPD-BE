import { isAdminRole } from "#shared/utils/role.utils.js";

export const getDashboardOverview = async (user = {}, filter = {}) => {
  const [] = await Promise.all([]);

  return {
    role: user?.role_slug || "user",
    scope: isAdminRole(user?.role_slug) ? "admin" : "user",
  };
};
