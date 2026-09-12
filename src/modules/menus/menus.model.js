import { getDbPool, DB_PREFIX } from '#config/database.js';
import { getActiveDb } from '#config/db.context.js';
import { isParent, validateHierarchy, normalizePositions } from './menuHierarchy.js';
const table = '`' + DB_PREFIX + 'menu_master`';
const invalid = message => Object.assign(new Error(message), {status: 400});
async function transaction(fn) {
  const connection = await (getActiveDb() || getDbPool()).getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM ' + table + ' ORDER BY menu_id FOR UPDATE');
    const result = await fn(connection, rows);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
export const saveMenu = (data, id = null) => transaction(async (connection, rows) => {
  const existing = id ? rows.find(row => Number(row.menu_id) === Number(id)) : null;
  if (id && !existing) throw Object.assign(new Error('Menu not found.'), {status: 404});
  const next = {...existing, ...data};
  if (data.is_parent !== undefined && ![true, false, 1, 0, '1', '0', 'true', 'false', 'yes', 'no'].includes(data.is_parent)) {
    throw invalid('Parent menu must be true or false.');
  }
  next.is_parent = isParent(next.is_parent) ? 1 : 0;
  const parent = Number(next.parent_id || 0);
  if (!Number.isSafeInteger(parent) || parent < 0) throw invalid('Invalid parent menu.');
  next.parent_id = parent || null;
  if (next.is_parent) {
    next.menu_link = ''; next.table_name = ''; next.module_name = null;
    next.label = null; next.plural_label = null;
  } else {
    for (const key of ['menu_link', 'table_name', 'module_name']) {
      if (!String(next[key] || '').trim()) throw invalid(key.replaceAll('_', ' ') + ' is required for a regular menu.');
    }
  }
  const candidateId = existing?.menu_id || Math.max(0, ...rows.map(row => Number(row.menu_id))) + 1;
  try { validateHierarchy([...rows.filter(row => Number(row.menu_id) !== Number(candidateId)), {...next, menu_id: candidateId}]); }
  catch (error) { throw invalid(error.message); }
  const write = {...data, is_parent: next.is_parent, parent_id: next.parent_id};
  if (next.is_parent) Object.assign(write, {menu_link: '', table_name: '', module_name: null, label: null, plural_label: null});
  if (!existing || Number(existing.parent_id || 0) !== parent) {
    write.menu_index = Math.max(0, ...rows.filter(row => Number(row.parent_id || 0) === parent).map(row => Number(row.menu_index) || 0)) + 1;
  }
  const keys = Object.keys(write);
  const sql = existing
    ? 'UPDATE ' + table + ' SET ' + keys.map(key => '`' + key + '` = ?').join(', ') + ' WHERE menu_id = ?'
    : 'INSERT INTO ' + table + ' (' + keys.map(key => '`' + key + '`').join(', ') + ') VALUES (' + keys.map(() => '?').join(', ') + ')';
  const [result] = await connection.execute(sql, [...Object.values(write), ...(existing ? [id] : [])]);
  return result;
});
export const savePositions = (positions, userId) => transaction(async (connection, rows) => {
  let normalized;
  try { normalized = normalizePositions(positions, rows); } catch(error) { throw invalid(error.message); }
  for (const row of normalized) {
    await connection.execute('UPDATE ' + table + ' SET parent_id = ?, menu_index = ?, modified_by = ?, modified_date = CURRENT_TIMESTAMP WHERE menu_id = ?',
      [row.parent_id, row.menu_index, userId, row.menu_id]);
  }
});
export const deleteMenus = ids => transaction(async (connection, rows) => {
  const selected = new Set(ids.map(Number));
  if ([...selected].some(id => !Number.isSafeInteger(id) || id <= 0)) throw invalid('Invalid menu IDs.');
  if (rows.some(row => selected.has(Number(row.parent_id)) && !selected.has(Number(row.menu_id)))) {
    throw invalid('Move or delete the child menus before deleting this parent.');
  }
  await connection.execute('DELETE FROM ' + table + ' WHERE menu_id IN (' + [...selected].map(() => '?').join(',') + ')', [...selected]);
});
