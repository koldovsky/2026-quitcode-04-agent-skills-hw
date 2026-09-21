import { db } from "./db";

export async function logAudit(action: string, leadId: string) {
  await db.insertAuditEntry({ action, leadId, at: new Date().toISOString() });
}
