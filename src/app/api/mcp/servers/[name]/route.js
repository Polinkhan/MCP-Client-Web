import { saveMcpConfigBody } from "@/server/db/mcp-config-repo.js";
import { disconnectAllMcpClients } from "@/server/mcp/client-pool.js";
import { readMcpConfigFile } from "@/server/mcp/load-config.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const name = decodeURIComponent(params.name ?? "");
  if (!name.trim()) {
    return Response.json({ error: "Missing server name" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const enabled = body.enabled === true;

  const root = readMcpConfigFile();
  if (!root || typeof root !== "object") {
    return Response.json(
      { error: "No valid MCP configuration in the database" },
      { status: 400 },
    );
  }

  const block = root.mcpServers ?? root.mcp_servers;
  if (!block || typeof block !== "object" || typeof block[name] !== "object") {
    return Response.json({ error: `Unknown server: ${name}` }, { status: 404 });
  }

  const entry = block[name];
  if (enabled) {
    delete entry.disabled;
  } else {
    entry.disabled = true;
  }

  saveMcpConfigBody(JSON.stringify(root, null, 2));
  await disconnectAllMcpClients();

  return Response.json({ ok: true, name, enabled });
}
