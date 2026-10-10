import "server-only";
import { unstable_cache } from "next/cache";
import { listModules } from "@/lib/repositories/modules";
import { listPages } from "@/lib/repositories/figma-pages";
import { listFlows } from "@/lib/repositories/flows";
import { listDetectedFlowScreens } from "@/lib/repositories/flow-screens";
import { listDetectedFlowSections } from "@/lib/repositories/flow-sections";
import type {
  ModuleResult,
  PageResult,
  FlowResult,
  SectionResult,
  ScreenResult,
  NavigatorIndex,
} from "@/lib/navigator-search";

// Types + pure search live in navigator-search (client-importable). Re-export so
// existing server-side importers of "@/lib/navigator" keep working unchanged.
export type {
  ModuleResult,
  PageResult,
  FlowResult,
  SectionResult,
  ScreenResult,
  NavigatorResult,
  NavigatorIndex,
  RankedResults,
} from "@/lib/navigator-search";
export {
  searchNavigator,
  searchModules,
  searchPages,
  searchFlows,
  searchSections,
  searchScreens,
  scoreEntity,
} from "@/lib/navigator-search";

const fileUrl = (key: string) => `https://www.figma.com/file/${key}`;
const pageUrl = (key: string, node: string) =>
  `https://www.figma.com/file/${key}?node-id=${node.replace(/:/g, "-")}`;

