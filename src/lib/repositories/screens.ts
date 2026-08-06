import {
  and,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  breakpointsTable,
  figmaPagesTable,
  modulesTable,
  screenRelationshipsTable,
  screensTable,
} from "../../../drizzle/schema";
import { tokenize } from "@/lib/search";
import type { Screen } from "@/types";
import type { SearchFilters } from "@/lib/search";

function mapScreen(row: typeof screensTable.$inferSelect): Screen {
  return {
    id: row.id,
    productId: row.productId,
    moduleId: row.moduleId,
    figmaPageId: row.figmaPageId,
    breakpointId: row.breakpointId,
    figmaFileKey: row.figmaFileKey,
    figmaPageNodeId: row.figmaPageNodeId,
    figmaNodeId: row.figmaNodeId,
    originalName: row.originalName,
    normalizedName: row.normalizedName,
    displayName: row.displayName,
    figmaUrl: row.figmaUrl,
    previewUrl: row.previewUrl,
    status: row.status,
    source: row.source,
    screen: row.screen,
    flow: row.flow,
    step: row.step,
    scenario: row.scenario,
    option: row.option,
    condition: row.condition,
    behavior: row.behavior,
    state: row.state,
    keywords: row.keywords as string[],
    description: row.description,
    parentPath: row.parentPath as Screen["parentPath"],
    ambiguityFlags: row.ambiguityFlags as string[],
    metadata: row.metadata as Screen["metadata"],
    lastFigmaModifiedAt: row.lastFigmaModifiedAt,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function listScreens(): Promise<Screen[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(screensTable)
    .orderBy(screensTable.displayName);
  return rows.map(mapScreen);
}

export async function getScreenById(id: string): Promise<Screen | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(screensTable)
    .where(eq(screensTable.id, id))
    .limit(1);
  return rows[0] ? mapScreen(rows[0]) : null;
}

export async function listScreensByModule(moduleId: string): Promise<Screen[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(screensTable)
    .where(eq(screensTable.moduleId, moduleId))
    .orderBy(screensTable.displayName);
  return rows.map(mapScreen);
}

export async function listRelatedScreens(screenId: string): Promise<Screen[]> {
  const db = getDb();
  const rels = await db
    .select()
    .from(screenRelationshipsTable)
    .where(
      or(
        eq(screenRelationshipsTable.sourceScreenId, screenId),
        eq(screenRelationshipsTable.targetScreenId, screenId),
      ),
    );

  const ids = rels
    .flatMap((r) => [r.sourceScreenId, r.targetScreenId])
    .filter((id) => id !== screenId);

  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(screensTable)
    .where(inArray(screensTable.id, ids));
  return rows.map(mapScreen);
}

export async function listResponsiveVariants(
  screenId: string,
): Promise<Screen[]> {
  const db = getDb();
  const rels = await db
    .select()
    .from(screenRelationshipsTable)
    .where(
      and(
        eq(screenRelationshipsTable.type, "responsive_variant"),
        or(
          eq(screenRelationshipsTable.sourceScreenId, screenId),
          eq(screenRelationshipsTable.targetScreenId, screenId),
        ),
      ),
    );

  const ids = rels
    .flatMap((r) => [r.sourceScreenId, r.targetScreenId])
    .filter((id) => id !== screenId);

  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(screensTable)
    .where(inArray(screensTable.id, ids));
  return rows.map(mapScreen);
}

export async function searchScreens(
  query: string,
  filters: SearchFilters = {},
): Promise<Screen[]> {
  const db = getDb();
  const terms = tokenize(query);

  const filterConditions: SQL<unknown>[] = [];
  if (filters.productId)
    filterConditions.push(eq(screensTable.productId, filters.productId));
  if (filters.moduleId)
    filterConditions.push(eq(screensTable.moduleId, filters.moduleId));
  if (filters.figmaPageId)
    filterConditions.push(eq(screensTable.figmaPageId, filters.figmaPageId));
  if (filters.breakpointId)
    filterConditions.push(eq(screensTable.breakpointId, filters.breakpointId));
  if (filters.status) {
    filterConditions.push(
      eq(screensTable.status, filters.status as Screen["status"]),
    );
  }
  if (filters.behavior)
    filterConditions.push(ilike(screensTable.behavior, `%${escapeLike(filters.behavior)}%`));
  if (filters.state)
    filterConditions.push(ilike(screensTable.state, `%${escapeLike(filters.state)}%`));
  if (filters.scenario)
    filterConditions.push(ilike(screensTable.scenario, `%${escapeLike(filters.scenario)}%`));
  if (filters.source) {
    filterConditions.push(eq(screensTable.source, filters.source as Screen["source"]));
  } else if (filters.includeMock !== true) {
    filterConditions.push(ne(screensTable.source, "mock"));
  }

  let score = sql<number>`0.0`.mapWith(Number);

  const termConditions: (SQL<unknown> | undefined)[] = [];
  for (const raw of terms) {
    const t = `%${escapeLike(raw)}%`;
    termConditions.push(
      or(
        ilike(screensTable.displayName, t),
        ilike(screensTable.originalName, t),
        ilike(screensTable.normalizedName, t),
        ilike(screensTable.screen, t),
        ilike(screensTable.flow, t),
        ilike(screensTable.step, t),
        ilike(screensTable.scenario, t),
        ilike(screensTable.option, t),
        ilike(screensTable.condition, t),
        ilike(screensTable.behavior, t),
        ilike(screensTable.state, t),
        ilike(screensTable.description, t),
        ilike(modulesTable.name, t),
        ilike(figmaPagesTable.name, t),
        ilike(breakpointsTable.name, t),
        sql`${screensTable.keywords}::text ILIKE ${t}`,
      ),
    );

    const termScore = sql<number>`
      (case when ${ilike(screensTable.displayName, t)} then 20 else 0 end) +
      (case when ${ilike(screensTable.normalizedName, t)} then 12 else 0 end) +
      (case when ${ilike(screensTable.originalName, t)} then 10 else 0 end) +
      (case when ${ilike(modulesTable.name, t)} then 8 else 0 end) +
      (case when ${ilike(figmaPagesTable.name, t)} then 8 else 0 end) +
      (case when ${ilike(breakpointsTable.name, t)} then 6 else 0 end) +
      (case when ${ilike(screensTable.scenario, t)} then 4 else 0 end) +
      (case when ${ilike(screensTable.behavior, t)} then 4 else 0 end) +
      (case when ${ilike(screensTable.state, t)} then 4 else 0 end) +
      (case when ${ilike(screensTable.option, t)} then 4 else 0 end) +
      (case when ${ilike(screensTable.condition, t)} then 4 else 0 end) +
      (case when ${ilike(screensTable.screen, t)} then 4 else 0 end) +
      (case when ${ilike(screensTable.flow, t)} then 4 else 0 end) +
      (case when ${ilike(screensTable.step, t)} then 4 else 0 end) +
      (case when ${ilike(screensTable.description, t)} then 1 else 0 end) +
      (case when ${sql`${screensTable.keywords}::text ILIKE ${t}`} then 2 else 0 end)
    `.mapWith(Number);
    score = sql`${score} + ${termScore}`;
  }

  if (terms.length > 0) {
    const displayLike = `%${escapeLike(query.toLowerCase())}%`;
    score = sql`${score} + (case when ${ilike(screensTable.displayName, displayLike)} then 30 else 0 end)`;
  }

  const allConditions = [...filterConditions, ...termConditions];

  const dbQuery = db
    .select({
      screen: screensTable,
      module: modulesTable,
      page: figmaPagesTable,
      breakpoint: breakpointsTable,
      score,
    })
    .from(screensTable)
    .innerJoin(modulesTable, eq(screensTable.moduleId, modulesTable.id))
    .innerJoin(figmaPagesTable, eq(screensTable.figmaPageId, figmaPagesTable.id))
    .innerJoin(
      breakpointsTable,
      eq(screensTable.breakpointId, breakpointsTable.id),
    )
    .$dynamic();

  if (allConditions.length > 0) {
    dbQuery.where(and(...allConditions) as SQL<unknown>);
  }

  const rows = await dbQuery
    .orderBy(sql`${score} DESC`, screensTable.displayName)
    .limit(100);

  return rows.map((r) => mapScreen(r.screen));
}
