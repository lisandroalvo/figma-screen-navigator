"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import {
  approveProposal,
  rejectProposal,
  markNeedsReview,
  publishApprovedProposal,
} from "@/lib/actions/review";

export async function approveProposalAction(proposalId: string, jobId: string) {
  const { userId } = await requireAdmin();
  const result = await approveProposal(proposalId, userId);
  revalidatePath(`/admin/sync/${jobId}`);
  return result;
}

export async function rejectProposalAction(
  proposalId: string,
  jobId: string,
  note: string,
) {
  const { userId } = await requireAdmin();
  const result = await rejectProposal(proposalId, userId, note);
  revalidatePath(`/admin/sync/${jobId}`);
  return result;
}

export async function markNeedsReviewAction(
  proposalId: string,
  jobId: string,
  note: string,
) {
  const { userId } = await requireAdmin();
  const result = await markNeedsReview(proposalId, userId, note);
  revalidatePath(`/admin/sync/${jobId}`);
  return result;
}

export async function publishApprovedProposalAction(
  proposalId: string,
  jobId: string,
) {
  const { userId } = await requireAdmin();
  const result = await publishApprovedProposal(proposalId, userId);
  revalidatePath(`/admin/sync/${jobId}`);
  return result;
}
