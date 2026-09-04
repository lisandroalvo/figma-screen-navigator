import type { FigmaNode } from "@/lib/figma/client";

/**
 * Structural SCREEN-root detection (Module -> Page -> Flow -> Screen).
 *
 * A Screen is the outer root FRAME representing one complete UI wireframe/state
 * drawn inside a Flow SECTION. Detection is STRUCTURAL, in this evidence order:
 * node hierarchy -> node type -> node name -> bounding box. It deliberately does
 * NOT rely on dimensions alone (large annotation/label areas are also big).
 *
 * Validated against the Annuity Distribution Eligibility file (2026-08-21):
 * each screen root is a FRAME containing (a) a wireframe INSTANCE named like
 * "…Layout" at ~breakpoint width x ~800, and (b) a title TEXT child whose text
 * is the authored screen name. Connectors (VECTOR arrows), annotations ("Note"),
 * flow-label TEXT, divider RECTANGLEs and label GROUPs are rejected. Once a
 * frame is accepted as a screen root we do NOT descend into it, so its inner
 * components never become separate screens (no nested duplicates).
 */

export type ScreenVerdict = "accept" | "needs_review" | "reject";

export interface DetectedScreen {
  figmaNodeId: string;
  figmaFrameName: string;
  name: string; // authored screen name (title TEXT) or frame name fallback
  width: number;
  height: number;
  confidence: "high" | "medium";
  reason: string;
  verdict: ScreenVerdict;
}

interface BoxNode extends FigmaNode {
  characters?: string;
}

const w = (n: BoxNode) => Math.round(n.absoluteBoundingBox?.width ?? 0);
const h = (n: BoxNode) => Math.round(n.absoluteBoundingBox?.height ?? 0);

const REJECT_TYPES = new Set(["VECTOR", "TEXT", "RECTANGLE", "ELLIPSE", "LINE", "GROUP"]);
const CONTAINER_TYPES = new Set(["FRAME", "INSTANCE", "COMPONENT"]);

function isAnnotation(n: FigmaNode): boolean {
  return /^notes?\b/i.test(n.name.trim());
}

/** A wireframe content instance = the actual UI drawn inside a screen frame. */
function layoutInstance(frame: FigmaNode): BoxNode | null {
  for (const c of frame.children ?? []) {
    const x = c as BoxNode;
    if (CONTAINER_TYPES.has(c.type) && /layout/i.test(c.name) && w(x) >= 400 && h(x) >= 400) {
      return x;
    }
  }
  return null;
}

/** The screen's authored name = its first non-empty TEXT child; else frame name. */
function authoredName(frame: FigmaNode): { name: string; fromText: boolean } {
  for (const c of frame.children ?? []) {
    const x = c as BoxNode;
    if (c.type === "TEXT" && x.characters && x.characters.trim()) {
      return { name: x.characters.trim(), fromText: true };
    }
  }
  return { name: frame.name, fromText: false };
}

/**
 * The container whose direct children are the screen roots. If a Flow SECTION
 * wraps a single nested SECTION (as the main Annuity flow does), the screens
 * live inside that nested section — descend one level.
 */
export function screenContainer(section: FigmaNode): FigmaNode {
  const kids = section.children ?? [];
  const sectionKids = kids.filter((c) => c.type === "SECTION");
  if (kids.length === 1 && sectionKids.length === 1) return sectionKids[0];
  return section;
}

function classify(child: FigmaNode): DetectedScreen {
  const x = child as BoxNode;
  const base = {
    figmaNodeId: child.id,
    figmaFrameName: child.name,
    width: w(x),
    height: h(x),
  };

  if (REJECT_TYPES.has(child.type)) {
    return { ...base, name: child.name, verdict: "reject", confidence: "medium",
      reason: `${child.type.toLowerCase()} (connector/label/divider/decoration)` };
  }
  if (isAnnotation(child)) {
    return { ...base, name: child.name, verdict: "reject", confidence: "medium", reason: "annotation note" };
  }
  if (!CONTAINER_TYPES.has(child.type)) {
    return { ...base, name: child.name, verdict: "reject", confidence: "medium", reason: `unhandled type ${child.type}` };
  }

  const layout = layoutInstance(child);
  const title = authoredName(child);
  const viewportLike = w(x) >= 500 && h(x) >= 500;

  if (layout && viewportLike) {
    return { ...base, name: title.name, verdict: "accept", confidence: "high",
      reason: `frame with '${layout.name}' ${w(layout)}x${h(layout)} wireframe + ${title.fromText ? "title text" : "frame name"}` };
  }
  if (viewportLike) {
    return { ...base, name: title.name, verdict: "needs_review", confidence: "medium",
      reason: "viewport-sized frame but no recognizable wireframe/layout instance" };
  }
  return { ...base, name: title.name, verdict: "reject", confidence: "medium",
    reason: `too small / supporting UI (${w(x)}x${h(x)})` };
}

