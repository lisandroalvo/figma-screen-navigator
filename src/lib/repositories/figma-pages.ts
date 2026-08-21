import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { figmaPagesTable } from "../../../drizzle/schema";
import type { FigmaPage } from "@/types";

function mapFigmaPage(row: typeof figmaPagesTable.$inferSelect): FigmaPage {
  return {
    id: row.id,
    moduleId: row.moduleId,
    figmaNodeId: row.figmaNodeId,
    name: row.name,
    normalizedName: row.normalizedName,
    orderIndex: row.orderIndex,
    isSearchable: row.isSearchable,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPages(): Promise<FigmaPage[]> {
  const db = getDb();
  const rows = await db.select().from(figmaPagesTable);
  return rows.map(mapFigmaPage);
}

/**
 * Upsert a page by (moduleId, figmaNodeId) — the file-scoped identity. Node IDs
 * are NOT globally unique across files, so both parts are required. Never
 * deletes. `isSearchable` is left as-is on update (Components pages stay
 * searchable/navigable — the exclusion applies to screen detection, not here).
 */
export async function upsertPage(data: {
  moduleId: string;
  figmaNodeId: string;
  name: string;
  normalizedName: string;
  orderIndex: number;
}): Promise<FigmaPage> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(figmaPagesTable)
    .where(
      and(
        eq(figmaPagesTable.moduleId, data.moduleId),
        eq(figmaPagesTable.figmaNodeId, data.figmaNodeId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(figmaPagesTable)
      .set({
        name: data.name,
        normalizedName: data.normalizedName,
        orderIndex: data.orderIndex,
        updatedAt: new Date(),
      })
      .where(eq(figmaPagesTable.id, existing.id))
      .returning();
    return mapFigmaPage(updated);
  }

  const [created] = await db
    .insert(figmaPagesTable)
    .values({
      moduleId: data.moduleId,
      figmaNodeId: data.figmaNodeId,
      name: data.name,
      normalizedName: data.normalizedName,
      orderIndex: data.orderIndex,
    })
    .returning();
  return mapFigmaPage(created);
}

export async function listPagesByModule(
  moduleId: string,
): Promise<FigmaPage[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(figmaPagesTable)
    .where(eq(figmaPagesTable.moduleId, moduleId));
  return rows.map(mapFigmaPage);
}

export async function getPageById(id: string): Promise<FigmaPage | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(figmaPagesTable)
    .where(eq(figmaPagesTable.id, id))
    .limit(1);
  return rows[0] ? mapFigmaPage(rows[0]) : null;
}

export async function getPageByModuleAndNode(
  moduleId: string,
  figmaNodeId: string,
): Promise<FigmaPage | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(figmaPagesTable)
    .where(
      and(
        eq(figmaPagesTable.moduleId, moduleId),
        eq(figmaPagesTable.figmaNodeId, figmaNodeId),
      ),
    )
    .limit(1);
  return rows[0] ? mapFigmaPage(rows[0]) : null;
}
