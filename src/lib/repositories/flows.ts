import { eq, and, desc, or, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  flowsTable,
  flowStepsTable,
  flowInteractionsTable,
  flowHotspotsTable,
  flowGuidanceTable,
  productsTable,
  modulesTable,
  figmaPagesTable,
} from "../../../drizzle/schema";
import type {
  Flow,
  FlowStep,
  FlowInteraction,
  FlowHotspot,
  FlowGuidance,
} from "@/types/flow";

// ============================================================
// FLOWS
// ============================================================

function mapFlow(
  row: typeof flowsTable.$inferSelect,
  context?: {
    productName?: string;
    productSlug?: string;
    moduleName?: string;
    moduleSlug?: string;
    pageName?: string;
  },
): Flow {
  return {
    id: row.id,
    productId: row.productId,
    moduleId: row.moduleId,
    figmaPageId: row.figmaPageId,
    name: row.name,
    normalizedName: row.normalizedName,
    figmaFileKey: row.figmaFileKey,
    figmaSectionNodeId: row.figmaSectionNodeId,
    figmaUrl: row.figmaUrl,
    previewUrl: row.previewUrl,
    previewStoragePath: row.previewStoragePath,
    startStepId: row.startStepId,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    productName: context?.productName,
    productSlug: context?.productSlug,
    moduleName: context?.moduleName,
    moduleSlug: context?.moduleSlug,
    pageName: context?.pageName,
  };
}