/** Load the full Module -> Page -> Flow index (small dataset; joined in JS). */
async function _getNavigatorIndex(): Promise<NavigatorIndex> {
  const [allModules, allPages, allFlows, allScreens, allSections] = await Promise.all([
    listModules(),
    listPages(),
    listFlows(),
    listDetectedFlowScreens(),
    listDetectedFlowSections(),
  ]);

  // The Navigator shows CURRENT Figma truth only. Stale/archived records stay
  // in the DB (for the coverage verifier / safety) but must not appear here.
  //
  //  - archived modules (stale seed/orphan) are excluded outright;
  //  - a page/flow is "current" iff it was refreshed in its module's most recent
  //    index run — i.e. its `updatedAt` is at/after the module's `lastSyncedAt`
  //    (the indexer upserts the module first, then its current pages/flows).
  //    Stale records (not re-touched) fall below that timestamp;
  //  - modules with zero current pages (e.g. unsupported/non-design files that
  //    failed to fetch) carry no navigable content and are dropped, so counts
  //    reflect current searchable design content.
  const activeModules = allModules.filter((m) => m.status !== "archived");
  const activeById = new Map(activeModules.map((m) => [m.id, m]));
  const isCurrent = (updatedAt: Date, moduleId: string): boolean => {
    const m = activeById.get(moduleId);
    if (!m || !m.lastSyncedAt) return false;
    return updatedAt.getTime() >= m.lastSyncedAt.getTime();
  };

  const currentPages = allPages.filter((p) => isCurrent(p.updatedAt, p.moduleId));
  const currentFlows = allFlows.filter((f) => isCurrent(f.updatedAt, f.moduleId));

  const currentPagesByModule = new Map<string, number>();
  for (const p of currentPages) {
    currentPagesByModule.set(p.moduleId, (currentPagesByModule.get(p.moduleId) ?? 0) + 1);
  }
  const modules = activeModules.filter((m) => (currentPagesByModule.get(m.id) ?? 0) > 0);
  const keptModuleIds = new Set(modules.map((m) => m.id));
  const pages = currentPages.filter((p) => keptModuleIds.has(p.moduleId));
  const flows = currentFlows.filter((f) => keptModuleIds.has(f.moduleId));

  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const flowsByModule = new Map<string, number>();
  const flowsByPage = new Map<string, number>();
  for (const f of flows) {
    flowsByModule.set(f.moduleId, (flowsByModule.get(f.moduleId) ?? 0) + 1);
    flowsByPage.set(f.figmaPageId, (flowsByPage.get(f.figmaPageId) ?? 0) + 1);
  }
  const pagesByModule = new Map<string, number>();
  for (const p of pages) {
    pagesByModule.set(p.moduleId, (pagesByModule.get(p.moduleId) ?? 0) + 1);
  }

  const moduleResults: ModuleResult[] = modules.map((m) => ({
    type: "module",
    id: m.id,
    slug: m.slug,
    name: m.name,
    figmaFileKey: m.figmaFileKey,
    fileUrl: fileUrl(m.figmaFileKey),
    pageCount: pagesByModule.get(m.id) ?? 0,
    flowCount: flowsByModule.get(m.id) ?? 0,
  }));

  const pageResults: PageResult[] = pages.map((p) => {
    const m = moduleById.get(p.moduleId);
    return {
      type: "page",
      id: p.id,
      name: p.name,
      moduleId: p.moduleId,
      moduleName: m?.name ?? "",
      moduleSlug: m?.slug ?? "",
      figmaFileKey: m?.figmaFileKey ?? "",
      figmaNodeId: p.figmaNodeId,
      pageUrl: m ? pageUrl(m.figmaFileKey, p.figmaNodeId) : "",
      flowCount: flowsByPage.get(p.id) ?? 0,
    };
  });

  const flowResults: FlowResult[] = flows.map((f) => ({
    type: "flow",
    id: f.id,
    name: f.name,
    moduleName: f.moduleName ?? "",
    moduleSlug: f.moduleSlug ?? "",
    pageId: f.figmaPageId,
    pageName: f.pageName ?? "",
    figmaUrl: f.figmaUrl,
    status: f.status,
  }));

  const currentPageById = new Map(pages.map((p) => [p.id, p]));

  // SECTIONS (additive, search-only). Surface every authored SECTION on a
  // current Page EXCEPT the top-level "- Flow" containers (which already show as
  // FlowResult) — deduped by node id so a section never appears twice. Scoped to
  // current pages/modules just like everything else.
  const flowSectionNodeIds = new Set(flows.map((f) => f.figmaSectionNodeId));
  const moduleBySlugName = new Map(modules.map((m) => [m.id, m]));
  const sectionResults: SectionResult[] = allSections
    .map((s): SectionResult | null => {
      const page = currentPageById.get(s.figmaPageId);
      if (!page) return null; // page not current -> hide
      if (s.isFlowContainer || flowSectionNodeIds.has(s.figmaNodeId)) return null; // shown as FLOW
      const mod = moduleBySlugName.get(s.moduleId);
      if (!mod) return null;
      return {
        type: "section",
        id: s.id,
        name: s.name,
        moduleName: mod.name,
        moduleSlug: mod.slug,
        pageId: s.figmaPageId,
        pageName: page.name,
        // Prefer the nearest ancestor Flow when the hierarchy proves one;
        // otherwise fall back to the immediate parent section name.
        parentName: s.parentFlowName ?? s.parentName ?? "",
        figmaUrl: s.figmaUrl,
      };
    })
    .filter((s): s is SectionResult => s !== null);

  // SCREENS (additive). Scoped to current Pages of current Modules (a screen may
  // live under any Section, not only a Flow). Only status='detected' is loaded.
  // Hierarchy context uses the nearest parent Flow, else parent Section.
  const screenResults: ScreenResult[] = allScreens
    .map((s): ScreenResult | null => {
      const page = currentPageById.get(s.figmaPageId);
      if (!page) return null; // page not current -> hide
      const mod = moduleBySlugName.get(s.moduleId);
      if (!mod) return null;
      return {
        type: "screen",
        id: s.id,
        name: s.name,
        moduleName: mod.name,
        moduleSlug: mod.slug,
        pageId: s.figmaPageId,
        pageName: page.name,
        parentName: s.parentFlowName ?? s.parentSectionName ?? "",
        searchTitles: s.searchTitles ?? [],
        searchAliases: s.searchAliases ?? [],
        figmaUrl: s.figmaUrl,
      };
    })
    .filter((s): s is ScreenResult => s !== null);

  return {
    modules: moduleResults,
    pages: pageResults,
    flows: flowResults,
    sections: sectionResults,
    screens: screenResults,
    // counts intentionally excludes sections: the home "Flows" metric stays the
    // count of top-level interactive Flows (§ regression), even though search
    // can additionally return SECTION results.
    counts: { modules: modules.length, pages: pages.length, flows: flows.length, screens: screenResults.length },
  };
}

/** Cached 5min — navigator data only changes on re-index, so repeat fetches
 *  should not pay the full 5-query (~2,700-row) DB cost. Re-indexes bust the
 *  cache via POST /api/revalidate. */
export const getNavigatorIndex = unstable_cache(
  _getNavigatorIndex,
  ["navigator-full-index"],
  { revalidate: 300, tags: ["navigator"] },
);
