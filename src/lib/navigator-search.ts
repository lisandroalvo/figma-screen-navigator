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
import {
  normalizeString as normalize,
  tokenize,
  tokenStem,
  buildTokenIndex,
  queryTokenMatches,
} from "@/lib/search-normalize";

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
  // Authored layer-name titles inside the screen (e.g. "Rate Group Modal") +
  // deterministic normalized aliases — search enrichment only.
  searchTitles: string[];
  searchAliases: string[];
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

// Common tokens: ubiquitous UI words that must NOT, on their own, make a screen
// eligible for a MULTI-token query (they only strengthen/rank). A SINGLE-token
// query for one of these stays broad. NOTE: "pop"/"up" are intentionally NOT
// common — the compound map already folds popup/pop-up/pop up to [pop,up], and
// treating them as meaningful keeps multi-token popup queries precise (§6).
const COMMON_TOKENS = new Set([
  "default", "modal", "screen", "page", "tab", "view", "state",
  "dialog", "panel", "section", "flow", "new", "edit", "add", "list", "detail",
  "details",
]);

/**
 * Score a result by its own name (exact > starts-with > substring, plus a
 * stem/prefix-aware token bonus) plus a small bonus for hierarchy/context token
 * matches. Local, deterministic; no embeddings. Used by module/page/flow/section.
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
  const nameIdx = buildTokenIndex([name]);
  const ctxIdx = buildTokenIndex([context]);
  let inName = 0, inCtx = 0;
  for (const t of qTokens) {
    if (queryTokenMatches(nameIdx.stems, nameIdx.tokens, t)) inName++;
    else if (queryTokenMatches(ctxIdx.stems, ctxIdx.tokens, t)) inCtx++;
  }
  if (qTokens.length > 0 && inName === qTokens.length) score += 40;
  else score += inName * 12;
  score += inCtx * 4;
  return score;
}

/**
 * Multi-field SCREEN scoring. Considers canonical name, authored search titles,
 * aliases, and section/flow/page/module context. Exact canonical always wins;
 * exact search-title next; then combined cross-field query-token coverage (so a
 * query can span canonical + modal title, e.g. "Adjustment Rate Group Pop Up").
 * Returns the score and, when the winning signal was a non-canonical title, the
 * matched title for a subtle "Matched:" hint.
 */
export function scoreScreen(s: ScreenResult, query: string): { score: number; matched: string | null } {
  const q = normalize(query);
  if (!q) return { score: 0, matched: null };
  const nameN = normalize(s.name);
  if (nameN === q) return { score: 10000, matched: null }; // exact canonical wins outright

  // Ordered tiers (single max — coverage can never cross a field tier, so an
  // exact canonical/title match always outranks a mere coverage/substring hit).
  let best = 0;
  let matched: string | null = null;
  const consider = (val: number, label: string | null) => { if (val > best) { best = val; matched = label; } };

  // 3 canonical starts-with / 8 canonical substring
  if (nameN.startsWith(q)) consider(8000, null);
  else if (nameN.includes(q)) consider(3500, null);
  // 2 exact title / 4 title starts-with / 8 title substring
  for (const t of s.searchTitles ?? []) {
    const tn = normalize(t);
    if (tn === q) consider(9000, t);
    else if (tn.startsWith(q)) consider(7000, t);
    else if (tn.includes(q)) consider(3000, t);
  }
  // 6 section exact
  if (normalize(s.parentName ?? "") === q) consider(5000, null);
  // 7 alias exact / alias prefix
  for (const a of s.searchAliases ?? []) {
    const an = normalize(a);
    if (an === q) consider(4500, null);
    else if (an.startsWith(q)) consider(4000, null);
  }

  // 5 combined cross-field token coverage (name + titles + section/page/module).
  // ELIGIBILITY (precision): a common token alone must never qualify a screen for
  // a MULTI-token query. So for >=2 tokens we require EVERY meaningful (non-common)
  // query token to be covered somewhere; common tokens then only strengthen the
  // result. If a query is all-common (e.g. "pop up" -> pop,up), require all tokens.
  // Single-token queries stay broad (any coverage qualifies) so "modal"/"hover"/
  // "default" keep returning the full legitimate set.
  const qTokens = tokenize(query);
  const isCommon = (t: string) => COMMON_TOKENS.has(t) || COMMON_TOKENS.has(tokenStem(t));
  const idx = buildTokenIndex([s.name, ...(s.searchTitles ?? []), s.parentName, s.pageName, s.moduleName]);
  const isCov = (t: string) => queryTokenMatches(idx.stems, idx.tokens, t);
  const coveredAll = qTokens.filter(isCov).length;
  if (qTokens.length === 1) {
    if (coveredAll === 1) consider(1500, null);
  } else if (qTokens.length >= 2) {
    const meaningful = qTokens.filter((t) => !isCommon(t));
    const required = meaningful.length > 0 ? meaningful : qTokens;
    if (required.every(isCov)) {
      // all required covered -> eligible. full coverage (incl commons) ranks a
      // little higher than meaningful-complete-but-missing-a-common-token.
      consider(coveredAll === qTokens.length ? 6300 : 5200, null);
    }
    // else: fails meaningful coverage -> contributes 0 (filtered out).
  }

  const score = best;

  // "Matched:" hint — only when the canonical name alone did not satisfy the
  // query but a search title carries the meaningful tokens.
  if (!matched && score > 0) {
    const nameIdx = buildTokenIndex([s.name]);
    const canonicalCoversAll = qTokens.every((qt) => queryTokenMatches(nameIdx.stems, nameIdx.tokens, qt));
    if (!canonicalCoversAll) {
      let bestTitle: string | null = null, bestHits = 0;
      for (const t of s.searchTitles ?? []) {
        const ti = buildTokenIndex([t]);
        const hits = qTokens.filter((qt) => queryTokenMatches(ti.stems, ti.tokens, qt)).length;
        if (hits > bestHits) { bestHits = hits; bestTitle = t; }
      }
      if (bestHits > 0) matched = bestTitle;
    }
  }

  return { score, matched };
}

export interface RankedResults {
  modules: (ModuleResult & { score: number })[];
  pages: (PageResult & { score: number })[];
  flows: (FlowResult & { score: number })[];
  sections: (SectionResult & { score: number })[];
  // `matched` = the non-canonical search title that satisfied the query (for a
  // subtle "Matched: …" hint); null when the canonical name matched.
  screens: (ScreenResult & { score: number; matched: string | null })[];
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

/** Screens use the multi-field scorer (canonical + titles + aliases + context). */
export const searchScreens = (index: NavigatorIndex, query: string) =>
  index.screens
    .map((s) => { const r = scoreScreen(s, query); return { ...s, score: r.score, matched: r.matched }; })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

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
