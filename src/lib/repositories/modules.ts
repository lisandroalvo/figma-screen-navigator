import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { modulesTable, screensTable } from "../../../drizzle/schema";
import type { Module } from "@/types";

export function slugify(name: string, fileKey: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `module-${fileKey.slice(0, 6).toLowerCase()}`;
}

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

/**
 * Upsert a module by its Figma file key (the stable, file-scoped identity).
 * Slug is generated once and kept stable; collisions within a product get a
 * file-key suffix. Never deletes.
 */
export async function upsertModule(data: {
  productId: string;
  figmaFileKey: string;
  name: string;
  figmaFileName?: string | null;
}): Promise<Module> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.figmaFileKey, data.figmaFileKey))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(modulesTable)
      .set({
        name: data.name,
        figmaFileName: data.figmaFileName ?? existing.figmaFileName,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(modulesTable.id, existing.id))
      .returning();
    return mapModule(updated);
  }

  // New module: ensure a unique slug within the product.
  let slug = slugify(data.name, data.figmaFileKey);
  const clash = await db
    .select({ id: modulesTable.id })
    .from(modulesTable)
    .where(and(eq(modulesTable.productId, data.productId), eq(modulesTable.slug, slug)))
    .limit(1);
  if (clash.length > 0) slug = `${slug}-${data.figmaFileKey.slice(0, 6).toLowerCase()}`;

  const [created] = await db
    .insert(modulesTable)
    .values({
      productId: data.productId,
      figmaFileKey: data.figmaFileKey,
      name: data.name,
      slug,
      figmaFileName: data.figmaFileName ?? data.name,
      status: "active",
      lastSyncedAt: new Date(),
    })
    .returning();
  return mapModule(created);
}

export async function setModuleSlug(id: string, slug: string): Promise<void> {
  const db = getDb();
  await db
    .update(modulesTable)
    .set({ slug, updatedAt: new Date() })
    .where(eq(modulesTable.id, id));
}

export async function archiveModule(id: string, slug: string): Promise<void> {
  const db = getDb();
  await db
    .update(modulesTable)
    .set({ status: "archived", slug, updatedAt: new Date() })
    .where(eq(modulesTable.id, id));
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
