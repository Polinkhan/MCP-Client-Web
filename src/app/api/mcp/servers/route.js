import {
  getAllMcpServerRowsForUi,
  getMcpConfigSource,
} from "@/server/mcp/load-config.js";
import { summarizeServerForUi } from "@/server/mcp/mask-config.js";
import { listMcpToolsForServer } from "@/server/mcp/client-pool.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const source = getMcpConfigSource();

  if (source.type === "empty") {
    return Response.json({
      configured: false,
      configSource: "empty",
      message:
        "No MCP configuration saved yet. Open Edit Json and save your mcpServers definition.",
      servers: [],
    });
  }

  if (source.type === "invalid") {
    return Response.json({
      configured: true,
      configSource: "invalid",
      readable: false,
      message: `Invalid JSON in database: ${source.reason}. Fix it under Edit Json.`,
      servers: [],
    });
  }

  const rows = getAllMcpServerRowsForUi();

  if (rows.length === 0) {
    return Response.json({
      configured: true,
      configSource: "database",
      readable: true,
      servers: [],
    });
  }

  const list = [];
  for (const row of rows) {
    const base = summarizeServerForUi(row.name, row.def);
    if (!row.enabled) {
      list.push({
        ...base,
        enabled: false,
        status: "disabled",
        tools: [],
      });
      continue;
    }

    try {
      const tools = await listMcpToolsForServer(row.name);
      list.push({
        ...base,
        enabled: true,
        status: "connected",
        tools: (tools ?? []).map((t) => ({
          name: t.name,
          description: (t.description || "").slice(0, 240),
        })),
      });
    } catch (e) {
      list.push({
        ...base,
        enabled: true,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        tools: [],
      });
    }
  }

  return Response.json({
    configured: true,
    configSource: "database",
    readable: true,
    servers: list,
  });
}