/** Detect screen roots within a Flow SECTION node. Non-recursive by design. */
export function detectScreens(flowSection: FigmaNode): DetectedScreen[] {
  const container = screenContainer(flowSection);
  return (container.children ?? []).map(classify);
}

// ============================================================================
// GLOBAL structural screen detection (all modules).
//
// Grounded in a raw audit of all 16 current NBF-MODULES files (2026-08-24). A
// real screen/state is a FRAME or INSTANCE that is a DIRECT CHILD of a SECTION,
// screen-sized RELATIVE to its screen-siblings (not a fixed pixel threshold),
// and NOT inside a COMPONENT/COMPONENT_SET (which holds component variants like
// Button/Default/Hover). Rejects: TEXT titles/notes, VECTOR/RECTANGLE, tiny
// table-row INSTANCEs deep in the tree, and component-definition subtrees.
// Once a node is accepted we do NOT descend into it → its inner UI never becomes
// a separate screen (§10 no nested duplicates).
// ============================================================================

const SCREEN_TYPES = new Set(["FRAME", "INSTANCE"]);
const isFlowSection = (n: FigmaNode) =>
  n.type === "SECTION" && n.name.trim().toLowerCase().endsWith("- flow");
const area = (n: BoxNode) => w(n) * h(n);
const isGenericName = (name: string) => /^(frame|group|component|rectangle)\s*\d+/i.test(name.trim());

export interface GlobalScreen {
  figmaNodeId: string;
  figmaNodeName: string;
  name: string;
  width: number;
  height: number;
  parentSectionNodeId: string | null;
  parentSectionName: string | null;
  parentFlowNodeId: string | null;
  parentFlowName: string | null;
  // Authored layer-name titles found inside the accepted screen (search only).
  searchTitles: string[];
  confidence: "high" | "medium";
  reason: string;
  verdict: "accept" | "needs_review";
}

// --- Search-title extraction (layer-name-first; TEXT extraction disabled) -----

// Container layer names that indicate a meaningful UI title/window/modal.
const TITLE_KEYWORD = /\b(modal|dialog|pop[\s-]?up|drawer|panel|sheet|overlay|window|wizard|flyout|banner|toast|tooltip)\b/i;
// The type words we strip to also expose the bare title ("Rate Group Modal" -> "Rate Group").
const TITLE_TYPE_WORD = /\s*[-–/|]?\s*\b(modal|dialog|pop[\s-]?up|popup|drawer|panel|sheet|overlay|window|wizard|flyout|banner|toast|tooltip)\b\s*$/i;
// Confirmed chrome / technical wrappers — never titles.
const CHROME_NAME = /^(frame|group|component|componentset|rectangle|instance|ellipse|vector|union|subtract|line|slice|image|img|mask|container|wrapper|content|layout|electron|status\s?bar|side-?bar|sidebar|bottom navigation|top navigation|navbar|nav|menu items?|participant menu items|scroll\s?bar|divider|spacer|placeholder|bg|background|overlay bg|autolayout|auto layout|shadow|blur|gradient)\b/i;

function isGenericOrChrome(name: string): boolean {
  const n = name.trim();
  if (n.length < 2) return true;
  if (!/[a-z]/i.test(n)) return true; // no letters (numbers/symbols only)
  if (isGenericName(n)) return true; // "Frame 123" etc.
  if (CHROME_NAME.test(n)) return true;
  return false;
}

/**
 * Extract authored search titles INSIDE an already-accepted screen node. Uses
 * layer names only (TEXT-node extraction intentionally disabled — proven noisy).
 * Bounded depth + visit cap. Precision-first: keyword containers at any depth,
 * plus significant non-generic direct-child containers. Returns exact authored
 * strings (dedup by normalized form), capped.
 */
export function extractScreenSearchTitles(screen: FigmaNode): string[] {
  const found: string[] = [];
  const seenNorm = new Set<string>();
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const push = (raw: string) => {
    const r = raw.trim();
    if (!r || isGenericOrChrome(r)) return;
    const k = norm(r);
    if (!k || seenNorm.has(k)) return;
    seenNorm.add(k);
    found.push(r);
  };

  const MAX_DEPTH = 6;
  let visited = 0;
  const MAX_VISIT = 4000;

  const screenBox = (screen as BoxNode).absoluteBoundingBox;
  const screenArea = screenBox ? screenBox.width * screenBox.height : 0;

  function walk(node: FigmaNode, depth: number) {
    if (visited++ > MAX_VISIT || depth > MAX_DEPTH) return;
    for (const c of node.children ?? []) {
      if (c.type === "FRAME" || c.type === "INSTANCE" || c.type === "COMPONENT") {
        const box = (c as BoxNode).absoluteBoundingBox;
        const a = box ? box.width * box.height : 0;
        const keyword = TITLE_KEYWORD.test(c.name);
        // Tier 1: keyword container at any (bounded) depth.
        if (keyword && !isGenericName(c.name)) {
          push(c.name);
          const bare = c.name.replace(TITLE_TYPE_WORD, "").trim();
          if (bare && norm(bare) !== norm(c.name)) push(bare);
        }
        // Tier 2 (precision-first): significant NON-generic container that is a
        // direct child of the screen (depth 0 -> its children are depth 1).
        else if (depth === 0 && !isGenericOrChrome(c.name) && screenArea > 0 && a >= 0.15 * screenArea) {
          push(c.name);
        }
      }
      walk(c, depth + 1);
    }
  }
  walk(screen, 0);
  return found.slice(0, 8);
}

