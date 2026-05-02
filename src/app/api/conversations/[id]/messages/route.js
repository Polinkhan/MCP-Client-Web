import { appendMessage, getConversation } from "@/server/db/conversations-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const existing = getConversation(params.id);
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.role !== "string" || typeof body.content !== "string") {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const role = body.role === "assistant" ? "assistant" : "user";
    const thinking =
      typeof body.thinking === "string" ? body.thinking : "";

    appendMessage(params.id, role, body.content, thinking);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
