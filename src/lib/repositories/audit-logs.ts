import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { auditLogsTable } from "../../../drizzle/schema";

export async function listRecentAuditLogs() {
  const db = getDb();
  return db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(100);
}
