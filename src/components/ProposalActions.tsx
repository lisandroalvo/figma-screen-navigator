"use client";

import { useState } from "react";
import {
  approveProposalAction,
  rejectProposalAction,
  markNeedsReviewAction,
  publishApprovedProposalAction,
} from "@/lib/actions/review-actions";

export function ProposalActions({
  proposalId,
  jobId,
  status,
  hasCollision,
}: {
  proposalId: string;
  jobId: string;
  status: string;
  hasCollision: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setLoading(true);
    setMessage(null);
    try {
      await action();
      setMessage("Action completed");
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  const canApprove = status === "pending" || status === "needs_review";
  const canReject = ["pending", "needs_review", "approved"].includes(status);
  const canMarkNeedsReview = ["pending", "approved"].includes(status);
  const canPublish = status === "approved" && !hasCollision;

  return (
    <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
      {message && (
        <p
          className={`text-sm ${
            message.includes("failed") ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <button
            type="button"
            disabled={loading}
            onClick={() => run(() => approveProposalAction(proposalId, jobId))}
            className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Approve
          </button>
        )}
        {canReject && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => rejectProposalAction(proposalId, jobId, rejectReason));
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason"
              required
              className="rounded border border-zinc-300 px-2 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          </form>
        )}
        {canMarkNeedsReview && (
          <button
            type="button"
            disabled={loading}
            onClick={() => run(() => markNeedsReviewAction(proposalId, jobId, ""))}
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            Needs review
          </button>
        )}
        {canPublish && (
          <button
            type="button"
            disabled={loading}
            onClick={() => run(() => publishApprovedProposalAction(proposalId, jobId))}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Publish
          </button>
        )}
      </div>
    </div>
  );
}
