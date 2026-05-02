import { getNimServerConfig } from "./nim-config";

/** Non-streaming chat completion (needed for MCP / tool-call rounds). */
export async function nimChatCompletionJson(payload, signal) {
  const { chatUrl, apiKey, model } = getNimServerConfig();

  if (!chatUrl || !apiKey) {
    throw new Error(
      "NIM is not configured (set NIM_CHAT_URL and NIM_API_KEY on the server)",
    );
  }

  const res = await fetch(chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      ...payload,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text?.slice(0, 500) || `HTTP ${res.status}`);
  }

  return res.json();
}
