import { eq, getTableColumns, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { modulesTable, screensTable } from "../../../drizzle/schema";
import type { Module } from "@/types";

function mapModule(row: typeof modulesTable.$inferSelect): Module {
  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    slug: row.slug,
    figmaFileKey: row.figmaFileKey,
    figmaFileName: row.figmaFileName,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listModules(): Promise<Module[]> {
  const db = getDb();
  const rows = await db.select().from(modulesTable);
  return rows.map(mapModule);
}

export async function getModuleBySlug(slug: string): Promise<Module | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.slug, slug))
    .limit(1);
  return rows[0] ? mapModule(rows[0]) : null;
}

export async function listModulesWithCounts(): Promise<
  (Module & { screensCount: number })[]
> {
  const db = getDb();
  const rows = await db
    .select({
      ...getTableColumns(modulesTable),
      screensCount: sql<number>`count(${screensTable.id})`.as("screens_count"),
    })
    .from(modulesTable)
    .leftJoin(screensTable, eq(screensTable.moduleId, modulesTable.id))
    .groupBy(modulesTable.id);
  return rows.map((row) => {
    const { screensCount, ...rest } = row;
    return { ...mapModule(rest), screensCount };
  });
}
