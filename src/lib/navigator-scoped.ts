import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  modulesTable,
  figmaPagesTable,
  flowsTable,
  flowScreensTable,
  flowSectionsTable,
} from "../../drizzle/schema";
import type { NavigatorIndex } from "@/lib/navigator-search";

const fileUrl = (key: string) => `https://www.figma.com/file/${key}`;
const pageUrl = (key: string, node: string) =>
  `https://www.figma.com/file/${key}?node-id=${node.replace(/:/g, "-")}`;

/**
 * Lightweight module list for the Navigator home: one aggregate query returns
 * per-module CURRENT page + flow counts — no bulk row loads. A module is shown
 * iff it is not archived, has a lastSyncedAt, and at least one current page
 * (page.updatedAt >= module.lastSyncedAt) — identical semantics to
 * getNavigatorIndex(), minus the ~2,700-row fetch on every page render.
 */
export async function getGlobalModuleList() {
  const db = getDb();

  const pageCounts = await db.execute(sql`
    SELECT p.module_id AS id, count(*)::int AS c
    FROM figma_pages p
    JOIN modules m ON m.id = p.module_id
    WHERE m.status != 'archived' AND m.last_synced_at IS NOT NULL
      AND p.updated_at >= m.last_synced_at
    GROUP BY p.module_id
  `);

  const flowCounts = await db.execute(sql`
    SELECT f.module_id AS id, count(*)::int AS c
    FROM flows f
    JOIN modules m ON m.id = f.module_id
    WHERE m.status != 'archived' AND m.last_synced_at IS NOT NULL
      AND f.updated_at >= m.last_synced_at
    GROUP BY f.module_id
  `);

  const pageCountByModule = new Map(
    (pageCounts as unknown as { id: string; c: number }[]).map((r) => [r.id, r.c]),
  );
  const flowCountByModule = new Map(
    (flowCounts as unknown as { id: string; c: number }[]).map((r) => [r.id, r.c]),
  );

  const modules = await db
    .select()
    .from(modulesTable)
    .where(sql`${modulesTable.status} != 'archived'`);

  const list = modules
    .filter((m) => m.lastSyncedAt && (pageCountByModule.get(m.id) ?? 0) > 0)
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      figmaFileKey: m.figmaFileKey,
      fileUrl: fileUrl(m.figmaFileKey),
      pageCount: pageCountByModule.get(m.id) ?? 0,
      flowCount: flowCountByModule.get(m.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    modules: list,
    counts: {
      modules: list.length,
      pages: list.reduce((n, m) => n + m.pageCount, 0),
      flows: list.reduce((n, m) => n + m.flowCount, 0),
    },
  };
}

async function getModuleBySlug(moduleSlug: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.slug, moduleSlug))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * NavigatorIndex containing ONLY one module's subtree (pages, flows, sections,
 * screens). ~600 rows max — vs the full global index (~2,700 rows) that every
 * navigator page used to fetch.
 */
export async function getModuleScope(
  moduleSlug: string,
): Promise<{ module: { id: string; slug: string; name: string; figmaFileKey: string; fileUrl: string }; index: NavigatorIndex } | null> {
  const db = getDb();
  const mod = await getModuleBySlug(moduleSlug);
  if (!mod || !mod.lastSyncedAt || mod.status === "archived") return null;

  const syncedAt = mod.lastSyncedAt;

  const pages = await db
    .select()
    .from(figmaPagesTable)
    .where(
      and(
        eq(figmaPagesTable.moduleId, mod.id),
        gte(figmaPagesTable.updatedAt, syncedAt),
      ),
    );

  const flows = await db
    .select()
    .from(flowsTable)
    .where(
      and(eq(flowsTable.moduleId, mod.id), gte(flowsTable.updatedAt, syncedAt)),
    );

  const sections = await db
    .select()
    .from(flowSectionsTable)
    .where(
      and(
        eq(flowSectionsTable.moduleId, mod.id),
        eq(flowSectionsTable.status, "detected"),
      ),
    );

  const screens = await db
    .select()
    .from(flowScreensTable)
    .where(
      and(
        eq(flowScreensTable.moduleId, mod.id),
        eq(flowScreensTable.status, "detected"),
      ),
    );

  return {
    module: {
      id: mod.id,
      slug: mod.slug,
      name: mod.name,
      figmaFileKey: mod.figmaFileKey,
      fileUrl: fileUrl(mod.figmaFileKey),
    },
    index: buildIndex({ mod, pages, flows, sections, screens }),
  };
}

/**
 * NavigatorIndex containing ONLY one page's subtree (flows, sections, screens).
 */
