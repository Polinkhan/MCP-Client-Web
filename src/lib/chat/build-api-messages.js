/** Cap turns sent upstream (similar to sliding context windows). */
export const MAX_CONTEXT_MESSAGES = 80;

/**
 * Builds OpenAI-style chat messages: prior turns + current user message.
 * Uses assistant `content` only (never thinking traces).
 */
export function buildApiMessagesForRequest(chatMessages, newUserContent) {
  const text = newUserContent.trim();
  if (!text) return [];

  const prior = chatMessages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }));

  return [...prior, { role: "user", content: text }].slice(
    -MAX_CONTEXT_MESSAGES
  );
}
