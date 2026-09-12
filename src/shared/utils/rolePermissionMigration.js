import { pickActionPermissions, sanitizeMenuPermissions, MENU_ACTIONS } from './menuAccess.js';
// Missing permissions and duplicate legacy rows are included in the intersection.
// Migration must never widen any existing user's effective access.
export function commonRolePermissions(permissionMaps, menus) {
  if (!permissionMaps.length) return {};
  const maps = permissionMaps.map(raw => sanitizeMenuPermissions(menus, pickActionPermissions(raw)));
  return sanitizeMenuPermissions(menus, Object.fromEntries(Object.keys(maps[0]).map(id => [id,
    Object.fromEntries(MENU_ACTIONS.map(action => [action, maps.every(map => Boolean(map[id]?.[action]))]))
  ])));
}
