import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE } from "./session";
import type { LeadListItem } from "./types";

// cache(): layout, header and page each ask for the user within one request.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) redirect("/login");

  const user = await db.getUserBySession(sessionId);
  if (!user) redirect("/login");

  return user;
});

// A primitive key: cache() compares arguments with Object.is, so an inline
// { slug } object would miss the cache on every call.
export const getWorkspace = cache(async (slug: string) => {
  const workspace = await db.getWorkspace(slug);
  if (!workspace) throw new Error(`Workspace "${slug}" not found`);
  return workspace;
});

export async function getLeads(workspaceId: string): Promise<LeadListItem[]> {
  const leads = await db.getLeads(workspaceId);
  return leads.map(({ id, fullName, company, status, createdAt }) => ({
    id,
    fullName,
    company,
    status,
    createdAt,
  }));
}

export async function getLeadStats(workspaceId: string) {
  return db.getLeadStats(workspaceId);
}

export async function getSourceBreakdown(workspaceId: string) {
  return db.getSourceBreakdown(workspaceId);
}

export async function getLead(id: string) {
  return db.getLead(id);
}
