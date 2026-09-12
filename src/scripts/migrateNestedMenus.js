import { query, DB_PREFIX, getDbPool } from '../config/database.js';
// Additive and safe to rerun; existing menus remain at the root.
try {
  const table = '`' + DB_PREFIX + 'menu_master`';
  const columns = new Set((await query('SHOW COLUMNS FROM ' + table)).map(row => row.Field));
  const additions = [];
  if (!columns.has('is_parent')) additions.push('ADD COLUMN is_parent TINYINT(1) NOT NULL DEFAULT 0');
  if (!columns.has('parent_id')) additions.push('ADD COLUMN parent_id INT NULL DEFAULT NULL', 'ADD INDEX idx_menu_parent_order (parent_id, menu_index)');
  if (additions.length) await query('ALTER TABLE ' + table + ' ' + additions.join(', '));
  console.log('Nested menu schema is ready.');
} finally { await getDbPool().end(); }
