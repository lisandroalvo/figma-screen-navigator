"use client";

import { useState, useTransition } from "react";
import { updateInteractionAction } from "@/app/admin/flows/actions";

interface Step {
  id: string;
  figmaNodeId: string;
  name: string;
  displayName?: string | null;
  stepType: string;
}
interface Interaction {
  id: string;
  sourceStepId: string;
  destinationStepId: string;
  label: string | null;
  trigger: string;
  reviewStatus: string | null;
}

const BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  proposed: "bg-blue-100 text-blue-800",
  needs_review: "bg-amber-100 text-amber-800",
  rejected: "bg-gray-200 text-gray-600",
};

export default function GraphReview({
  flowId,
  steps,
  interactions,
  hotspotCountByInteraction,
}: {
  flowId: string;
  steps: Step[];
  interactions: Interaction[];
  hotspotCountByInteraction: Record<string, number>;
}) {
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const label = (id: string) => {
    const s = steps.find((x) => x.id === id);
    return s ? s.displayName || s.name : "[unknown]";
  };

  const run = (
    id: string,
    data: Parameters<typeof updateInteractionAction>[2],
  ) => {
    setBusyId(id);
    startTransition(async () => {
      try {
        await updateInteractionAction(id, flowId, data);
      } finally {
        setBusyId(null);
      }
    });
  };

  const counts = interactions.reduce<Record<string, number>>((acc, i) => {
    const k = i.reviewStatus ?? "proposed";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  // Approved click edges lacking a mapped hotspot
  const clickNoHotspot = interactions.filter(
    (i) =>
      i.reviewStatus === "approved" &&
      i.trigger === "click" &&
      !(hotspotCountByInteraction[i.id] > 0),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <span>Edges: <strong>{interactions.length}</strong></span>
        <span>Approved: <strong>{counts.approved ?? 0}</strong></span>
        <span>Proposed: <strong>{counts.proposed ?? 0}</strong></span>
        <span>Needs review: <strong>{counts.needs_review ?? 0}</strong></span>
        <span>Rejected: <strong>{counts.rejected ?? 0}</strong></span>
        <span>Approved click edges without hotspot: <strong>{clickNoHotspot}</strong></span>
      </div>

      <div className="space-y-3">
        {interactions.map((it) => (
          <div key={it.id} className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${BADGE[it.reviewStatus ?? "proposed"] ?? "bg-gray-100"}`}>
                {(it.reviewStatus ?? "proposed").replace("_", " ")}
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs uppercase text-gray-600">
                {it.trigger}
              </span>
              {it.trigger === "click" && (
                <span className="text-xs text-gray-500">
                  {hotspotCountByInteraction[it.id] > 0
                    ? `${hotspotCountByInteraction[it.id]} hotspot(s)`
                    : "no hotspot"}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{label(it.sourceStepId)}</span>
              <span className="text-gray-400">
                — {it.label || "(no action label)"} →
              </span>
              {/* Editable destination */}
              <select
                defaultValue={it.destinationStepId}
                disabled={isPending && busyId === it.id}
                onChange={(e) => run(it.id, { destinationStepId: e.target.value })}
                className="rounded border px-2 py-1"
              >
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName || s.name}
                    {s.stepType === "decision" ? " ◇" : ""}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => run(it.id, { reviewStatus: "approved" })}
                  disabled={isPending && busyId === it.id}
                  className="rounded border border-green-600 px-3 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => run(it.id, { reviewStatus: "rejected" })}
                  disabled={isPending && busyId === it.id}
                  className="rounded border border-gray-400 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
