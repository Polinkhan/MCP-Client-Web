import { streamOneChatRound } from "@/server/chat/nim-openai-stream.js";
import {
  buildOpenAiToolsFromMcpServers,
} from "@/server/mcp/openai-tools.js";
import {
  callMcpTool,
  splitNamespacedTool,
} from "@/server/mcp/client-pool.js";
import {
  NIM_LIST_MCP_SERVERS_FULL_NAME,
  shouldForceListMcpServersTool,
} from "@/server/mcp/host-tools.js";

const MAX_TOOL_ROUNDS = 12;

const MCP_SYSTEM_PROMPT = `You run inside this chat app with LIVE tool access (OpenAI-style function calling). Tools are available in this same request—do not claim you cannot see the user's environment, MCP setup, or local configuration.

1) nim_host__list_mcp_servers — Returns the MCP servers saved in this app (names, on/off, command). Use it whenever the user asks about the MCP server list, what MCP is configured, “check MCP servers”, or similar. This is NOT Redmine data.

2) Other tools (e.g. redmine__…) — Use for Redmine issues, projects, tickets, etc.

Rules: If the user asks about MCP configuration or listing servers, call nim_host__list_mcp_servers before answering. Never reply with generic text like “As an AI I don’t have access to your local environment” or “I cannot see your MCP servers”—those statements are false here because tools provide that data. Summarize tool output for the user.`;

/**
 * @param {{ onToolEvent?: (ev: {
 *   phase: "start" | "end";
 *   id: string;
 *   server: string;
 *   tool: string;
 *   ok?: boolean;
 *   error?: string;
 * }) => void; onAssistantTextDelta?: (chunk: string) => void; onAssistantReasoningDelta?: (chunk: string) => void; thinkingMode?: boolean }} [options]
 * @returns {Promise<string>} leftover text to stream (only if non-streaming fallback); empty when tokens were already streamed
 */
export async function runNimChatWithMcpTools(clientMessages, signal, options = {}) {
  const {
    onToolEvent,
    onAssistantTextDelta,
    onAssistantReasoningDelta,
    thinkingMode,
  } = options;
  const tools = await buildOpenAiToolsFromMcpServers();
  if (!tools.length) {
    throw new Error("No MCP tools available (check MCP servers and connectivity)");
  }

  /** @type {any[]} */
  let msgs = [
    { role: "system", content: MCP_SYSTEM_PROMPT },
    ...clientMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const lastUserText =
    [...clientMessages].reverse().find((m) => m.role === "user")?.content ??
    "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const forceList =
      round === 0 &&
      shouldForceListMcpServersTool(lastUserText) &&
      tools.some(
        (t) =>
          t.type === "function" &&
          t.function?.name === NIM_LIST_MCP_SERVERS_FULL_NAME,
      );

    const toolChoice = forceList
      ? {
          type: "function",
          function: { name: NIM_LIST_MCP_SERVERS_FULL_NAME },
        }
      : "auto";

    const outcome = await streamOneChatRound({
      messages: msgs,
      tools,
      tool_choice: toolChoice,
      signal,
      onTextDelta: onAssistantTextDelta,
      onReasoningDelta: onAssistantReasoningDelta,
      thinkingMode,
    });

    if (outcome.type === "stop") {
      return "";
    }

    const { assistantMessage, tool_calls: toolCalls } = outcome;
    msgs.push(assistantMessage);

    for (const tc of toolCalls) {
      const id = String(tc.id ?? "");
      const fullName = tc.function?.name;
      const rawArgs = tc.function?.arguments ?? "{}";
      let args = {};
      try {
        args = JSON.parse(rawArgs);
      } catch {
        args = {};
      }

      let serverName;
      let toolName;
      try {
        ({ serverName, toolName } = splitNamespacedTool(fullName));
      } catch {
        onToolEvent?.({
          phase: "start",
          id,
          server: "?",
          tool: String(fullName ?? "unknown"),
        });
        const toolText = `Tool execution failed: invalid tool name "${fullName}"`;
        onToolEvent?.({
          phase: "end",
          id,
          server: "?",
          tool: String(fullName ?? "unknown"),
          ok: false,
          error: "Invalid tool name",
        });
        msgs.push({
          role: "tool",
          tool_call_id: id,
          content: toolText,
        });
        continue;
      }

      onToolEvent?.({
        phase: "start",
        id,
        server: serverName,
        tool: toolName,
      });

      let toolText = "";
      try {
        toolText = await callMcpTool(serverName, toolName, args);
        onToolEvent?.({
          phase: "end",
          id,
          server: serverName,
          tool: toolName,
          ok: true,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        toolText = `Tool execution failed: ${errMsg}`;
        onToolEvent?.({
          phase: "end",
          id,
          server: serverName,
          tool: toolName,
          ok: false,
          error: errMsg,
        });
      }

      msgs.push({
        role: "tool",
        tool_call_id: id,
        content: toolText.slice(0, 120000),
      });
    }
  }

  const tail = "Stopped after maximum tool-call rounds.";
  onAssistantTextDelta?.(tail);
  return "";
}
