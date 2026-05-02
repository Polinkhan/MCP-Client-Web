import {
  getNimServerConfig,
  getNimThinkingTemplateBody,
  nimConfigErrorResponse,
} from "./nim-config";

/**
 * Proxies streaming chat completions to NVIDIA NIM using server env only.
 * @param {boolean | undefined} thinkingMode forwarded when set (see getNimThinkingTemplateBody)
 */
export async function proxyNimUpstream(messages, signal, thinkingMode) {
  const { chatUrl, apiKey, model } = getNimServerConfig();

  if (!chatUrl || !apiKey) {
    return nimConfigErrorResponse();
  }

  const upstream = await fetch(chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...getNimThinkingTemplateBody(thinkingMode),
    }),
    signal,
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new Response(text || upstream.statusText, {
      status: upstream.status,
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") || "text/event-stream",
    },
  });
}
