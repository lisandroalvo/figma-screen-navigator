/**
 * Pure Navigator search types + ranking. NO server-only imports and NO DB
 * access, so this can run in a Client Component for instant, live (as-you-type)
 * filtering over an already-loaded index. The server-only index builder lives in
 * navigator.ts (getNavigatorIndex), which re-exports everything here.
 *
 * Matching is case-insensitive, substring-aware, token-aware and
 * whitespace-tolerant. FLOW = Figma SECTION: a flow matches on words anywhere in
 * the authored SECTION name, so "modal", "1024", "768", "md" all work without
 * the "- Flow" suffix. Display names are never rewritten — normalization is for
 * matching only.
 */

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
  figmaUrl: string; // deep link to the exact Figma SECTION node
  status: string;
}
/**
 * SCREEN is the leaf of Module -> Page -> Flow -> Screen. It is ADDITIVE: it
 * does not affect module/page/flow results or their counts. `figmaUrl` deep-links
 * to the EXACT screen node so search can jump straight to the wireframe.
 */
export interface ScreenResult {
  type: "screen";
  id: string;
  name: string;
  moduleName: string;
  moduleSlug: string;
  pageId: string;
  pageName: string;
  // Nearest parent Flow or Section (screens can live under either); "" if none.
  parentName: string;
  figmaUrl: string;
}
/**
 * SECTION is any searchable authored Figma SECTION that is NOT a top-level
 * "- Flow" container (those surface as FlowResult). Additive/search-only —
 * carries no interactive-Flow semantics. `figmaUrl` deep-links to the exact
 * SECTION node. This is how nested sections (e.g. "Add Beneficiary Modal",
 * "Pop Up", "Table") become findable by substring.
 */
export interface SectionResult {
  type: "section";
  id: string;
  name: string;
  moduleName: string;
  moduleSlug: string;
  pageId: string;
  pageName: string;
  parentName: string;
  figmaUrl: string;
}
export type NavigatorResult =
  | ModuleResult | PageResult | FlowResult | ScreenResult | SectionResult;

export interface NavigatorIndex {
  modules: ModuleResult[];
  pages: PageResult[];
  flows: FlowResult[];
  sections: SectionResult[];
  screens: ScreenResult[];
  counts: { modules: number; pages: number; flows: number; screens: number };
}

/** Collapse whitespace + lowercase for whitespace-tolerant matching. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Score a result by its own name (exact > starts-with > substring, plus a
 * whole-token bonus) plus a small bonus for hierarchy/context token matches.
 * Local, deterministic; no embeddings.
 */
export function scoreEntity(name: string, context: string, query: string): number {
  const n = normalize(name);
  const q = normalize(query);
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
  sections: (SectionResult & { score: number })[];
  screens: (ScreenResult & { score: number })[];
  total: number;
}

/** Per-entity search helpers — kept separate so a future group extends cleanly. */
function rankBy<T extends NavigatorResult>(items: T[], ctx: (i: T) => string, query: string) {
  return items
    .map((i) => ({ ...i, score: scoreEntity(i.name, ctx(i), query) }))
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export const searchModules = (index: NavigatorIndex, q: string) => rankBy(index.modules, () => "", q);
export const searchPages = (index: NavigatorIndex, q: string) => rankBy(index.pages, (p) => p.moduleName, q);
export const searchFlows = (index: NavigatorIndex, q: string) =>
  rankBy(index.flows, (f) => `${f.moduleName} ${f.pageName}`, q);
export const searchSections = (index: NavigatorIndex, q: string) =>
  rankBy(index.sections, (s) => `${s.moduleName} ${s.pageName} ${s.parentName}`, q);
export const searchScreens = (index: NavigatorIndex, q: string) =>
  rankBy(index.screens, (s) => `${s.moduleName} ${s.pageName} ${s.parentName}`, q);

export function searchNavigator(index: NavigatorIndex, query: string): RankedResults {
  const modules = searchModules(index, query);
  const pages = searchPages(index, query);
  const flows = searchFlows(index, query);
  const sections = searchSections(index, query);
  const screens = searchScreens(index, query);
  return {
    modules, pages, flows, sections, screens,
    total: modules.length + pages.length + flows.length + sections.length + screens.length,
  };
}
