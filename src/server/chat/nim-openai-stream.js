import { getNimServerConfig, getNimThinkingTemplateBody } from "./nim-config";

/**
 * @param {Record<string, unknown>} extraPayload merged after model + stream: true
 * @param {boolean | undefined} thinkingMode NIM chat_template_kwargs.enable_thinking
 */
export async function fetchNimChatStream(extraPayload, signal, thinkingMode) {
  const { chatUrl, apiKey, model } = getNimServerConfig();
  if (!chatUrl || !apiKey) {
    throw new Error(
      "NIM is not configured (set NIM_CHAT_URL and NIM_API_KEY on the server)",
    );
  }

  return fetch(chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      ...getNimThinkingTemplateBody(thinkingMode),
      ...extraPayload,
    }),
    signal,
  });
}

function mergeToolCallFragments(toolCallsDelta, acc) {
  for (const tc of toolCallsDelta) {
    const idx = tc.index ?? 0;
    if (!acc.has(idx)) {
      acc.set(idx, { id: "", name: "", arguments: "" });
    }
    const entry = acc.get(idx);
    if (tc.id) entry.id = tc.id;
    if (tc.function?.name) entry.name += tc.function.name;
    if (tc.function?.arguments != null) {
      entry.arguments += String(tc.function.arguments);
    }
  }
}

function toolAccToOpenAIFormat(acc) {
  const entries = [...acc.entries()].sort((a, b) => a[0] - b[0]);
  return entries.map(([i, v], j) => ({
    id: v.id || `call_${i}_${j}`,
    type: "function",
    function: {
      name: v.name,
      arguments: v.arguments || "{}",
    },
  }));
}

/**
 * One streaming chat completion (OpenAI-style SSE). Forwards text deltas immediately.
 * If the model streams tool calls, stops forwarding text and returns merged tool_calls.
 *
 * @param {{ onTextDelta?: (chunk: string) => void; onReasoningDelta?: (chunk: string) => void; thinkingMode?: boolean }} opts
 * @returns {Promise<{ type: "stop" } | { type: "tools"; assistantMessage: object; tool_calls: object[] }>}
 */
export async function streamOneChatRound(
  {
    messages,
    tools,
    tool_choice = "auto",
    signal,
    onTextDelta,
    onReasoningDelta,
    thinkingMode,
  },
) {
  const res = await fetchNimChatStream(
    { messages, tools, tool_choice },
    signal,
    thinkingMode,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text?.slice(0, 500) || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let lineBuffer = "";
  let sawToolFragments = false;
  const toolAcc = new Map();
  let contentBuffer = "";
  /** @type {string | null} */
  let finishReason = null;

  function handlePayload(payload) {
    if (payload === "[DONE]") {
      finishReason = finishReason || "stop";
      return;
    }

    let data;
    try {
      data = JSON.parse(payload);
    } catch {
      return;
    }

    const choice = data.choices?.[0];
    const delta = choice?.delta;
    if (choice?.finish_reason) {
      finishReason = choice.finish_reason;
    }

    if (delta?.tool_calls?.length) {
      sawToolFragments = true;
      mergeToolCallFragments(delta.tool_calls, toolAcc);
    }

    const reasoningPiece =
      (typeof delta?.reasoning_content === "string"
        ? delta.reasoning_content
        : "") ||
      (typeof delta?.reasoning === "string" ? delta.reasoning : "");
    if (reasoningPiece) {
      onReasoningDelta?.(reasoningPiece);
    }

    if (delta?.content && !sawToolFragments) {
      const piece =
        typeof delta.content === "string"
          ? delta.content
          : Array.isArray(delta.content)
            ? delta.content
                .map((p) =>
                  typeof p === "object" && p?.text ? p.text : "",
                )
                .join("")
            : "";
      if (piece) {
        contentBuffer += piece;
        onTextDelta?.(piece);
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (value) {
        lineBuffer += decoder.decode(value, { stream: true });
      }

      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        handlePayload(line.slice(5).trim());
      }

      if (done) break;
    }

    const tail = lineBuffer.trim();
    if (tail.startsWith("data:")) {
      handlePayload(tail.slice(5).trim());
    }
  } finally {
    reader.releaseLock?.();
  }

  const hasTools =
    sawToolFragments ||
    finishReason === "tool_calls" ||
    toolAcc.size > 0;

  if (hasTools) {
    const tool_calls = toolAccToOpenAIFormat(toolAcc);
    if (!tool_calls.length) {
      throw new Error(
        "Model signaled tool calls but no tool fragments could be parsed from the stream",
      );
    }
    return {
      type: "tools",
      tool_calls,
      assistantMessage: {
        role: "assistant",
        content: contentBuffer || null,
        tool_calls,
      },
    };
  }

  return { type: "stop" };
}
