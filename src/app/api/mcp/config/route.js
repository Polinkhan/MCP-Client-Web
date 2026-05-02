import {
  getMcpConfigBodyFromDb,
  getMcpConfigMetaFromDb,
  saveMcpConfigBody,
} from "@/server/db/mcp-config-repo.js";
import { disconnectAllMcpClients } from "@/server/mcp/client-pool.js";
import { getMcpConfigSource } from "@/server/mcp/load-config.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEditorJsonText() {
  const dbBody = getMcpConfigBodyFromDb();
  if (dbBody != null && dbBody.trim() !== "") {
    return dbBody;
  }
  return JSON.stringify({ mcpServers: {} }, null, 2);
}

export async function GET() {
  const source = getMcpConfigSource();
  const json = getEditorJsonText();
  return Response.json({
    json,
    source: source.type,
    updatedAt:
      source.type === "database" ? source.updatedAt : undefined,
    invalidReason: source.type === "invalid" ? source.reason : undefined,
  });
}

export async function PUT(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.json === "string" ? body.json : "";
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json(
        { error: "Root value must be a JSON object" },
        { status: 400 },
      );
    }
    const block = parsed.mcpServers ?? parsed.mcp_servers;
    if (block != null && typeof block !== "object") {
      return Response.json(
        { error: "mcpServers must be an object" },
        { status: 400 },
      );
    }
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid JSON" },
      { status: 400 },
    );
  }

  saveMcpConfigBody(text);
  await disconnectAllMcpClients();

  const meta = getMcpConfigMetaFromDb();
  return Response.json({
    ok: true,
    source: "database",
    updatedAt: meta?.updated_at ?? Date.now(),
  });
}
