import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { flowSectionsTable } from "../../../drizzle/schema";

export type FlowSectionRow = typeof flowSectionsTable.$inferSelect;

export interface UpsertFlowSectionInput {
  productId: string;
  moduleId: string;
  figmaPageId: string;
  figmaFileKey: string;
  figmaPageNodeId: string;
  figmaNodeId: string;
  parentNodeId: string | null;
  parentName: string | null;
  parentFlowNodeId: string | null;
  parentFlowName: string | null;
  name: string;
  normalizedName: string;
  figmaUrl: string;
  depth: number | null;
  isFlowContainer: boolean;
  status: string;
}

/** Idempotent upsert of a searchable SECTION, keyed by (moduleId, figmaNodeId). */
export async function upsertFlowSection(input: UpsertFlowSectionInput): Promise<FlowSectionRow> {
  const db = getDb();
  const now = new Date();
  const rows = await db
    .insert(flowSectionsTable)
    .values({ ...input, lastSyncedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [flowSectionsTable.moduleId, flowSectionsTable.figmaNodeId],
      set: {
        productId: input.productId,
        figmaPageId: input.figmaPageId,
        figmaFileKey: input.figmaFileKey,
        figmaPageNodeId: input.figmaPageNodeId,
        parentNodeId: input.parentNodeId,
        parentName: input.parentName,
        parentFlowNodeId: input.parentFlowNodeId,
        parentFlowName: input.parentFlowName,
        name: input.name,
        normalizedName: input.normalizedName,
        figmaUrl: input.figmaUrl,
        depth: input.depth,
        isFlowContainer: input.isFlowContainer,
        status: input.status,
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return rows[0];
}

/**
 * Batched idempotent upsert of many sections in ONE round-trip (keyed by
 * (moduleId, figmaNodeId)). Used by the indexer so a module's full section set
 * is written in a single short DB operation after its Figma fetch — never one
 * round-trip per section. No-op on empty input.
 */
export async function batchUpsertFlowSections(inputs: UpsertFlowSectionInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const db = getDb();
  const now = new Date();
  const values = inputs.map((i) => ({ ...i, lastSyncedAt: now, updatedAt: now }));
  await db
    .insert(flowSectionsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [flowSectionsTable.moduleId, flowSectionsTable.figmaNodeId],
      set: {
        productId: sql`excluded.product_id`,
        figmaPageId: sql`excluded.figma_page_id`,
        figmaFileKey: sql`excluded.figma_file_key`,
        figmaPageNodeId: sql`excluded.figma_page_node_id`,
        parentNodeId: sql`excluded.parent_node_id`,
        parentName: sql`excluded.parent_name`,
        parentFlowNodeId: sql`excluded.parent_flow_node_id`,
        parentFlowName: sql`excluded.parent_flow_name`,
        name: sql`excluded.name`,
        normalizedName: sql`excluded.normalized_name`,
        figmaUrl: sql`excluded.figma_url`,
        depth: sql`excluded.depth`,
        isFlowContainer: sql`excluded.is_flow_container`,
        status: sql`excluded.status`,
        lastSyncedAt: sql`excluded.last_synced_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

/** All auto-indexed (status='detected') sections, for the Navigator index. */
export async function listDetectedFlowSections(): Promise<FlowSectionRow[]> {
  const db = getDb();
  return db
    .select()
    .from(flowSectionsTable)
    .where(eq(flowSectionsTable.status, "detected"));
}

/** All sections for a module (used by the pilot indexer report). */
export async function listFlowSectionsByModule(moduleId: string): Promise<FlowSectionRow[]> {
  const db = getDb();
  return db.select().from(flowSectionsTable).where(eq(flowSectionsTable.moduleId, moduleId));
}
