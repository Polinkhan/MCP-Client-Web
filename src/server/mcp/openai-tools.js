import { getMcpStdioServers } from "./load-config.js";
import { listMcpToolsForServer, TOOL_NAME_SEP } from "./client-pool.js";
import { NIM_HOST_SERVER, listNimHostToolDescriptors } from "./host-tools.js";

function buildHostOpenAiTools() {
  return listNimHostToolDescriptors().map((t) => ({
    type: "function",
    function: {
      name: `${NIM_HOST_SERVER}${TOOL_NAME_SEP}${t.name}`,
      description: (t.description || t.name).slice(0, 8000),
      parameters:
        t.inputSchema && typeof t.inputSchema === "object"
          ? t.inputSchema
          : { type: "object", properties: {} },
    },
  }));
}

export async function buildOpenAiToolsFromMcpServers() {
  const hostTools = buildHostOpenAiTools();
  const servers = getMcpStdioServers();

  if (!servers) {
    return hostTools;
  }

  const mcpTools = [];
  const failures = [];
  for (const serverName of Object.keys(servers)) {
    try {
      const mcpToolsList = await listMcpToolsForServer(serverName);
      for (const t of mcpToolsList) {
        mcpTools.push({
          type: "function",
          function: {
            name: `${serverName}${TOOL_NAME_SEP}${t.name}`,
            description: (t.description || t.title || `${t.name}`).slice(0, 8000),
            parameters:
              t.inputSchema && typeof t.inputSchema === "object"
                ? t.inputSchema
                : { type: "object", properties: {} },
          },
        });
      }
      if (!mcpToolsList?.length) {
        failures.push({
          serverName,
          message: "connected but listed zero tools",
        });
      }
    } catch (e) {
      failures.push({
        serverName,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const combined = [...hostTools, ...mcpTools];
  if (combined.length === 0 && Object.keys(servers).length > 0) {
    const detail = failures.map((f) => `${f.serverName}: ${f.message}`).join("; ");
    throw new Error(
      `No MCP tools could be loaded. Check API keys in your MCP JSON (Edit Json on /mcp) and server connectivity. Details: ${detail}`,
    );
  }

  return combined;
}
