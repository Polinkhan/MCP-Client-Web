const MAX_MESSAGES = 80;

/** Keeps only user/assistant pairs with non-empty string content (server-side guard). */
export function sanitizeChatMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const out = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role =
      m.role === "user"
        ? "user"
        : m.role === "assistant"
          ? "assistant"
          : null;
    const content =
      typeof m.content === "string" ? m.content.trim().slice(0, 32000) : "";
    if (!role || !content) continue;
    out.push({ role, content });
  }

  if (out.length === 0) return null;

  const trimmed = out.slice(-MAX_MESSAGES);
  const last = trimmed[trimmed.length - 1];
  if (last.role !== "user") return null;

  return trimmed;
}
