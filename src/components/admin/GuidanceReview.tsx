"use client";

import { useState, useTransition } from "react";
import { updateGuidanceAssociationAction } from "@/app/admin/flows/actions";
import { generateFigmaNodeUrl } from "@/lib/figma/flow-parser";
import type { FlowGuidance } from "@/types/flow";

interface Step {
  id: string;
  figmaNodeId: string;
  name: string;
}
interface Interaction {
  id: string;
  sourceStepId: string;
  destinationStepId: string;
  label: string | null;
  trigger: string;
}

const REVIEW_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  proposed: "bg-blue-100 text-blue-800",
  needs_review: "bg-amber-100 text-amber-800",
  rejected: "bg-gray-200 text-gray-600",
};

export default function GuidanceReview({
  flowId,
  figmaFileKey,
  guidance,
  steps,
  interactions,
  displayLabels,
}: {
  flowId: string;
  figmaFileKey: string;
  guidance: FlowGuidance[];
  steps: Step[];
  interactions: Interaction[];
  displayLabels: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const labelForStep = (id: string | null) => {
    if (!id) return "—";
    const s = steps.find((x) => x.id === id);
    return s ? displayLabels[s.figmaNodeId] || s.name : "—";
  };
  const labelForInteraction = (id: string | null) => {
    if (!id) return "—";
    const it = interactions.find((x) => x.id === id);
    return it ? it.label || `[${it.trigger}]` : "—";
  };

  const run = (
    id: string,
    data: Parameters<typeof updateGuidanceAssociationAction>[2],
  ) => {
    setBusyId(id);
    startTransition(async () => {
      try {
        await updateGuidanceAssociationAction(id, flowId, data);
      } finally {
        setBusyId(null);
      }
    });
  };

  const counts = guidance.reduce<Record<string, number>>((acc, g) => {
    acc[g.reviewStatus] = (acc[g.reviewStatus] ?? 0) + 1;
    return acc;
  }, {});
  const unassociated = guidance.filter(
    (g) =>
      (g.scope === "step" && !g.stepId) ||
      (g.scope === "interaction" && !g.interactionId) ||
      (g.scope === "decision" && !g.decisionStepId),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <span>Notes detected: <strong>{guidance.length}</strong></span>
        <span>Approved: <strong>{counts.approved ?? 0}</strong></span>
        <span>Proposed: <strong>{counts.proposed ?? 0}</strong></span>
        <span>Needs review: <strong>{counts.needs_review ?? 0}</strong></span>
        <span>Rejected: <strong>{counts.rejected ?? 0}</strong></span>
        <span>Unassociated: <strong>{unassociated}</strong></span>
      </div>

      <div className="space-y-3">
        {guidance.map((g) => (
          <div key={g.id} className="rounded-lg border p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${REVIEW_BADGE[g.reviewStatus] ?? "bg-gray-100"}`}
                >
                  {g.reviewStatus.replace("_", " ")}
                </span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {g.category ?? "—"}
                </span>
                <span className="text-xs text-gray-400">{g.figmaNodeId}</span>
              </div>
              <a
                href={generateFigmaNodeUrl(figmaFileKey, g.figmaNodeId)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-blue-600 hover:underline"
              >
                Open note in Figma ↗
              </a>
            </div>

            {/* Original Figma text — immutable */}
            <p className="mb-3 whitespace-pre-wrap text-sm">{g.text}</p>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="text-gray-500">Scope</label>
              <select
                defaultValue={g.scope}
                disabled={isPending && busyId === g.id}
                onChange={(e) =>
                  run(g.id, { scope: e.target.value as FlowGuidance["scope"] })
                }
                className="rounded border px-2 py-1"
              >
                <option value="flow">Flow</option>
                <option value="step">Screen</option>
                <option value="interaction">Interaction</option>
                <option value="decision">Decision</option>
              </select>

              {(g.scope === "step" || g.scope === "decision") && (
                <select
                  defaultValue={
                    (g.scope === "step" ? g.stepId : g.decisionStepId) ?? ""
                  }
                  disabled={isPending && busyId === g.id}
                  onChange={(e) =>
                    run(
                      g.id,
                      g.scope === "step"
                        ? { stepId: e.target.value || null }
                        : { decisionStepId: e.target.value || null },
                    )
                  }
                  className="rounded border px-2 py-1"
                >
                  <option value="">Select screen…</option>
                  {steps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {displayLabels[s.figmaNodeId] || s.name}
                    </option>
                  ))}
                </select>
              )}

              {g.scope === "interaction" && (
                <select
                  defaultValue={g.interactionId ?? ""}
                  disabled={isPending && busyId === g.id}
                  onChange={(e) =>
                    run(g.id, { interactionId: e.target.value || null })
                  }
                  className="rounded border px-2 py-1"
                >
                  <option value="">Select interaction…</option>
                  {interactions.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.label || `[${it.trigger}]`}
                    </option>
                  ))}
                </select>
              )}

              <span className="text-xs text-gray-500">
                → {g.scope === "interaction"
                  ? labelForInteraction(g.interactionId)
                  : labelForStep(g.scope === "decision" ? g.decisionStepId : g.stepId)}
              </span>

              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => run(g.id, { reviewStatus: "approved" })}
                  disabled={isPending && busyId === g.id}
                  className="rounded border border-green-600 px-3 py-1 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => run(g.id, { reviewStatus: "rejected" })}
                  disabled={isPending && busyId === g.id}
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
