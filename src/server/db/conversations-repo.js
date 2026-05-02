import { getDb } from "./index";
import { WELCOME_MESSAGE } from "@/lib/chat/welcome-message";

export function listConversations() {
  const db = getDb();
  return db
    .prepare(`SELECT id, title, updated_at FROM conversations ORDER BY updated_at DESC`)
    .all();
}

export function createConversation() {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  const insertConv = db.prepare(
    `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (@id, @title, @created_at, @updated_at)`,
  );
  const insertMsg = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, thinking, sort_order, created_at)
     VALUES (@conversation_id, @role, @content, @thinking, @sort_order, @created_at)`,
  );

  const tx = db.transaction(() => {
    insertConv.run({
      id,
      title: "New chat",
      created_at: now,
      updated_at: now,
    });
    insertMsg.run({
      conversation_id: id,
      role: "assistant",
      content: WELCOME_MESSAGE,
      thinking: "",
      sort_order: 0,
      created_at: now,
    });
  });
  tx();

  return id;
}

export function getConversation(conversationId) {
  const db = getDb();
  const conversation = db
    .prepare(`SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?`)
    .get(conversationId);
  if (!conversation) return null;

  const messages = db
    .prepare(
      `SELECT role, content, thinking FROM messages WHERE conversation_id = ? ORDER BY sort_order ASC`,
    )
    .all(conversationId);

  return { conversation, messages };
}

export function appendMessage(conversationId, role, content, thinking = "") {
  const db = getDb();
  const now = Date.now();
  const row = db
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM messages WHERE conversation_id = ?`)
    .get(conversationId);
  const sort_order = row.m + 1;

  db.prepare(
    `INSERT INTO messages (conversation_id, role, content, thinking, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(conversationId, role, content, thinking ?? "", sort_order, now);

  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, conversationId);
}

export function updateConversationTitle(conversationId, title) {
  const db = getDb();
  const trimmed = String(title).trim().slice(0, 120);
  if (!trimmed) return false;
  const r = db
    .prepare(`UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`)
    .run(trimmed, Date.now(), conversationId);
  return r.changes > 0;
}

export function deleteConversation(conversationId) {
  const db = getDb();
  const r = db.prepare(`DELETE FROM conversations WHERE id = ?`).run(conversationId);
  return r.changes > 0;
}
