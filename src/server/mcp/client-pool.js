import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  execNimHostTool,
  listNimHostToolDescriptors,
  NIM_HOST_SERVER,
} from "./host-tools.js";
import { getMcpStdioServers } from "./load-config.js";

/** @type {Map<string, { client: Client; transport: StdioClientTransport }>} */
const pool = new Map();

export async function disconnectAllMcpClients() {
  for (const [, entry] of pool) {
    try {
      await entry.client.close();
    } catch {
      /* ignore */
    }
  }
  pool.clear();
}

async function connectOne(serverName, def) {
  if (pool.has(serverName)) return pool.get(serverName);

  const transport = new StdioClientTransport({
    command: def.command,
    args: def.args ?? [],
    env: { ...process.env, ...def.env },
    cwd: def.cwd,
  });

  const client = new Client({ name: "nim-gpt-ui", version: "1.0.0" }, {});
  await client.connect(transport);
  const entry = { client, transport };
  pool.set(serverName, entry);
  return entry;
}

export async function getMcpClient(serverName) {
  if (serverName === NIM_HOST_SERVER) {
    throw new Error(`${NIM_HOST_SERVER} is not a stdio MCP process`);
  }
  const servers = getMcpStdioServers();
  if (!servers?.[serverName]) {
    throw new Error(`Unknown MCP server: ${serverName}`);
  }
  const def = servers[serverName];
  return (await connectOne(serverName, def)).client;
}

export async function listMcpToolsForServer(serverName) {
  if (serverName === NIM_HOST_SERVER) {
    return listNimHostToolDescriptors();
  }
  const client = await getMcpClient(serverName);
  const { tools } = await client.listTools();
  return tools ?? [];
}

function toolResultToText(result) {
  if (!result) return "";
  if (result.isError) {
    const parts = result.content ?? [];
    return parts.map((c) => (c.type === "text" ? c.text : JSON.stringify(c))).join("\n") || "Tool error";
  }
  const parts = result.content ?? [];
  return parts
    .map((c) => {
      if (c.type === "text") return c.text;
      return JSON.stringify(c);
    })
    .join("\n");
}

export async function callMcpTool(serverName, toolName, args) {
  if (serverName === NIM_HOST_SERVER) {
    return execNimHostTool(toolName, args ?? {});
  }
  const client = await getMcpClient(serverName);
  const result = await client.callTool({
    name: toolName,
    arguments: args ?? {},
  });
  return toolResultToText(result);
}

export const TOOL_NAME_SEP = "__";

export function splitNamespacedTool(fullName) {
  const sep = TOOL_NAME_SEP;
  const i = fullName.indexOf(sep);
  if (i <= 0) {
    throw new Error(`Invalid tool name (expected server${sep}tool): ${fullName}`);
  }
  return {
    serverName: fullName.slice(0, i),
    toolName: fullName.slice(i + sep.length),
  };
}
