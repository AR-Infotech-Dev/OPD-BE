import crypto from "crypto";
import { DB_PREFIX, query } from "#config/database.js";

let ensuredActiveSessionColumn = false;
let ensureActiveSessionColumnPromise = null;

export function createActiveSessionId() {
  return crypto.randomUUID();
}

export async function ensureActiveSessionColumn() {
  if (ensuredActiveSessionColumn) {
    return;
  }

  if (!ensureActiveSessionColumnPromise) {
    ensureActiveSessionColumnPromise = (async () => {
      const rows = await query(`SHOW COLUMNS FROM ${DB_PREFIX}users LIKE 'active_session_id'`);

      if (!rows.length) {
        await query(`ALTER TABLE ${DB_PREFIX}users ADD COLUMN active_session_id VARCHAR(64) NULL`);
      }

      ensuredActiveSessionColumn = true;
    })();
  }

  return ensureActiveSessionColumnPromise;
}

export async function setActiveSessionId(user_id, activeSessionId, isMobile = false) {
  await ensureActiveSessionColumn();

  if (isMobile) {
    return query(
      `UPDATE ${DB_PREFIX}users SET active_session_id_mob = ?, modified_date = NOW() WHERE user_id = ?`,
      [activeSessionId, user_id]
    );
  }

  return query(
    `UPDATE ${DB_PREFIX}users SET active_session_id = ?, modified_date = NOW() WHERE user_id = ?`,
    [activeSessionId, user_id]
  );
}

export async function getActiveSessionId(user_id,isMobile = false) {
  const rows = await query(
    isMobile 
    ?`SELECT active_session_id_mob as active_session_id FROM ${DB_PREFIX}users WHERE user_id = ? LIMIT 1`
    :`SELECT active_session_id as active_session_id FROM ${DB_PREFIX}users WHERE user_id = ? LIMIT 1`,
    [user_id]
  );

  return rows[0]?.active_session_id || null;
}
