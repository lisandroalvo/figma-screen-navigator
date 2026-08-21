"use server";

import {
  listApprovedInteractionsBySource,
  listHotspotsByInteraction,
  listApprovedGuidanceForStep,
} from "@/lib/repositories/flows";

// The player navigates using APPROVED edges only.
export async function listInteractionsBySourceAction(sourceStepId: string) {
  return listApprovedInteractionsBySource(sourceStepId);
}

export async function listHotspotsByInteractionAction(interactionId: string) {
  return listHotspotsByInteraction(interactionId);
}

export async function listApprovedGuidanceForStepAction(
  stepId: string,
  outgoingInteractionIds: string[],
) {
  return listApprovedGuidanceForStep(stepId, outgoingInteractionIds);
}