export async function getPageScope(
  moduleSlug: string,
  pageId: string,
): Promise<{
  module: { id: string; slug: string; name: string; fileUrl: string };
  page: { id: string; name: string; pageUrl: string };
  index: NavigatorIndex;
} | null> {
  const db = getDb();
  const mod = await getModuleBySlug(moduleSlug);
  if (!mod || !mod.lastSyncedAt || mod.status === "archived") return null;

  const [page] = await db
    .select()
    .from(figmaPagesTable)
    .where(
      and(
        eq(figmaPagesTable.id, pageId),
        eq(figmaPagesTable.moduleId, mod.id),
        gte(figmaPagesTable.updatedAt, mod.lastSyncedAt),
      ),
    )
    .limit(1);
  if (!page) return null;

  const [flows, sections, screens] = await Promise.all([
    db
      .select()
      .from(flowsTable)
      .where(
        and(
          eq(flowsTable.figmaPageId, page.id),
          gte(flowsTable.updatedAt, mod.lastSyncedAt),
        ),
      ),
    db
      .select()
      .from(flowSectionsTable)
      .where(
        and(
          eq(flowSectionsTable.figmaPageId, page.id),
          eq(flowSectionsTable.status, "detected"),
        ),
      ),
    db
      .select()
      .from(flowScreensTable)
      .where(
        and(
          eq(flowScreensTable.figmaPageId, page.id),
          eq(flowScreensTable.status, "detected"),
        ),
      ),
  ]);

  return {
    module: {
      id: mod.id,
      slug: mod.slug,
      name: mod.name,
      fileUrl: fileUrl(mod.figmaFileKey),
    },
    page: {
      id: page.id,
      name: page.name,
      pageUrl: pageUrl(mod.figmaFileKey, page.figmaNodeId),
    },
    index: buildIndex({ mod, pages: [page], flows, sections, screens }),
  };
}

/** Build a NavigatorIndex from already-scoped rows. Same result shape as
 *  getNavigatorIndex() so searchNavigator() works unchanged. */
function buildIndex(input: {
  mod: typeof modulesTable.$inferSelect;
  pages: (typeof figmaPagesTable.$inferSelect)[];
  flows: (typeof flowsTable.$inferSelect)[];
  sections: (typeof flowSectionsTable.$inferSelect)[];
  screens: (typeof flowScreensTable.$inferSelect)[];
}): NavigatorIndex {
  const { mod, pages, flows, sections, screens } = input;

  const pageById = new Map(pages.map((p) => [p.id, p]));
  const flowSectionNodeIds = new Set(flows.map((f) => f.figmaSectionNodeId));

  const moduleResult = {
    type: "module" as const,
    id: mod.id,
    slug: mod.slug,
    name: mod.name,
    figmaFileKey: mod.figmaFileKey,
    fileUrl: fileUrl(mod.figmaFileKey),
    pageCount: pages.length,
    flowCount: flows.length,
  };

  const pageResults = pages.map((p) => ({
    type: "page" as const,
    id: p.id,
    name: p.name,
    moduleId: mod.id,
    moduleName: mod.name,
    moduleSlug: mod.slug,
    figmaFileKey: mod.figmaFileKey,
    figmaNodeId: p.figmaNodeId,
    pageUrl: pageUrl(mod.figmaFileKey, p.figmaNodeId),
    flowCount: flows.filter((f) => f.figmaPageId === p.id).length,
  }));

  const flowResults = flows.map((f) => ({
    type: "flow" as const,
    id: f.id,
    name: f.name,
    moduleName: mod.name,
    moduleSlug: mod.slug,
    pageId: f.figmaPageId,
    pageName: pageById.get(f.figmaPageId)?.name ?? "",
    figmaUrl: f.figmaUrl,
    status: f.status,
  }));

  const sectionResults = sections
    .filter((s) => !s.isFlowContainer && !flowSectionNodeIds.has(s.figmaNodeId))
    .filter((s) => pageById.has(s.figmaPageId))
    .map((s) => ({
      type: "section" as const,
      id: s.id,
      name: s.name,
      moduleName: mod.name,
      moduleSlug: mod.slug,
      pageId: s.figmaPageId,
      pageName: pageById.get(s.figmaPageId)?.name ?? "",
      parentName: s.parentFlowName ?? s.parentName ?? "",
      figmaUrl: s.figmaUrl,
    }));

  const screenResults = screens
    .filter((s) => pageById.has(s.figmaPageId))
    .map((s) => ({
      type: "screen" as const,
      id: s.id,
      name: s.name,
      moduleName: mod.name,
      moduleSlug: mod.slug,
      pageId: s.figmaPageId,
      pageName: pageById.get(s.figmaPageId)?.name ?? "",
      parentName: s.parentFlowName ?? s.parentSectionName ?? "",
      searchTitles: s.searchTitles ?? [],
      searchAliases: s.searchAliases ?? [],
      figmaUrl: s.figmaUrl,
    }));

  return {
    modules: [moduleResult],
    pages: pageResults,
    flows: flowResults,
    sections: sectionResults,
    screens: screenResults,
    counts: {
      modules: 1,
      pages: pages.length,
      flows: flows.length,
      screens: screenResults.length,
    },
  };
}