export async function upsertFlow(data: {
  productId: string;
  moduleId: string;
  figmaPageId: string;
  name: string;
  normalizedName: string;
  figmaFileKey: string;
  figmaSectionNodeId: string;
  figmaUrl: string;
  status?: "draft" | "review_required" | "qa_ready" | "archived";
}): Promise<Flow> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(flowsTable)
    .where(
      and(
        eq(flowsTable.moduleId, data.moduleId),
        eq(flowsTable.figmaSectionNodeId, data.figmaSectionNodeId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(flowsTable)
      .set({
        name: data.name,
        normalizedName: data.normalizedName,
        figmaUrl: data.figmaUrl,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(flowsTable.id, existing.id))
      .returning();
    return mapFlow(updated);
  }

  const [created] = await db
    .insert(flowsTable)
    .values({
      ...data,
      status: data.status || "draft",
      lastSyncedAt: new Date(),
    })
    .returning();

  return mapFlow(created);
}

export async function getFlowById(id: string): Promise<Flow | null> {
  const db = getDb();
  const rows = await db
    .select({
      flow: flowsTable,
      product: productsTable,
      module: modulesTable,
      page: figmaPagesTable,
    })
    .from(flowsTable)
    .innerJoin(productsTable, eq(flowsTable.productId, productsTable.id))
    .innerJoin(modulesTable, eq(flowsTable.moduleId, modulesTable.id))
    .innerJoin(figmaPagesTable, eq(flowsTable.figmaPageId, figmaPagesTable.id))
    .where(eq(flowsTable.id, id))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];
  return mapFlow(r.flow, {
    productName: r.product.name,
    productSlug: r.product.slug,
    moduleName: r.module.name,
    moduleSlug: r.module.slug,
    pageName: r.page.name,
  });
}

export async function listFlows(filters?: {
  status?: "draft" | "review_required" | "qa_ready" | "archived";
  moduleId?: string;
}): Promise<Flow[]> {
  const db = getDb();

  let query = db
    .select({
      flow: flowsTable,
      product: productsTable,
      module: modulesTable,
      page: figmaPagesTable,
    })
    .from(flowsTable)
    .innerJoin(productsTable, eq(flowsTable.productId, productsTable.id))
    .innerJoin(modulesTable, eq(flowsTable.moduleId, modulesTable.id))
    .innerJoin(figmaPagesTable, eq(flowsTable.figmaPageId, figmaPagesTable.id))
    .orderBy(desc(flowsTable.createdAt));

  if (filters?.status) {
    query = query.where(eq(flowsTable.status, filters.status)) as typeof query;
  }

  if (filters?.moduleId) {
    query = query.where(eq(flowsTable.moduleId, filters.moduleId)) as typeof query;
  }

  const rows = await query;

  return rows.map((r) =>
    mapFlow(r.flow, {
      productName: r.product.name,
      productSlug: r.product.slug,
      moduleName: r.module.name,
      moduleSlug: r.module.slug,
      pageName: r.page.name,
    }),
  );
}

export async function updateFlowStatus(
  id: string,
  status: "draft" | "review_required" | "qa_ready" | "archived",
): Promise<void> {
  const db = getDb();
  await db
    .update(flowsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(flowsTable.id, id));
}

export async function updateFlowPreview(
  id: string,
  previewUrl: string,
  previewStoragePath: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(flowsTable)
    .set({ previewUrl, previewStoragePath, updatedAt: new Date() })
    .where(eq(flowsTable.id, id));
}

/**
 * Set (or clear) the explicit start step for a flow. Validates that the step
 * belongs to the flow before assigning it.
 */
export async function setFlowStartStep(
  flowId: string,
  stepId: string | null,
): Promise<void> {
  const db = getDb();

  if (stepId) {
    const [step] = await db
      .select({ id: flowStepsTable.id })
      .from(flowStepsTable)
      .where(
        and(eq(flowStepsTable.id, stepId), eq(flowStepsTable.flowId, flowId)),
      )
      .limit(1);
    if (!step) {
      throw new Error(
        `Step ${stepId} does not belong to flow ${flowId}; refusing to set as start step.`,
      );
    }
  }

  await db
    .update(flowsTable)
    .set({ startStepId: stepId, updatedAt: new Date() })
    .where(eq(flowsTable.id, flowId));
}

// ============================================================
// FLOW STEPS
// ============================================================

function mapFlowStep(row: typeof flowStepsTable.$inferSelect): FlowStep {
  return {
    id: row.id,
    flowId: row.flowId,
    figmaNodeId: row.figmaNodeId,
    name: row.name,
    normalizedName: row.normalizedName,
    displayName: row.displayName,
    stepType: row.stepType,
    previewUrl: row.previewUrl,
    previewStoragePath: row.previewStoragePath,
    figmaX: row.figmaX,
    figmaY: row.figmaY,
    figmaWidth: row.figmaWidth,
    figmaHeight: row.figmaHeight,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function upsertFlowStep(data: {
  flowId: string;
  figmaNodeId: string;
  name: string;
  normalizedName: string;
  stepType?: "screen" | "decision";
  figmaX?: number;
  figmaY?: number;
  figmaWidth?: number;
  figmaHeight?: number;
  displayOrder?: number;
}): Promise<FlowStep> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(flowStepsTable)
    .where(
      and(
        eq(flowStepsTable.flowId, data.flowId),
        eq(flowStepsTable.figmaNodeId, data.figmaNodeId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(flowStepsTable)
      .set({
        name: data.name,
        normalizedName: data.normalizedName,
        stepType: data.stepType || existing.stepType,
        figmaX: data.figmaX ?? existing.figmaX,
        figmaY: data.figmaY ?? existing.figmaY,
        figmaWidth: data.figmaWidth ?? existing.figmaWidth,
        figmaHeight: data.figmaHeight ?? existing.figmaHeight,
        displayOrder: data.displayOrder ?? existing.displayOrder,
        updatedAt: new Date(),
      })
      .where(eq(flowStepsTable.id, existing.id))
      .returning();
    return mapFlowStep(updated);
  }

  const [created] = await db
    .insert(flowStepsTable)
    .values({
      ...data,
      stepType: data.stepType || "screen",
    })
    .returning();

  return mapFlowStep(created);
}

export async function listFlowSteps(flowId: string): Promise<FlowStep[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowStepsTable)
    .where(eq(flowStepsTable.flowId, flowId))
    .orderBy(flowStepsTable.displayOrder, flowStepsTable.figmaX, flowStepsTable.figmaY);

  return rows.map(mapFlowStep);
}

export async function getFlowStep(id: string): Promise<FlowStep | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowStepsTable)
    .where(eq(flowStepsTable.id, id))
    .limit(1);

  return rows[0] ? mapFlowStep(rows[0]) : null;
}

// ============================================================
// FLOW INTERACTIONS
// ============================================================

function mapFlowInteraction(row: typeof flowInteractionsTable.$inferSelect): FlowInteraction {
  return {
    id: row.id,
    flowId: row.flowId,
    sourceStepId: row.sourceStepId,
    destinationStepId: row.destinationStepId,
    label: row.label,
    trigger: row.trigger,
    source: row.source,
    reviewStatus: row.reviewStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createInteraction(data: {
  flowId: string;
  sourceStepId: string;
  destinationStepId: string;
  label?: string | null;
  trigger: "click" | "branch" | "next";
}): Promise<FlowInteraction> {
  const db = getDb();
  const [created] = await db
    .insert(flowInteractionsTable)
    .values({
      flowId: data.flowId,
      sourceStepId: data.sourceStepId,
      destinationStepId: data.destinationStepId,
      label: data.label || null,
      trigger: data.trigger,
      source: "manual",
    })
    .returning();

  return mapFlowInteraction(created);
}

export async function listInteractionsByFlow(flowId: string): Promise<FlowInteraction[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowInteractionsTable)
    .where(eq(flowInteractionsTable.flowId, flowId));

  return rows.map(mapFlowInteraction);
}

export async function listInteractionsBySource(sourceStepId: string): Promise<FlowInteraction[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowInteractionsTable)
    .where(eq(flowInteractionsTable.sourceStepId, sourceStepId));

  return rows.map(mapFlowInteraction);
}

/** Approved outgoing edges only — the player navigates using these. */
export async function listApprovedInteractionsBySource(
  sourceStepId: string,
): Promise<FlowInteraction[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowInteractionsTable)
    .where(
      and(
        eq(flowInteractionsTable.sourceStepId, sourceStepId),
        eq(flowInteractionsTable.reviewStatus, "approved"),
      ),
    );
  return rows.map(mapFlowInteraction);
}

