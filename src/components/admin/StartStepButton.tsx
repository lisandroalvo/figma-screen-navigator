"use client";

import { useState, useTransition } from "react";
import { setFlowStartStepAction } from "@/app/admin/flows/actions";

export default function StartStepButton({
  flowId,
  stepId,
  isStart,
}: {
  flowId: string;
  stepId: string;
  isStart: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isStart) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-xs font-semibold uppercase text-green-800">
        ★ Start screen
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setFlowStartStepAction(flowId, stepId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to set start");
            }
          });
        }}
        disabled={isPending}
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
      >
        {isPending ? "Setting…" : "Set as start"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
