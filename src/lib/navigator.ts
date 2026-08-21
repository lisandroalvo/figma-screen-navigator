import "server-only";
import { listModules } from "@/lib/repositories/modules";
import { listPages } from "@/lib/repositories/figma-pages";
import { listFlows } from "@/lib/repositories/flows";

export interface ModuleResult {
  type: "module";
  id: string;
  slug: string;
  name: string;
  figmaFileKey: string;
  fileUrl: string;
  pageCount: number;
  flowCount: number;
}
export interface PageResult {
  type: "page";
  id: string;
  name: string;
  moduleId: string;
  moduleName: string;
  moduleSlug: string;
  figmaFileKey: string;
  figmaNodeId: string;
  pageUrl: string;
  flowCount: number;
}
export interface FlowResult {
  type: "flow";
  id: string;
  name: string;
  moduleName: string;
  moduleSlug: string;
  pageId: string;
  pageName: string;
  figmaUrl: string;
  status: string;
}
export type NavigatorResult = ModuleResult | PageResult | FlowResult;

export interface NavigatorIndex {
  modules: ModuleResult[];
  pages: PageResult[];
  flows: FlowResult[];
  counts: { modules: number; pages: number; flows: number };
}

const fileUrl = (key: string) => `https://www.figma.com/file/${key}`;
const pageUrl = (key: string, node: string) =>
  `https://www.figma.com/file/${key}?node-id=${node.replace(/:/g, "-")}`;

/** Load the full Module -> Page -> Flow index (small dataset; joined in JS). */
export async function getNavigatorIndex(): Promise<NavigatorIndex> {
  const [allModules, allPages, allFlows] = await Promise.all([
    listModules(),
    listPages(),
    listFlows(),
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

  return {
    modules: moduleResults,
    pages: pageResults,
    flows: flowResults,
    counts: { modules: modules.length, pages: pages.length, flows: flows.length },
  };
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Score a result by its own name (exact > starts-with > all-tokens > some-token)
 * plus a small bonus for hierarchy/context token matches. Local token search only.
 */
function scoreEntity(name: string, context: string, query: string): number {
  const n = name.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  let score = 0;
  if (n === q) score += 100;
  else if (n.startsWith(q)) score += 60;
  else if (n.includes(q)) score += 35;

  const qTokens = tokenize(query);
  const nameTokens = new Set(tokenize(name));
  const ctxTokens = new Set(tokenize(context));
  let inName = 0, inCtx = 0;
  for (const t of qTokens) {
    if ([...nameTokens].some((nt) => nt.startsWith(t))) inName++;
    else if ([...ctxTokens].some((ct) => ct.startsWith(t))) inCtx++;
  }
  if (qTokens.length > 0 && inName === qTokens.length) score += 40;
  else score += inName * 12;
  score += inCtx * 4;
  return score;
}

export interface RankedResults {
  modules: (ModuleResult & { score: number })[];
  pages: (PageResult & { score: number })[];
  flows: (FlowResult & { score: number })[];
  total: number;
}

export function searchNavigator(index: NavigatorIndex, query: string): RankedResults {
  const rank = <T extends NavigatorResult>(items: T[], ctx: (i: T) => string) =>
    items
      .map((i) => ({ ...i, score: scoreEntity(i.name, ctx(i), query) }))
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score);

  const modules = rank(index.modules, () => "");
  const pages = rank(index.pages, (p) => p.moduleName);
  const flows = rank(index.flows, (f) => `${f.moduleName} ${f.pageName}`);

  return { modules, pages, flows, total: modules.length + pages.length + flows.length };
}
