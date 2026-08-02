import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { proposedChangesTable } from "../../../drizzle/schema";

export async function listProposedChangesByJob(jobId: string) {
  const db = getDb();
  return db
    .select()
    .from(proposedChangesTable)
    .where(eq(proposedChangesTable.syncJobId, jobId))
    .orderBy(proposedChangesTable.createdAt);
}

export async function listProposedChangesByJobAndAction(
  jobId: string,
  action: string,
) {
  const db = getDb();
  return db
    .select()
    .from(proposedChangesTable)
    .where(
      eq(proposedChangesTable.syncJobId, jobId) &&
        eq(proposedChangesTable.action, action as "new"),
    )
    .orderBy(proposedChangesTable.createdAt);
}
