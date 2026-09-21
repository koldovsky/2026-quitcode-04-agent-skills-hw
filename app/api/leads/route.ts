import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const user = sessionId ? await db.getUserBySession(sessionId) : null;
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const workspace = await db.getWorkspace(user.workspaceSlug);
  if (!workspace) {
    return Response.json({ error: "workspace not found" }, { status: 404 });
  }

  const leads = await db.getLeads(workspace.id);
  return Response.json({
    leads: leads.map((lead) => ({
      id: lead.id,
      fullName: lead.fullName,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      source: lead.source,
      createdAt: lead.createdAt,
    })),
  });
}