/** Update an interaction's destination, label, trigger, and/or review status. */
export async function updateInteraction(
  id: string,
  data: {
    destinationStepId?: string;
    label?: string | null;
    trigger?: "click" | "branch" | "next";
    reviewStatus?: "proposed" | "approved" | "rejected" | "needs_review";
  },
): Promise<void> {
  const db = getDb();
  await db
    .update(flowInteractionsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(flowInteractionsTable.id, id));
}

/** Set the human-verified display label for a step. */
export async function updateStepDisplayName(
  id: string,
  displayName: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(flowStepsTable)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(flowStepsTable.id, id));
}

export async function deleteInteraction(id: string): Promise<void> {
  const db = getDb();
  
  // Delete associated hotspots first
  await db
    .delete(flowHotspotsTable)
    .where(eq(flowHotspotsTable.interactionId, id));

  await db
    .delete(flowInteractionsTable)
    .where(eq(flowInteractionsTable.id, id));
}

// ============================================================
// FLOW HOTSPOTS
// ============================================================

function mapFlowHotspot(row: typeof flowHotspotsTable.$inferSelect): FlowHotspot {
  return {
    id: row.id,
    interactionId: row.interactionId,
    xPercent: row.xPercent / 100,
    yPercent: row.yPercent / 100,
    widthPercent: row.widthPercent / 100,
    heightPercent: row.heightPercent / 100,
    label: row.label,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createHotspot(data: {
  interactionId: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}): Promise<FlowHotspot> {
  const db = getDb();
  
  // Convert 0-1 to 0-100 for storage
  const [created] = await db
    .insert(flowHotspotsTable)
    .values({
      interactionId: data.interactionId,
      xPercent: Math.round(data.xPercent * 100),
      yPercent: Math.round(data.yPercent * 100),
      widthPercent: Math.round(data.widthPercent * 100),
      heightPercent: Math.round(data.heightPercent * 100),
    })
    .returning();

  return mapFlowHotspot(created);
}

export async function listHotspotsByInteraction(interactionId: string): Promise<FlowHotspot[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowHotspotsTable)
    .where(eq(flowHotspotsTable.interactionId, interactionId));

  return rows.map(mapFlowHotspot);
}

export async function deleteHotspot(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(flowHotspotsTable)
    .where(eq(flowHotspotsTable.id, id));
}

export async function updateFlowStepPreview(
  id: string,
  previewUrl: string,
  previewStoragePath: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(flowStepsTable)
    .set({ previewUrl, previewStoragePath, updatedAt: new Date() })
    .where(eq(flowStepsTable.id, id));
}

// ============================================================
// FLOW INTERACTIONS
// ============================================================
// FLOW GUIDANCE
// ============================================================

function mapFlowGuidance(row: typeof flowGuidanceTable.$inferSelect): FlowGuidance {
  return {
    id: row.id,
    flowId: row.flowId,
    stepId: row.stepId,
    interactionId: row.interactionId,
    decisionStepId: row.decisionStepId,
    figmaNodeId: row.figmaNodeId,
    text: row.text,
    guidanceType: row.guidanceType,
    scope: row.scope as FlowGuidance["scope"],
    category: row.category as FlowGuidance["category"],
    confidence: row.confidence,
    reviewStatus: row.reviewStatus as FlowGuidance["reviewStatus"],
    figmaX: row.figmaX,
    figmaY: row.figmaY,
    figmaWidth: row.figmaWidth,
    figmaHeight: row.figmaHeight,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function upsertFlowGuidance(data: {
  flowId: string;
  stepId?: string;
  figmaNodeId: string;
  text: string;
  guidanceType?: "guidance" | "action" | "qa_note";
}): Promise<FlowGuidance> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(flowGuidanceTable)
    .where(
      and(
        eq(flowGuidanceTable.flowId, data.flowId),
        eq(flowGuidanceTable.figmaNodeId, data.figmaNodeId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(flowGuidanceTable)
      .set({
        text: data.text,
        guidanceType: data.guidanceType || existing.guidanceType,
        stepId: data.stepId ?? existing.stepId,
        updatedAt: new Date(),
      })
      .where(eq(flowGuidanceTable.id, existing.id))
      .returning();
    return mapFlowGuidance(updated);
  }

  const [created] = await db
    .insert(flowGuidanceTable)
    .values({
      ...data,
      guidanceType: data.guidanceType || "guidance",
    })
    .returning();

  return mapFlowGuidance(created);
}

export async function listFlowGuidance(flowId: string): Promise<FlowGuidance[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowGuidanceTable)
    .where(eq(flowGuidanceTable.flowId, flowId));

  return rows.map(mapFlowGuidance);
}

export async function listStepGuidance(stepId: string): Promise<FlowGuidance[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowGuidanceTable)
    .where(eq(flowGuidanceTable.stepId, stepId));

  return rows.map(mapFlowGuidance);
}

/**
 * Update a guidance note's association and/or review status. Only association
 * metadata changes here — the original Figma `text` is never modified.
 */
export async function updateGuidanceAssociation(
  id: string,
  data: {
    scope?: FlowGuidance["scope"];
    stepId?: string | null;
    interactionId?: string | null;
    decisionStepId?: string | null;
    category?: FlowGuidance["category"];
    reviewStatus?: FlowGuidance["reviewStatus"];
  },
): Promise<void> {
  const db = getDb();
  await db
    .update(flowGuidanceTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(flowGuidanceTable.id, id));
}

/**
 * Approved guidance relevant to a single step in the player: notes on the
 * screen itself, notes on the step's outgoing interactions, and decision notes
 * anchored to the step. Rejected/proposed/needs_review notes are excluded.
 */
export async function listApprovedGuidanceForStep(
  stepId: string,
  outgoingInteractionIds: string[],
): Promise<FlowGuidance[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowGuidanceTable)
    .where(
      and(
        eq(flowGuidanceTable.reviewStatus, "approved"),
        or(
          and(
            eq(flowGuidanceTable.scope, "step"),
            eq(flowGuidanceTable.stepId, stepId),
          ),
          and(
            eq(flowGuidanceTable.scope, "decision"),
            eq(flowGuidanceTable.decisionStepId, stepId),
          ),
          outgoingInteractionIds.length > 0
            ? and(
                eq(flowGuidanceTable.scope, "interaction"),
                inArray(flowGuidanceTable.interactionId, outgoingInteractionIds),
              )
            : sql`false`,
        ),
      ),
    );

  return rows.map(mapFlowGuidance);
}
