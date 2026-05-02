import { listConversations, createConversation } from "@/server/db/conversations-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = listConversations();
    return Response.json(rows);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const id = createConversation();
    return Response.json({ id });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
