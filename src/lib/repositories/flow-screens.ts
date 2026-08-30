import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { flowScreensTable } from "../../../drizzle/schema";

export type FlowScreenRow = typeof flowScreensTable.$inferSelect;

export interface UpsertFlowScreenInput {
  productId: string;
  moduleId: string;
  figmaPageId: string;
  flowId: string | null;
  figmaFileKey: string;
  figmaPageNodeId: string;
  figmaSectionNodeId: string | null;
  parentSectionNodeId: string | null;
  parentSectionName: string | null;
  parentFlowNodeId: string | null;
  parentFlowName: string | null;
  figmaNodeId: string;
  figmaFrameName: string;
  name: string;
  normalizedName: string;
  figmaUrl: string;
  width: number | null;
  height: number | null;
  detectionConfidence: string;
  detectionReason: string | null;
  status: string;
  orderIndex: number | null;
}

/** Idempotent upsert of a detected Screen, keyed by (moduleId, figmaNodeId). */
export async function upsertFlowScreen(input: UpsertFlowScreenInput): Promise<FlowScreenRow> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .insert(flowScreensTable)
    .values({ ...input, lastSyncedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [flowScreensTable.moduleId, flowScreensTable.figmaNodeId],
      set: {
        productId: input.productId,
        figmaPageId: input.figmaPageId,
        flowId: input.flowId,
        figmaFileKey: input.figmaFileKey,
        figmaPageNodeId: input.figmaPageNodeId,
        figmaSectionNodeId: input.figmaSectionNodeId,
        parentSectionNodeId: input.parentSectionNodeId,
        parentSectionName: input.parentSectionName,
        parentFlowNodeId: input.parentFlowNodeId,
        parentFlowName: input.parentFlowName,
        figmaFrameName: input.figmaFrameName,
        name: input.name,
        normalizedName: input.normalizedName,
        figmaUrl: input.figmaUrl,
        width: input.width,
        height: input.height,
        detectionConfidence: input.detectionConfidence,
        detectionReason: input.detectionReason,
        status: input.status,
        orderIndex: input.orderIndex,
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return rows[0];
}

/**
 * Batched idempotent upsert of many screens in ONE round-trip (keyed by
 * (moduleId, figmaNodeId)). Lets the indexer write a whole module's screen set
 * in a single short DB operation after its Figma fetch. No-op on empty input.
 */
export async function batchUpsertFlowScreens(inputs: UpsertFlowScreenInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const db = getDb();
  const now = new Date();
  const values = inputs.map((i) => ({ ...i, lastSyncedAt: now, updatedAt: now }));
  await db
    .insert(flowScreensTable)
    .values(values)
    .onConflictDoUpdate({
      target: [flowScreensTable.moduleId, flowScreensTable.figmaNodeId],
      set: {
        productId: sql`excluded.product_id`,
        figmaPageId: sql`excluded.figma_page_id`,
        flowId: sql`excluded.flow_id`,
        figmaFileKey: sql`excluded.figma_file_key`,
        figmaPageNodeId: sql`excluded.figma_page_node_id`,
        figmaSectionNodeId: sql`excluded.figma_section_node_id`,
        parentSectionNodeId: sql`excluded.parent_section_node_id`,
        parentSectionName: sql`excluded.parent_section_name`,
        parentFlowNodeId: sql`excluded.parent_flow_node_id`,
        parentFlowName: sql`excluded.parent_flow_name`,
        figmaFrameName: sql`excluded.figma_frame_name`,
        name: sql`excluded.name`,
        normalizedName: sql`excluded.normalized_name`,
        figmaUrl: sql`excluded.figma_url`,
        width: sql`excluded.width`,
        height: sql`excluded.height`,
        detectionConfidence: sql`excluded.detection_confidence`,
        detectionReason: sql`excluded.detection_reason`,
        status: sql`excluded.status`,
        orderIndex: sql`excluded.order_index`,
        lastSyncedAt: sql`excluded.last_synced_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

/** All screens for a module (used by the pilot indexer report). */
export async function listFlowScreensByModule(moduleId: string): Promise<FlowScreenRow[]> {
  const db = getDb();
  return db
    .select()
    .from(flowScreensTable)
    .where(eq(flowScreensTable.moduleId, moduleId));
}

/** All auto-indexed (status='detected') screens, for the Navigator index. */
export async function listDetectedFlowScreens(): Promise<FlowScreenRow[]> {
  const db = getDb();
  return db
    .select()
    .from(flowScreensTable)
    .where(eq(flowScreensTable.status, "detected"));
}

/** Lookup used only by scripts/tests. */
export async function getFlowScreen(moduleId: string, figmaNodeId: string): Promise<FlowScreenRow | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(flowScreensTable)
    .where(and(eq(flowScreensTable.moduleId, moduleId), eq(flowScreensTable.figmaNodeId, figmaNodeId)));
  return rows[0];
}
