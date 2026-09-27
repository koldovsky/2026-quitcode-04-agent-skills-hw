import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE } from "./session";

// cache() (server-cache-react): layout, header and page each ask for the user and the workspace;
// within one request that is one query each.
export const getSessionUser = cache(async () => {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  return sessionId ? db.getUserBySession(sessionId) : null;
});

export async function getCurrentUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return user;
}

// The key is the slug string: cache() compares arguments with Object.is, so an inline { slug }
// object was a new key on every call and nothing was deduplicated.
export const getWorkspace = cache(async (slug: string) => {
  const workspace = await db.getWorkspace(slug);
  if (!workspace) throw new Error(`Workspace "${slug}" not found`);
  return workspace;
});

export async function getLeads(workspaceId: string) {
  return db.getLeads(workspaceId);
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
