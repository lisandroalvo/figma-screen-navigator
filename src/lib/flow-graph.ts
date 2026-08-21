import type { FlowStep, FlowInteraction } from "@/types/flow";

export interface GraphValidation {
  reachable: string[]; // step ids reachable from start over approved edges
  unreachable: string[]; // step ids not reachable
  deadEnds: string[]; // reachable steps with no outgoing approved edge
  incompleteDecisions: string[]; // decision steps with fewer than 2 outgoing approved edges
}

/**
 * Compute reachability and structural issues using APPROVED edges only,
 * starting from the flow's configured start step.
 */
export function computeGraphValidation(
  steps: Pick<FlowStep, "id" | "stepType">[],
  approvedInteractions: Pick<FlowInteraction, "sourceStepId" | "destinationStepId">[],
  startStepId: string | null,
): GraphValidation {
  const outgoing = new Map<string, string[]>();
  for (const it of approvedInteractions) {
    const list = outgoing.get(it.sourceStepId) ?? [];
    list.push(it.destinationStepId);
    outgoing.set(it.sourceStepId, list);
  }

  const reachable = new Set<string>();
  if (startStepId) {
    const queue = [startStepId];
    while (queue.length) {
      const id = queue.shift()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const dst of outgoing.get(id) ?? []) queue.push(dst);
    }
  }

  const allIds = steps.map((s) => s.id);
  const unreachable = allIds.filter((id) => !reachable.has(id));

  const deadEnds = [...reachable].filter(
    (id) => (outgoing.get(id) ?? []).length === 0,
  );

  const incompleteDecisions = steps
    .filter((s) => s.stepType === "decision")
    .filter((s) => (outgoing.get(s.id) ?? []).length < 2)
    .map((s) => s.id);

  return {
    reachable: [...reachable],
    unreachable,
    deadEnds,
    incompleteDecisions,
  };
}
