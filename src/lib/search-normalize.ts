/**
 * Shared, pure, client-safe search normalization for the Navigator. No DB / no
 * server-only imports. Used by both the indexer's deterministic alias builder
 * and the client-side search ranking so query and indexed text normalize the
 * same way.
 *
 * Handles: case/whitespace/punctuation folding; a SMALL deterministic compound
 * map (popup↔pop up, dropdown↔drop down, checkbox↔check box); and CONSERVATIVE
 * singular/plural matching via a guarded stem (never destructive — "access",
 * "status", "business", "-ss" words are protected, and the original token is
 * always preserved).
 */

// Solid compounds → spaced form, applied before tokenizing so all variants
// converge (e.g. "popup"/"pop-up"/"pop up" -> tokens ["pop","up"]).
const COMPOUNDS: Array<[RegExp, string]> = [
  [/pop-?ups?\b/gi, "pop up"],
  [/drop-?downs?\b/gi, "drop down"],
  [/check-?box(es)?\b/gi, "check box"],
];

/** Lowercase, expand compounds, collapse whitespace. Punctuation kept for
 *  substring checks but folded to spaces by tokenize(). */
export function normalizeString(s: string): string {
  let out = s.toLowerCase();
  for (const [re, rep] of COMPOUNDS) out = out.replace(re, rep);
  return out.replace(/\s+/g, " ").trim();
}

/** Split into alphanumeric tokens (compounds already expanded). */
export function tokenize(s: string): string[] {
  return normalizeString(s).split(/[^a-z0-9]+/).filter(Boolean);
}

// Words that end in "s" but are NOT plurals — never stem these.
const NO_STEM = new Set([
  "status", "focus", "bonus", "virus", "analysis", "access", "business",
  "address", "process", "class", "press", "progress", "success", "series",
  "species", "news", "gas", "bus", "lens", "axis", "basis", "cross", "less",
]);

/**
 * Conservative morphological stem for plural matching. Returns the singular stem
 * only for safe cases; otherwise returns the token unchanged. Real English
 * plural rules only (…ses/xes/zes/ches/shes -> strip "es"; …s -> strip "s"),
 * with "-ss" and a stoplist protected. Never call this to REPLACE a token —
 * always keep the original alongside the stem (see tokenVariants).
 */
export function tokenStem(t: string): string {
  if (t.length <= 3 || NO_STEM.has(t) || t.endsWith("ss")) return t;
  if (t.length > 4 && /(s|x|z|ch|sh)es$/.test(t)) return t.slice(0, -2); // boxes->box
  if (t.endsWith("s")) return t.slice(0, -1); // adjustments->adjustment, dates->date
  return t;
}

/** The set of forms a token should match against: itself + its stem. */
export function tokenVariants(t: string): Set<string> {
  const v = new Set<string>([t]);
  const s = tokenStem(t);
  if (s !== t) v.add(s);
  return v;
}

/**
 * Does a query token match any indexed token? True on exact, stem-equal, or
 * prefix (query token is a prefix of an indexed token, len>=2 to avoid noise).
 */
export function queryTokenMatches(indexedStems: Set<string>, indexedTokens: Set<string>, qToken: string): boolean {
  if (indexedTokens.has(qToken)) return true;
  const qStem = tokenStem(qToken);
  if (indexedStems.has(qStem)) return true;
  if (qToken.length >= 2) {
    for (const it of indexedTokens) if (it.startsWith(qToken)) return true;
  }
  return false;
}

/** Build the indexed token + stem sets for a set of source strings. */
export function buildTokenIndex(strings: (string | null | undefined)[]): { tokens: Set<string>; stems: Set<string> } {
  const tokens = new Set<string>();
  const stems = new Set<string>();
  for (const s of strings) {
    if (!s) continue;
    for (const t of tokenize(s)) { tokens.add(t); stems.add(tokenStem(t)); }
  }
  return { tokens, stems };
}

/**
 * Deterministic alias builder for a screen. Produces a small, bounded set of
 * normalized searchable strings from the screen's canonical name + authored
 * search titles + parent section/flow — no synonyms, no AI, no explosion.
 */
export function buildScreenAliases(input: {
  name: string;
  searchTitles: string[];
  parentSectionName?: string | null;
  parentFlowName?: string | null;
}): string[] {
  const singles = [input.name, ...input.searchTitles, input.parentSectionName ?? "", input.parentFlowName ?? ""]
    .map((s) => normalizeString(s))
    .filter(Boolean);

  // Bounded cross-combinations: each authored title paired with the section
  // core, so "Adjustment / Pop-up" (section-ish) + "Rate Group" (title) also
  // reads as "adjustment rate group" etc. Capped to avoid combinatorial blowup.
  const combos: string[] = [];
  const sectionCore = normalizeString(input.parentSectionName ?? input.name);
  for (const t of input.searchTitles.slice(0, 4)) {
    const tc = normalizeString(t);
    if (!tc || tc === sectionCore) continue;
    combos.push(`${sectionCore} ${tc}`);
  }

  const all = [...singles, ...combos]
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [...new Set(all)].slice(0, 16);
}
