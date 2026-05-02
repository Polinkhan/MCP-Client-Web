import { getDb } from "./index.js";

/**
 * Raw JSON string from DB, or null if no row / empty body.
 */
export function getMcpConfigBodyFromDb() {
  const db = getDb();
  const row = db
    .prepare("SELECT body FROM mcp_config WHERE id = 1")
    .get();
  if (!row?.body || typeof row.body !== "string") return null;
  const t = row.body.trim();
  return t === "" ? null : row.body;
}

export function getMcpConfigMetaFromDb() {
  const db = getDb();
  return db
    .prepare("SELECT body, updated_at FROM mcp_config WHERE id = 1")
    .get();
}

/**
 * @param {string} body full JSON text
 */
export function saveMcpConfigBody(body) {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO mcp_config (id, body, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
  ).run(body, now);
}
