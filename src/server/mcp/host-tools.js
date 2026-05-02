import {
  getAllMcpServerRowsForUi,
  getMcpConfigSource,
} from "@/server/mcp/load-config.js";

/** Synthetic “server” name for built-in tools (not a real stdio MCP process). */
export const NIM_HOST_SERVER = "nim_host";

/** OpenAI tool name for listing app MCP servers (must match openai-tools / client-pool naming). */
export const NIM_LIST_MCP_SERVERS_FULL_NAME = "nim_host__list_mcp_servers";

/**
 * When true, the first chat round should use tool_choice to require nim_host__list_mcp_servers
 * so vague “list MCP servers” questions don’t get a generic refusal instead of a tool call.
 */
export function shouldForceListMcpServersTool(userText) {
  if (!userText || typeof userText !== "string") return false;
  const t = userText.trim().toLowerCase();
  if (t.length === 0) return false;

  // Don’t hijack clear Redmine / work-item requests.
  const looksLikeRedmineWork =
    /\b(issue|issues|ticket|tickets|bug|bugs|story|task|tasks|wiki)\b/.test(t) ||
    /\b(project|sprint|version|milestone)\b/.test(t);
  const namesRedmine =
    /\bredmine\b/.test(t) || /\b(assigned|assignee|status)\b/.test(t);
  if (looksLikeRedmineWork && namesRedmine) return false;

  if (!/\bmcp\b/.test(t) && !/model\s*context\s*protocol/.test(t)) return false;

  return /\b(list|lists|listing|check|show|see|display|what|which|how many|servers?|server\s*list|configured|configuration|setup|status|integrations?|define|tell me)\b/.test(
    t,
  );
}

const LIST_MCP_SERVERS_DESC = `Lists MCP servers configured in this chat application (names, enabled/disabled, command, args). Use this when the user asks to list MCP servers, check which MCP integrations exist, see what is configured, or asks about “the MCP server list” or “my MCP setup” in this app. This reads the app database only—it does not query Redmine or other remote MCP backends. For Redmine tickets or projects, use the Redmine MCP tools instead.`;

export function listNimHostToolDescriptors() {
  return [
    {
      name: "list_mcp_servers",
      description: LIST_MCP_SERVERS_DESC,
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ];
}

/**
 * @param {string} toolName
 * @param {Record<string, unknown>} _args
 */
export async function execNimHostTool(toolName, _args) {
  if (toolName === "list_mcp_servers") {
    const rows = getAllMcpServerRowsForUi();
    const src = getMcpConfigSource();
    const payload = {
      configSource: src.type,
      updatedAt: src.type === "database" ? src.updatedAt : undefined,
      invalidReason: src.type === "invalid" ? src.reason : undefined,
      servers: rows.map((r) => ({
        name: r.name,
        enabled: r.enabled,
        command: r.def.command,
        args: r.def.args,
        envKeys: Object.keys(r.def.env ?? {}),
        cwd: r.def.cwd ?? null,
      })),
      note: "env values are not shown; keys only. Toggle servers on the /mcp page.",
    };
    return JSON.stringify(payload, null, 2);
  }

  throw new Error(`Unknown host tool: ${toolName}`);
}
