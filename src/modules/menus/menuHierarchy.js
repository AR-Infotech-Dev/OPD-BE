export const isParent = (value) => [true, 1, '1', 'true', 'yes'].includes(value);
export function validateHierarchy(rows) {
  const byId = new Map(rows.map(row => [Number(row.menu_id), row]));
  for (const row of rows) {
    const seen = new Set([Number(row.menu_id)]);
    let parentId = Number(row.parent_id || 0);
    while (parentId) {
      if (seen.has(parentId)) throw new Error('A menu cannot be nested inside itself or its descendants.');
      const parent = byId.get(parentId);
      if (!parent || !isParent(parent.is_parent)) throw new Error('Choose an existing parent menu.');
      seen.add(parentId);
      parentId = Number(parent.parent_id || 0);
    }
  }
}
export function normalizePositions(positions, rows) {
  if (!Array.isArray(positions) || !positions.length) throw new Error('Menu positions are required.');
  const byId = new Map(rows.map(row => [Number(row.menu_id), row]));
  const seen = new Set();
  const result = positions.map(item => {
    const id = Number(item.menu_id), index = Number(item.menu_index);
    const parent = item.parent_id === undefined ? Number(byId.get(id)?.parent_id || 0) : Number(item.parent_id || 0);
    if (!Number.isSafeInteger(id) || id <= 0 || !byId.has(id) || seen.has(id) ||
      !Number.isSafeInteger(index) || index < 1 || !Number.isSafeInteger(parent) || parent < 0) {
      throw new Error('Invalid or duplicate menu position.');
    }
    seen.add(id);
    return { menu_id: id, menu_index: index, parent_id: parent || null };
  });
  if (seen.size !== rows.length) throw new Error('The menu list changed. Refresh all menus before saving the sequence.');
  const changes = new Map(result.map(row => [row.menu_id, row]));
  validateHierarchy(rows.map(row => ({ ...row, ...changes.get(Number(row.menu_id)) })));
  const slots = new Set();
  for (const row of result) {
    const slot = row.parent_id + ':' + row.menu_index;
    if (slots.has(slot)) throw new Error('Sibling menu positions must be unique.');
    slots.add(slot);
  }
  return result;
}