interface WalkCtx {
  section: FigmaNode | null;
  flow: FigmaNode | null;
  insideComponent: boolean;
}

/** Choose the searchable name: authored node name, unless it is auto-generated
 *  ("Frame 8948459"), in which case fall back to a title TEXT child. */
function screenName(node: FigmaNode): string {
  if (!isGenericName(node.name)) return node.name;
  const t = authoredName(node);
  return t.fromText ? t.name : node.name;
}

function containerKidCount(node: FigmaNode): number {
  return (node.children ?? []).filter((c) => ["FRAME", "INSTANCE", "GROUP", "SECTION"].includes(c.type)).length;
}

/**
 * Walk a Page (CANVAS) tree collecting screen candidates. Screens are evaluated
 * only at SECTION boundaries: among a section's direct FRAME/INSTANCE children,
 * the screen-sized ones (relative to the largest sibling) are accepted.
 */
export function detectScreensGlobal(page: FigmaNode): GlobalScreen[] {
  const out: GlobalScreen[] = [];

  function visit(node: FigmaNode, ctx: WalkCtx) {
    const childCtx: WalkCtx = {
      section: node.type === "SECTION" ? node : ctx.section,
      flow: isFlowSection(node) ? node : ctx.flow,
      insideComponent: ctx.insideComponent || node.type === "COMPONENT" || node.type === "COMPONENT_SET",
    };

    if (node.type === "SECTION" && !childCtx.insideComponent) {
      // Screen candidates = direct FRAME/INSTANCE children of this section.
      const kids = node.children ?? [];
      const candidates = kids.filter((c) => SCREEN_TYPES.has(c.type));
      const maxArea = candidates.reduce((m, c) => Math.max(m, area(c as BoxNode)), 0);

      for (const c of kids) {
        if (SCREEN_TYPES.has(c.type)) {
          // Annotation notes ("Note"/"Notes") are not screens; skip + don't descend.
          if (isAnnotation(c)) continue;
          const accepted = classifyScreen(c as BoxNode, maxArea, candidates.length, node, childCtx.flow, out);
          if (accepted) continue; // do NOT descend into an accepted screen
        }
        visit(c, childCtx);
      }
      return;
    }

    for (const c of node.children ?? []) visit(c, childCtx);
  }

  visit(page, { section: null, flow: null, insideComponent: false });
  return out;
}

/** Returns true if the node was recorded (accept or needs_review) as a screen. */
function classifyScreen(
  node: BoxNode,
  maxSiblingArea: number,
  siblingScreenCount: number,
  section: FigmaNode,
  flow: FigmaNode | null,
  out: GlobalScreen[],
): boolean {
  const width = w(node), height = h(node);
  // Absolute floor: exclude buttons/fields/rows/icons.
  if (width < 300 || height < 300) return false;
  // Relative floor: must be screen-sized vs the largest sibling screen.
  if (maxSiblingArea > 0 && area(node) < 0.25 * maxSiblingArea) return false;
  // Must have real content (not an empty decorative frame).
  if (containerKidCount(node) < 1) return false;

  const base = {
    figmaNodeId: node.id,
    figmaNodeName: node.name,
    name: screenName(node),
    width, height,
    parentSectionNodeId: section.id,
    parentSectionName: section.name,
    parentFlowNodeId: flow?.id ?? null,
    parentFlowName: flow?.name ?? null,
    searchTitles: extractScreenSearchTitles(node),
  };

  // High confidence: part of a sibling-state group, OR clearly a primary screen.
  const siblingGroup = siblingScreenCount >= 2;
  const clearlyScreen = width >= 600 && height >= 400;
  if (siblingGroup || clearlyScreen) {
    out.push({
      ...base, confidence: "high", verdict: "accept",
      reason: `FRAME/INSTANCE child of SECTION "${section.name}" ${width}x${height}` +
        (siblingGroup ? `, sibling-state group (${siblingScreenCount})` : "") +
        (clearlyScreen ? ", screen-sized" : ""),
    });
    return true;
  }
  // Otherwise a solo mid-size frame — capture for review, not searchable.
  out.push({
    ...base, confidence: "medium", verdict: "needs_review",
    reason: `solo mid-size frame ${width}x${height} under SECTION "${section.name}"`,
  });
  return true;
}
