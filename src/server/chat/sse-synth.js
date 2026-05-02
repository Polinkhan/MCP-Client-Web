import { runNimChatWithMcpTools } from "@/server/mcp/nim-mcp-agent.js";

/**
 * MCP agent + SSE: MCP tool events, then **live** OpenAI-style token deltas from NIM streaming.
 * @param {boolean | undefined} thinkingMode passed to NIM (chat_template_kwargs.enable_thinking)
 */
export function sseStreamFromMcpAgent(clientMessages, signal, thinkingMode) {
  const encoder = new TextEncoder();

  const line = (obj) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  return new ReadableStream({
    async start(controller) {
      try {
        await runNimChatWithMcpTools(clientMessages, signal, {
          thinkingMode,
          onToolEvent: (ev) => {
            if (ev.phase === "start") {
              controller.enqueue(
                line({
                  mcp: {
                    event: "start",
                    id: ev.id,
                    server: ev.server,
                    tool: ev.tool,
                  },
                }),
              );
            } else {
              controller.enqueue(
                line({
                  mcp: {
                    event: "end",
                    id: ev.id,
                    server: ev.server,
                    tool: ev.tool,
                    ok: ev.ok !== false,
                    ...(ev.error ? { error: ev.error } : {}),
                  },
                }),
              );
            }
          },
          onAssistantTextDelta: (text) => {
            if (!text) return;
            const payload = JSON.stringify({
              choices: [{ index: 0, delta: { content: text } }],
            });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          },
          onAssistantReasoningDelta: (text) => {
            if (!text) return;
            const payload = JSON.stringify({
              choices: [{ index: 0, delta: { reasoning_content: text } }],
            });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          },
        });

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ stream_error: { message: msg } })}\n\n`),
          );
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch {
          controller.error(e);
        }
      }
    },
  });
}

/**
 * Turns a completed assistant string into an OpenAI-style SSE stream so the
 * browser can reuse consume-nim-stream.
 */
export function sseStreamFromText(text) {
  const encoder = new TextEncoder();
  const safe = typeof text === "string" ? text : String(text ?? "");
  const chunkSize = 48;
  let i = 0;

  return new ReadableStream({
    pull(controller) {
      if (i >= safe.length) {
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
        return;
      }
      const piece = safe.slice(i, i + chunkSize);
      i += chunkSize;
      const payload = JSON.stringify({
        choices: [{ index: 0, delta: { content: piece } }],
      });
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
    },
  });
}
