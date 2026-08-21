"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createInteraction,
  deleteInteraction,
  listInteractionsByFlow,
  listInteractionsBySource,
  createHotspot,
  deleteHotspot,
  listHotspotsByInteraction,
  setFlowStartStep,
  updateGuidanceAssociation,
  updateInteraction,
  updateStepDisplayName,
} from "@/lib/repositories/flows";
import type { FlowGuidance } from "@/types/flow";

export async function updateInteractionAction(
  id: string,
  flowId: string,
  data: {
    destinationStepId?: string;
    label?: string | null;
    trigger?: "click" | "branch" | "next";
    reviewStatus?: "proposed" | "approved" | "rejected" | "needs_review";
  },
) {
  await requireAdmin();
  await updateInteraction(id, data);
  revalidatePath(`/admin/flows/${flowId}`);
  revalidatePath(`/flows/${flowId}`);
}

export async function updateStepDisplayNameAction(
  id: string,
  flowId: string,
  displayName: string,
) {
  await requireAdmin();
  await updateStepDisplayName(id, displayName);
  revalidatePath(`/admin/flows/${flowId}`);
  revalidatePath(`/flows/${flowId}`);
}

export async function updateGuidanceAssociationAction(
  id: string,
  flowId: string,
  data: {
    scope?: FlowGuidance["scope"];
    stepId?: string | null;
    interactionId?: string | null;
    decisionStepId?: string | null;
    category?: FlowGuidance["category"];
    reviewStatus?: FlowGuidance["reviewStatus"];
  },
) {
  await requireAdmin();
  await updateGuidanceAssociation(id, data);
  revalidatePath(`/admin/flows/${flowId}`);
  revalidatePath(`/flows/${flowId}`);
}

export async function setFlowStartStepAction(
  flowId: string,
  stepId: string | null,
) {
  await requireAdmin();
  await setFlowStartStep(flowId, stepId);
  revalidatePath(`/admin/flows/${flowId}`);
  revalidatePath(`/flows/${flowId}`);
}

export async function createInteractionAction(data: {
  flowId: string;
  sourceStepId: string;
  destinationStepId: string;
  label?: string | null;
  trigger: "click" | "branch" | "next";
}) {
  return createInteraction(data);
}

export async function deleteInteractionAction(id: string) {
  return deleteInteraction(id);
}

export async function listInteractionsByFlowAction(flowId: string) {
  return listInteractionsByFlow(flowId);
}

export async function listInteractionsBySourceAction(sourceStepId: string) {
  return listInteractionsBySource(sourceStepId);
}

export async function createHotspotAction(data: {
  interactionId: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}) {
  return createHotspot(data);
}

export async function deleteHotspotAction(id: string) {
  return deleteHotspot(id);
}

export async function listHotspotsByInteractionAction(interactionId: string) {
  return listHotspotsByInteraction(interactionId);
}
