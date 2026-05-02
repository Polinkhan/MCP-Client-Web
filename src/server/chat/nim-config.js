const FALLBACK_MODEL = "meta/llama-3.1-8b-instruct";

/**
 * NVIDIA NIM (vLLM) reasoning-style output: some models honor
 * `chat_template_kwargs.enable_thinking`. Set NIM_THINKING_PARAMS=0 to omit
 * this if your deployment returns 400 on unknown fields.
 * @param {boolean | undefined} thinkingMode true = extended thinking, false = direct
 */
export function getNimThinkingTemplateBody(thinkingMode) {
  if (process.env.NIM_THINKING_PARAMS === "0") return {};
  if (typeof thinkingMode !== "boolean") return {};
  return {
    chat_template_kwargs: { enable_thinking: thinkingMode },
  };
}

export function getNimServerConfig() {
  const chatUrl = process.env.NIM_CHAT_URL?.trim();
  const apiKey = process.env.NIM_API_KEY?.trim();
  const model = process.env.NIM_MODEL?.trim() || FALLBACK_MODEL;
  return { chatUrl, apiKey, model };
}

export function nimConfigErrorResponse() {
  return Response.json(
    {
      error:
        "Server is not configured. Set NIM_CHAT_URL and NIM_API_KEY in the environment.",
    },
    { status: 503 }
  );
}
