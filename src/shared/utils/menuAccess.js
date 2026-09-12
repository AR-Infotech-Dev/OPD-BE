// Every menu requires its own View permission and View on every ancestor.
export const permissionBoolean = value => [true, 1, '1', 'true', 'yes', 'y', 'on'].includes(typeof value === 'string' ? value.toLowerCase() : value);
export const parentMenu = row => permissionBoolean(row?.is_parent);
export function hasMenuAccess(menuId, menus = [], permissions = {}, action = 'view') {
  const key = String(menuId), byId = new Map(menus.map(row => [String(row.menu_id ?? row.id), row]));
  const menu = byId.get(key);
  if (!menu) return false;
  const actionKey = action === 'create' ? 'add' : action;
  if (!MENU_ACTIONS.includes(actionKey)) return false;
  if (actionKey !== 'view' && parentMenu(menu)) return false;
  const seen = new Set();
  let current = key;
  while (current && current !== '0') {
    if (seen.has(current)) return false;
    seen.add(current);
    const row = byId.get(current), permission = permissions?.[current];
    if (!row || (row.status && row.status !== 'active') || !permissionBoolean(permission?.view ?? permission?.can_view)) return false;
    if (current !== key && !parentMenu(row)) return false;
    current = String(row.parent_id ?? row.parentID ?? 0);
  }
  const permission = permissions?.[key];
  return permissionBoolean(permission?.[actionKey] ?? permission?.['can_' + actionKey]);
}
export function sanitizeMenuPermissions(menus = [], permissions = {}) {
  return menus.reduce((result, menu) => {
    const id = String(menu.menu_id ?? menu.id);
    if (!hasMenuAccess(id, menus, permissions)) return result;
    result[id] = {
      view: true,
      add: hasMenuAccess(id, menus, permissions, 'add'),
      edit: hasMenuAccess(id, menus, permissions, 'edit'),
      delete: hasMenuAccess(id, menus, permissions, 'delete'),
    };
    return result;
  }, {});
}

export const MENU_ACTIONS = ['view', 'add', 'edit', 'delete'];

// Whitelist module actions when reading legacy records as well as new API payloads.
export function pickActionPermissions(raw = {}) {
  let source = raw;
  if (typeof source === 'string') { try { source = JSON.parse(source); } catch { return {}; } }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source)
    .filter(([, entry]) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .map(([id, entry]) => [id, Object.fromEntries(MENU_ACTIONS.map(action => [action,
      permissionBoolean(entry[action] ?? entry['can_' + action]),
    ]))]));
}
