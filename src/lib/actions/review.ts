import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  proposedChangesTable,
  auditLogsTable,
} from "../../../drizzle/schema";
import { publishApprovedScreen } from "@/lib/services/publish";

const TEMP_ACTOR = "local-design-admin";

export interface ReviewDecision {
  proposalId: string;
  decision: "approved" | "rejected" | "needs_review";
  actorId?: string;
  note?: string;
}

async function logReview(
  proposalId: string,
  action: string,
  before: string,
  after: string,
  note: string,
  actorId: string,
) {
  const db = getDb();
  await db.insert(auditLogsTable).values({
    actorUserId: actorId,
    action,
    entity: "proposed_change",
    entityId: proposalId,
    details: { previousStatus: before, newStatus: after, note },
  });
}

async function transitionProposal(
  proposalId: string,
  fromStatuses: string[],
  toStatus: string,
  actorId: string,
  note: string,
  actionName: string,
) {
  const db = getDb();
  const [proposal] = await db
    .select()
    .from(proposedChangesTable)
    .where(eq(proposedChangesTable.id, proposalId))
    .limit(1);
  if (!proposal) throw new Error("Proposal not found");
  if (!fromStatuses.includes(proposal.status)) {
    throw new Error(
      `Cannot ${actionName}: current status is ${proposal.status}`,
    );
  }

  await db
    .update(proposedChangesTable)
    .set({ status: toStatus as "pending" | "needs_review" | "approved" | "rejected" | "published" })
    .where(eq(proposedChangesTable.id, proposalId));

  await logReview(proposalId, actionName, proposal.status, toStatus, note, actorId);

  return { success: true, previousStatus: proposal.status, status: toStatus };
}

export async function approveProposal(
  proposalId: string,
  actorId = TEMP_ACTOR,
  note = "",
) {
  return transitionProposal(
    proposalId,
    ["pending", "needs_review"],
    "approved",
    actorId,
    note,
    "approve_proposal",
  );
}

export async function rejectProposal(
  proposalId: string,
  actorId = TEMP_ACTOR,
  note = "",
) {
  if (!note.trim()) throw new Error("A reason is required for rejection");
  return transitionProposal(
    proposalId,
    ["pending", "needs_review", "approved"],
    "rejected",
    actorId,
    note,
    "reject_proposal",
  );
}

export async function markNeedsReview(
  proposalId: string,
  actorId = TEMP_ACTOR,
  note = "",
) {
  return transitionProposal(
    proposalId,
    ["pending", "approved"],
    "needs_review",
    actorId,
    note,
    "mark_needs_review",
  );
}

export async function publishApprovedProposal(
  proposalId: string,
  actorId = TEMP_ACTOR,
  note = "",
) {
  const db = getDb();
  const [proposal] = await db
    .select()
    .from(proposedChangesTable)
    .where(eq(proposedChangesTable.id, proposalId))
    .limit(1);
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "approved") {
    throw new Error("Only approved proposals can be published");
  }
  if (proposal.screenId) {
    throw new Error("This proposal has already been published");
  }

  const after = (proposal.after as Record<string, unknown>) ?? {};
  if (after.sameBreakpointCollision === true) {
    throw new Error("Cannot publish a group with unresolved same-breakpoint collisions");
  }
  if (after.confidence === "low" || after.confidence === "rejected") {
    throw new Error("Cannot publish low-confidence or rejected proposals");
  }

  const screenId = await publishApprovedScreen(proposalId, actorId);

  await logReview(proposalId, "publish_proposal", "approved", "published", note, actorId);

  return { success: true, screenId, status: "published" };
}
