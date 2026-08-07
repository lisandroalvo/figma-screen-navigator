/**
 * Page classification rules for Figma files.
 *
 * Some Figma pages are reserved for design system purposes and should not
 * be indexed as product screens.
 */

/**
 * Reserved Figma page names that should be excluded from screen indexing.
 *
 * These pages typically contain reusable component libraries and should not
 * be treated as product screens.
 */
const IGNORED_FIGMA_PAGE_NAMES = new Set(["component", "components"]);

/**
 * Determines if a Figma page should be ignored during screen indexing.
 *
 * Pages with reserved names (e.g., "Components", "Component") are used for
 * design system component libraries and should not be indexed as screens.
 *
 * @param name - The Figma page name to check
 * @returns true if the page should be ignored, false otherwise
 *
 * @example
 * shouldIgnoreFigmaPage("Components") // true
 * shouldIgnoreFigmaPage("component") // true
 * shouldIgnoreFigmaPage(" COMPONENTS ") // true
 * shouldIgnoreFigmaPage("Component Detail") // false
 * shouldIgnoreFigmaPage("Calculation Detail") // false
 */
export function shouldIgnoreFigmaPage(name: string): boolean {
  return IGNORED_FIGMA_PAGE_NAMES.has(name.trim().toLowerCase());
}

/**
 * Page classification types.
 */
export type PageType = "product" | "components";

/**
 * Classifies a Figma page based on its name.
 *
 * @param name - The Figma page name
 * @returns The page type classification
 */
export function classifyFigmaPage(name: string): PageType {
  return shouldIgnoreFigmaPage(name) ? "components" : "product";
}
