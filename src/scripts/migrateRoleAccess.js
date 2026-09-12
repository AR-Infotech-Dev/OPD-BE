import { getDbPool, DB_PREFIX } from '../config/database.js';
import { commonRolePermissions } from '../shared/utils/rolePermissionMigration.js';
import { isSuperAdminRole } from '../shared/utils/role.utils.js';

export async function migrateRoleAccess(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS ${DB_PREFIX}role_module_access (
    access_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL, company_id INT NOT NULL, permissions JSON NOT NULL,
    created_by INT NULL, created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by INT NULL, modified_date DATETIME NULL,
    status ENUM('active','inactive','delete') NOT NULL DEFAULT 'active',
    UNIQUE KEY uq_role_company (role_id,company_id)
  ) ENGINE=InnoDB`);
  await connection.beginTransaction();
  try {
    const [menus] = await connection.query('SELECT menu_id,parent_id,is_parent,status FROM ' + DB_PREFIX + 'menu_master');
    const [rows] = await connection.query(`SELECT u.adminID,u.roleID,u.company_id,r.slug,a.permissions
      FROM ${DB_PREFIX}admin u JOIN ${DB_PREFIX}user_role_master r ON r.roleID=u.roleID
      LEFT JOIN ${DB_PREFIX}module_access a ON a.user_id=u.adminID AND a.company_id=u.company_id AND a.status='active'
      WHERE u.status='active' AND r.status='active' AND r.isDelete='N'
      AND (r.company_id=0 OR r.company_id=u.company_id)`);
    const groups = new Map();
    for (const row of rows) {
      if (isSuperAdminRole(row.slug) || !Number(row.company_id)) continue;
      const key = row.roleID + ':' + row.company_id;
      if (!groups.has(key)) groups.set(key, {roleId:row.roleID,companyId:Number(row.company_id),maps:[]});
      groups.get(key).maps.push(row.permissions);
    }
    let inserted = 0;
    for (const group of groups.values()) {
      const permissions = commonRolePermissions(group.maps,menus);
      // Reruns preserve permissions already configured for a role.
      const [result] = await connection.execute(`INSERT IGNORE INTO ${DB_PREFIX}role_module_access (role_id,company_id,permissions) VALUES (?,?,?)`,
        [group.roleId,group.companyId,JSON.stringify(permissions)]);
      inserted += result.affectedRows;
    }
    await connection.commit();
    return {groups:groups.size,inserted};
  } catch(error) {await connection.rollback();throw error;}
}
if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const pool=getDbPool(),connection=await pool.getConnection();
  try {console.log('Role access migration:',await migrateRoleAccess(connection));}
  finally {connection.release();await pool.end();}
}
