import {
  getConversation,
  deleteConversation,
  updateConversationTitle,
} from "@/server/db/conversations-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const data = getConversation(params.id);
    if (!data) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(data);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = body.title;
    if (typeof title !== "string") {
      return Response.json({ error: "Missing title" }, { status: 400 });
    }
    const ok = updateConversationTitle(params.id, title);
    if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const ok = deleteConversation(params.id);
    if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
