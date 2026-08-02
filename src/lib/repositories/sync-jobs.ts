import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { syncJobsTable } from "../../../drizzle/schema";

export async function listSyncJobs() {
  const db = getDb();
  return db
    .select()
    .from(syncJobsTable)
    .orderBy(desc(syncJobsTable.startedAt))
    .limit(20);
}

export async function getSyncJobById(id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(syncJobsTable)
    .where(eq(syncJobsTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}
