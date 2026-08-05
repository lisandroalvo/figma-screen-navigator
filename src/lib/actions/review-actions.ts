"use server";

import { revalidatePath } from "next/cache";
import {
  approveProposal,
  rejectProposal,
  markNeedsReview,
  publishApprovedProposal,
} from "@/lib/actions/review";

export async function approveProposalAction(proposalId: string, jobId: string) {
  const result = await approveProposal(proposalId);
  revalidatePath(`/admin/sync/${jobId}`);
  return result;
}

export async function rejectProposalAction(proposalId: string, jobId: string, note: string) {
  const result = await rejectProposal(proposalId, undefined, note);
  revalidatePath(`/admin/sync/${jobId}`);
  return result;
}

export async function markNeedsReviewAction(proposalId: string, jobId: string, note: string) {
  const result = await markNeedsReview(proposalId, undefined, note);
  revalidatePath(`/admin/sync/${jobId}`);
  return result;
}

export async function publishApprovedProposalAction(proposalId: string, jobId: string) {
  const result = await publishApprovedProposal(proposalId);
  revalidatePath(`/admin/sync/${jobId}`);
  return result;
}
