/** Same-origin proxy — NVIDIA NIM credentials stay on the server (env). */

export async function postChatProxy(messages, signal, thinkingMode) {
  return fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      ...(typeof thinkingMode === "boolean" ? { thinkingMode } : {}),
    }),
    signal,
  });
}
