import type { Screen } from "@/types";
import { modules, figmaPages, breakpoints, screens, products } from "@/lib/data/mock";

export interface SearchFilters {
  productId?: string;
  moduleId?: string;
  figmaPageId?: string;
  breakpointId?: string;
  status?: string;
  behavior?: string;
  state?: string;
  scenario?: string;
  source?: string;
  includeMock?: boolean;
}

export interface SearchResult {
  screen: Screen;
  score: number;
  matchedTerms: number;
  totalTerms: number;
}

/**
 * Normalize and tokenize search text.
 * Splits on punctuation, `/`, `-`, `–`, and whitespace.
 */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[\/\\|–—\-_.;:,'"!?()[\]{}<>&%@#$^*+=~`]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function normalizeForSearch(input: string): string[] {
  return tokenize(input);
}

function tokensForScreen(screen: Screen): {
  displayName: string[];
  originalName: string[];
  normalizedName: string[];
  moduleName: string[];
  pageName: string[];
  breakpointName: string[];
  semantic: string[];
  keywords: string[];
  description: string[];
} {
  const figmaModule = modules.find((m) => m.id === screen.moduleId);
  const page = figmaPages.find((p) => p.id === screen.figmaPageId);
  const breakpoint = breakpoints.find((b) => b.id === screen.breakpointId);

  const semantic = [
    screen.screen,
    screen.flow,
    screen.step,
    screen.scenario,
    screen.option,
    screen.condition,
    screen.behavior,
    screen.state,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ");

  return {
    displayName: tokenize(screen.displayName),
    originalName: tokenize(screen.originalName),
    normalizedName: tokenize(screen.normalizedName),
    moduleName: figmaModule ? tokenize(figmaModule.name) : [],
    pageName: page ? tokenize(page.name) : [],
    breakpointName: breakpoint ? tokenize(breakpoint.name) : [],
    semantic: tokenize(semantic),
    keywords: screen.keywords.flatMap((k) => tokenize(k)),
    description: tokenize(screen.description ?? ""),
  };
}

function termScore(term: string, tokens: string[]): number {
  if (tokens.some((t) => t === term)) return 1;
  if (tokens.some((t) => t.startsWith(term))) return 0.75;
  if (tokens.some((t) => t.includes(term))) return 0.5;
  return 0;
}

function scoreScreen(screen: Screen, terms: string[]): SearchResult | null {
  const tokens = tokensForScreen(screen);

  const termScores = terms.map((term) => ({
    term,
    displayName: termScore(term, tokens.displayName),
    originalName: termScore(term, tokens.originalName),
    normalizedName: termScore(term, tokens.normalizedName),
    module: termScore(term, tokens.moduleName),
    page: termScore(term, tokens.pageName),
    breakpoint: termScore(term, tokens.breakpointName),
    semantic: termScore(term, tokens.semantic),
    keywords: termScore(term, tokens.keywords),
    description: termScore(term, tokens.description),
  }));

  // A screen must match every search term to be included.
  const unmatched = termScores.some(
    (t) =>
      t.displayName === 0 &&
      t.originalName === 0 &&
      t.normalizedName === 0 &&
      t.module === 0 &&
      t.page === 0 &&
      t.breakpoint === 0 &&
      t.semantic === 0 &&
      t.keywords === 0 &&
      t.description === 0,
  );
  if (unmatched) return null;

  let total = 0;
  for (const t of termScores) {
    total +=
      t.displayName * 20 +
      t.normalizedName * 12 +
      t.originalName * 10 +
      t.module * 8 +
      t.page * 8 +
      t.breakpoint * 6 +
      t.semantic * 4 +
      t.keywords * 2 +
      t.description * 1;
  }

  const display = screen.displayName.toLowerCase();
  const joinedTerms = terms.join(" ");
  if (display === joinedTerms) {
    total += 50;
  } else if (display.startsWith(joinedTerms)) {
    total += 30;
  } else if (display.includes(joinedTerms)) {
    total += 20;
  }

  return {
    screen,
    score: total,
    matchedTerms: termScores.length,
    totalTerms: terms.length,
  };
}

function passesFilters(screen: Screen, filters: SearchFilters): boolean {
  if (filters.productId && screen.productId !== filters.productId) return false;
  if (filters.moduleId && screen.moduleId !== filters.moduleId) return false;
  if (filters.figmaPageId && screen.figmaPageId !== filters.figmaPageId)
    return false;
  if (filters.breakpointId && screen.breakpointId !== filters.breakpointId)
    return false;
  if (filters.status && screen.status !== filters.status) return false;
  if (filters.behavior && screen.behavior !== filters.behavior) return false;
  if (filters.state && screen.state !== filters.state) return false;
  if (filters.scenario && screen.scenario !== filters.scenario) return false;
  if (filters.source && screen.source !== filters.source) return false;
  if (filters.includeMock === false && screen.source === "mock") return false;
  return true;
}

export function searchScreens(
  query: string,
  filters: SearchFilters = {},
): SearchResult[] {
  const terms = normalizeForSearch(query);

  return screens
    .filter((screen) => passesFilters(screen, filters))
    .map((screen) =>
      terms.length === 0
        ? { screen, score: 0, matchedTerms: 0, totalTerms: 0 }
        : scoreScreen(screen, terms),
    )
    .filter((result): result is SearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score);
}

export function getFilterOptions() {
  return {
    products,
    modules,
    pages: figmaPages,
    breakpoints,
    statuses: ["draft", "qa_ready", "deprecated", "archived", "missing_review"],
  };
}
