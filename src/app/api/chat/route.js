import { proxyNimUpstream } from "@/server/chat/proxy-upstream";
import { sanitizeChatMessages } from "@/server/chat/sanitize-messages";
import { isMcpConfigured } from "@/server/mcp/load-config.js";
import { sseStreamFromMcpAgent } from "@/server/chat/sse-synth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = sanitizeChatMessages(body.messages);
  if (!messages) {
    return Response.json(
      { error: "Invalid or empty messages array; last message must be user." },
      { status: 400 },
    );
  }

  const useMcp = body.useMcp !== false && isMcpConfigured();
  const thinkingMode = typeof body.thinkingMode === "boolean" ? body.thinkingMode : undefined;

  if (useMcp) {
    return new Response(sseStreamFromMcpAgent(messages, request.signal, thinkingMode), {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  return proxyNimUpstream(messages, request.signal, thinkingMode);
}
