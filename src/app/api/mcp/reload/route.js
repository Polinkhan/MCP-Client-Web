import { disconnectAllMcpClients } from "@/server/mcp/client-pool.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await disconnectAllMcpClients();
  return Response.json({ ok: true });
}
