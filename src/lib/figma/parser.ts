import type { FigmaFileResponse, FigmaNode } from "./client";
import { pilotConfig } from "./config";
import { shouldIgnoreFigmaPage } from "./page-classification";

export type Confidence = "high" | "medium" | "low" | "rejected";

export interface FigmaScreenCandidate {
  id: string;
  name: string;
  normalizedName: string;
  displayName: string;
  originalName: string;
  nodeType: string;
  pageId: string;
  pageName: string;
  pageNodeId: string;
  sectionName?: string; // Logical screen section (parent of breakpoint section)
  breakpointId?: string;
  breakpointName?: string;
  breakpointCode?: string;
  parentPath: { id: string; name: string; type: string }[];
  fullParentPath: { id: string; name: string; type: string }[];
  immediateParent?: { id: string; name: string; type: string };
  width: number;
  height: number;
  visible: boolean;
  metadata: {
    screen?: string;
    flow?: string;
    step?: string;
    scenario?: string;
    option?: string;
    condition?: string;
    behavior?: string;
    state?: string;
  };
  ambiguityFlags: string[];
  confidence: Confidence;
  confidenceScore: number;
  detectionReasons: string[];
  rejectionReasons: string[];
  childFrameCount: number;
  widthRatio?: number;
  containsShell: boolean;
  generic: boolean;
  depth: number;
  nestedIn?: string;
  hierarchyPattern: import("./config").HierarchyPattern;
}

export interface FigmaParseResult {
  fileKey: string;
  fileName: string;
  pages: {
    id: string;
    name: string;
    normalizedName: string;
    nodeId: string;
    included: boolean;
    reason?: string;
  }[];
  breakpoints: {
    id: string;
    name: string;
    code: string;
    width?: number;
    height?: number;
    pageId: string;
    pageName: string;
  }[];
  screens: FigmaScreenCandidate[];
  ignored: { id: string; name: string; reason: string }[];
  rejected: FigmaScreenCandidate[];
  counts: {
    high: number;
    medium: number;
    low: number;
    rejected: number;
    ignored: number;
  };
  detectedScreenIds: Set<string>; // Track detected screens to prevent nested detection
}

const IGNORED_PAGE_PATTERNS = [
  /interactive\s*prototype/i,
  /prototype\s*documentation/i,
  /how\s*to\s*play/i,
  /^cover\b/i,
  /^archive\b/i,
  /^deprecated\b/i,
  /^scratch\b/i,
];

const BEHAVIORS = [
  "Tooltip",
  "Popover",
  "Modal",
  "Accordion",
  "Drawer",
  "Dropdown",
  "Toast",
];

const STATES = [
  "Default",
  "Open",
  "Closed",
  "Expanded",
  "Collapsed",
  "Empty",
  "Loading",
  "Error",
  "Validation Error",
  "Success",
  "Disabled",
  "Read Only",
  "No Access",
  "Early",
  "Vested",
];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
    .replace(/[\/\\|–—\-_.;:,'"!?()[\]{}<>@#$^*+=~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeName(name: string): string[] {
  return name
    .split(/[\/\\|–—\-_.;:,'"!?()[\]{}<>@#$^*+=~`]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Checks if a node represents a breakpoint container.
 * Breakpoints are typically FRAME or SECTION nodes with dimension indicators.
 */
function isBreakpoint(node: FigmaNode): { is: boolean; code?: string } {
  if (node.type !== "FRAME" && node.type !== "SECTION") return { is: false };
  const hasDims =
    (node.absoluteBoundingBox?.width ?? 0) > 0 &&
    (node.absoluteBoundingBox?.height ?? 0) > 0;
  if (!hasDims) return { is: false };

  const dimension = /\b\d+\s*px|\b(1280|1024|768|640|540|414|390|375|360)\b/i;
  if (!dimension.test(node.name)) return { is: false };

  const patterns = [
    { code: "xl", pattern: /\b(?:xl|extra[-\s]?large)\b/i },
    { code: "lg", pattern: /\b(?:lg|large)\b/i },
    { code: "md", pattern: /\b(?:md|medium|tablet)\b/i },
    { code: "sm", pattern: /\b(?:sm|small|mobile)\b/i },
    { code: "xs", pattern: /\b(?:xs|extra[-\s]?small)\b/i },
  ];
  for (const bp of patterns) {
    if (bp.pattern.test(node.name) || bp.pattern.test(node.name.toLowerCase())) {
      return { is: true, code: bp.code };
    }
  }
  return { is: false };
}

/**
 * Checks if a node is a breakpoint section that should contain screen variants.
 * This is used to identify the hierarchical pattern:
 * Logical Screen Section → Breakpoint Section → Screen Variant
 */
function isBreakpointSection(node: FigmaNode): { is: boolean; code?: string } {
  if (node.type !== "SECTION") return { is: false };
  
  const patterns = [
    { code: "xl", pattern: /^xl$/i },
    { code: "lg", pattern: /^lg$/i },
    { code: "md", pattern: /^md$/i },
    { code: "sm", pattern: /^sm$/i },
    { code: "xs", pattern: /^xs$/i },
  ];
  
  const trimmedName = node.name.trim();
  for (const bp of patterns) {
    if (bp.pattern.test(trimmedName)) {
      return { is: true, code: bp.code };
    }
  }
  return { is: false };
}

/**
 * Checks if an INSTANCE node qualifies as a screen variant based on hierarchy.
 * 
 * Qualification rules:
 * 1. Must be an INSTANCE node
 * 2. Must have screen-like dimensions (width >= 320, height >= 400)
 * 3. Must be a direct child of a breakpoint section (XL, LG, MD, SM, XS)
 * 4. Must not be nested inside another screen candidate
 * 
 * This prevents nested component instances (buttons, headers, etc.) from
 * being detected as screens.
 * 
 * @param node - The INSTANCE node to check
 * @param parentPath - Path of ancestors (does NOT include the current node)
 * @param detectedScreenIds - Set of already-detected screen IDs
 */
function isQualifiedScreenInstance(
  node: FigmaNode,
  parentPath: { id: string; name: string; type: string }[],
  detectedScreenIds: Set<string>,
): boolean {
  if (node.type !== "INSTANCE") return false;
  
  // Check dimensions
  const width = node.absoluteBoundingBox?.width ?? 0;
  const height = node.absoluteBoundingBox?.height ?? 0;
  if (width < 320 || height < 400) return false;
  
  // Check if nested inside an already-detected screen
  for (const ancestor of parentPath) {
    if (detectedScreenIds.has(ancestor.id)) {
      return false; // Nested inside a screen, reject
    }
  }
  
  // Check if immediate parent is a breakpoint section
  // parentPath[parentPath.length - 1] is the immediate parent
  const immediateParent = parentPath[parentPath.length - 1];
  if (!immediateParent) return false;
  
  // Parent must be a SECTION with a breakpoint name (XL, LG, MD, SM, XS)
  if (immediateParent.type !== "SECTION") return false;
  
  const breakpointPattern = /^(xl|lg|md|sm|xs)$/i;
  return breakpointPattern.test(immediateParent.name.trim());
}

function parseBreakpointWidth(name: string): number | undefined {
  const m = name.match(/\b(\d+)\s*px\b/i) || name.match(/\b(1280|1024|768|640|540|414|390|375|360)\b/);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  return Number.isNaN(n) ? undefined : n;
}

function isComponentParent(name: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(name));
}

function matchBehaviorOrState(
  segment: string,
): { type: "behavior" | "state" | null; value: string } {
  const lower = segment.toLowerCase();
  for (const b of BEHAVIORS) {
    if (lower.includes(b.toLowerCase())) {
      return { type: "behavior", value: b };
    }
  }
  for (const s of STATES) {
    if (lower.includes(s.toLowerCase())) {
      return { type: "state", value: s };
    }
  }
  return { type: null, value: segment };
}

export function parseMetadata(name: string): {
  metadata: FigmaScreenCandidate["metadata"];
  ambiguityFlags: string[];
} {
  const segments = tokenizeName(name);
  const metadata: FigmaScreenCandidate["metadata"] = {};
  const ambiguityFlags: string[] = [];

  if (segments.length === 0) {
    ambiguityFlags.push("unclassified_segment");
    return { metadata, ambiguityFlags };
  }

  const screen = segments.shift();
  if (screen) metadata.screen = screen.trim();

  const classified: { type: "behavior" | "state" | "scenario"; value: string }[] = [];

  for (const raw of segments) {
    const segment = raw.trim();
    const match = matchBehaviorOrState(segment);
    if (match.type) {
      classified.push({ type: match.type, value: match.value });
    } else {
      classified.push({ type: "scenario", value: segment });
    }
  }

  const states = classified.filter((c) => c.type === "state");
  const behaviors = classified.filter((c) => c.type === "behavior");
  const scenarios = classified.filter((c) => c.type === "scenario");

  if (states.length > 0) {
    metadata.state = states[states.length - 1].value;
    if (states.length > 1) {
      ambiguityFlags.push("duplicate_state");
      scenarios.unshift(...states.slice(0, -1).map((s) => ({ ...s, type: "scenario" as const })));
    }
  }

  if (behaviors.length > 0) {
    metadata.behavior = behaviors[behaviors.length - 1].value;
    if (behaviors.length > 1) {
      ambiguityFlags.push("duplicate_behavior");
    }
  }

  if (scenarios.length > 0) {
    if (scenarios.length === 1) {
      metadata.scenario = scenarios[0].value;
    } else if (scenarios.length === 2) {
      metadata.scenario = scenarios[0].value;
      metadata.option = scenarios[1].value;
    } else if (scenarios.length >= 3) {
      metadata.scenario = scenarios[0].value;
      metadata.option = scenarios[1].value;
      metadata.condition = scenarios.slice(2).map((s) => s.value).join(" / ");
    }
  }

  return { metadata, ambiguityFlags };
}

function getPageConfig(pageName: string) {
  const key = normalizeText(pageName);
  return pilotConfig.pageConfigs[key] ?? pilotConfig.defaultPageConfig;
}

function hasShellDescendants(node: FigmaNode): boolean {
  return (node.children ?? []).some(
    (c) =>
      pilotConfig.shellChildPatterns.some((p) => p.test(c.name)) ||
      hasShellDescendants(c),
  );
}

function inferBreakpointFromDimensions(
  w: number,
): { name: string; code: string; width: number } | undefined {
  const bp = [
    { code: "xl", width: 1280 },
    { code: "lg", width: 1024 },
    { code: "md", width: 768 },
    { code: "sm", width: 640 },
    { code: "xs", width: 414 },
  ];
  for (const b of bp) {
    if (Math.abs(w - b.width) <= 20) {
      return { name: b.code, code: b.code, width: b.width };
    }
  }
  return undefined;
}

function resolveConfidence(
  node: FigmaNode,
  config: ReturnType<typeof getPageConfig>,
  currentBreakpoint: { id?: string; name?: string; code: string; width?: number; height?: number } | undefined,
  depth: number,
  parentName: string,
): {
  confidence: Confidence;
  score: number;
  detectionReasons: string[];
  rejectionReasons: string[];
  ambiguityFlags: string[];
  containsShell: boolean;
  generic: boolean;
  widthRatio?: number;
  inferredBreakpoint?: { id?: string; name?: string; code: string; width: number };
} {
  const reasons: string[] = [];
  const rejections: string[] = [];
  const ambiguity: string[] = [];

  const w = node.absoluteBoundingBox?.width ?? 0;
  const h = node.absoluteBoundingBox?.height ?? 0;

  // If the node is not inside an explicitly named breakpoint, infer one from
  // its own width. This lets full-size wireframes sitting directly under a
  // page-level group still receive a breakpoint and width ratio.
  const inferredBreakpoint = !currentBreakpoint
    ? inferBreakpointFromDimensions(w)
    : undefined;
  const bpWidth =
    currentBreakpoint?.width ?? inferredBreakpoint?.width ?? undefined;
  const bpHeight = currentBreakpoint?.height;
  const widthRatio = bpWidth && bpWidth > 0 ? w / bpWidth : undefined;
  const heightRatio = bpHeight && bpHeight > 0 ? h / bpHeight : undefined;

  const children = node.children ?? [];
  const containsShell = hasShellDescendants(node);

  // For INSTANCE nodes, be more lenient with generic names
  // "Layout Instance" or "Component Instance" are acceptable for component-based screens
  const generic = node.type === "INSTANCE"
    ? /^(frame|group|rectangle|ellipse)\s*\d*$/i.test(node.name.trim()) || /^\d+$/.test(node.name.trim())
    : /\b(frame|group|rectangle|ellipse|component|instance)\s*\d*\b/i.test(node.name) || /^\d+$/.test(node.name.trim());

  if (generic) {
    rejections.push("generic name");
    ambiguity.push("generic_name");
  }
  if (pilotConfig.ignoreNamePatterns.some((p) => p.test(node.name))) {
    rejections.push("ignored name pattern");
  }
  if (isComponentParent(parentName, pilotConfig.componentParentPatterns)) {
    rejections.push("parent indicates component internal");
    ambiguity.push("possible_component_internal");
  }
  if (w < config.minWidth || h < config.minHeight) {
    rejections.push("dimensions below configured minimum");
    ambiguity.push("unusual_dimensions");
  }
  if (widthRatio !== undefined && widthRatio < config.minWidthRatio) {
    rejections.push("width ratio below configured minimum");
    ambiguity.push("low_width_ratio");
  }

  const hasBehaviorInName = pilotConfig.behaviorKeywords.some((b) =>
    new RegExp(`\\b${b}\\b`, "i").test(node.name),
  );
  if (
    hasBehaviorInName &&
    widthRatio !== undefined &&
    widthRatio < 0.8
  ) {
    rejections.push("behavior overlay, not a complete wireframe");
    ambiguity.push("standalone_behavior_uncertain");
  }
  if (depth > config.maxDepth) {
    rejections.push("exceeded max indexing depth");
    ambiguity.push("uncertain_parent_boundary");
  }
  // Allow both FRAME and INSTANCE nodes as screen candidates
  if (node.type !== "FRAME" && node.type !== "INSTANCE") {
    rejections.push(`node type is ${node.type}`);
  }

  if (rejections.length > 0) {
    return {
      confidence: "rejected",
      score: 0,
      detectionReasons: reasons,
      rejectionReasons: rejections,
      ambiguityFlags: ambiguity,
      containsShell,
      generic,
      widthRatio,
      inferredBreakpoint,
    };
  }

  let score = 50;

  if (currentBreakpoint) {
    reasons.push("under recognized breakpoint");
    score += 20;
  } else if (inferredBreakpoint) {
    reasons.push("width matches a standard breakpoint");
    score += 15;
    if (depth <= 2) {
      reasons.push("direct child of page");
      score += 5;
    }
  } else if (depth <= 2) {
    reasons.push("direct child of page");
    score += 10;
  } else {
    ambiguity.push("responsive_parent_uncertain");
  }

  if (widthRatio !== undefined) {
    if (widthRatio >= 0.9) {
      reasons.push("width matches breakpoint closely");
      score += 25;
    } else if (widthRatio >= 0.8) {
      reasons.push("width close to breakpoint");
      score += 20;
    } else if (widthRatio >= config.minWidthRatio) {
      reasons.push("width above minimum ratio");
      score += 10;
      ambiguity.push("low_width_ratio");
    }
  }

  if (heightRatio !== undefined && heightRatio >= 0.6) {
    reasons.push("height close to breakpoint");
    score += 10;
  }

  const behaviorChildren = children.filter((c) =>
    pilotConfig.behaviorKeywords.some((b) =>
      new RegExp(`\\b${b}\\b`, "i").test(c.name),
    ),
  );

  if (containsShell) {
    reasons.push("contains recognizable application shell");
    score += 20;
  } else if (behaviorChildren.length > 0) {
    reasons.push("contains behavior variants");
    score += 10;
  } else {
    ambiguity.push("possible_layout_container");
  }

  if (!generic) {
    reasons.push("descriptive non-generic name");
    score += 15;
  }

  const structuralChildren = children.filter(
    (c) => c.type === "FRAME" || c.type === "SECTION",
  );
  if (structuralChildren.length === 0) {
    reasons.push("leaf wireframe");
    score += 10;
  } else if (behaviorChildren.length === structuralChildren.length) {
    reasons.push("contains only behavior-variant children");
    score += 10;
  } else if (containsShell || (widthRatio && widthRatio >= 0.9)) {
    reasons.push("full-size wireframe with internal layout");
    score += 10;
  } else {
    ambiguity.push("possible_layout_container");
  }

  const { ambiguityFlags } = parseMetadata(node.name);
  ambiguity.push(...ambiguityFlags);

  let confidence: Confidence = "medium";
  if (
    score >= 85 &&
    (currentBreakpoint || inferredBreakpoint) &&
    (containsShell || (widthRatio && widthRatio >= 0.9))
  ) {
    confidence = "high";
  } else if (score < 60 || ambiguity.length > 1) {
    confidence = "low";
  }

  return {
    confidence,
    score,
    detectionReasons: reasons,
    rejectionReasons: rejections,
    ambiguityFlags: ambiguity,
    containsShell,
    generic,
    widthRatio,
    inferredBreakpoint,
  };
}

export function parseFigmaFile(
  fileKey: string,
  file: FigmaFileResponse,
): FigmaParseResult {
  const result: FigmaParseResult = {
    fileKey,
    fileName: file.name,
    pages: [],
    breakpoints: [],
    screens: [],
    ignored: [],
    rejected: [],
    counts: { high: 0, medium: 0, low: 0, rejected: 0, ignored: 0 },
    detectedScreenIds: new Set(),
  };

  for (const page of file.document.children ?? []) {
    // Check if this is a component library page
    const isComponentsPage = shouldIgnoreFigmaPage(page.name);
    
    // Check if this matches other ignored patterns
    const isIgnoredPattern = IGNORED_PAGE_PATTERNS.some((p) => p.test(page.name));
    
    const isIgnoredPage = isComponentsPage || isIgnoredPattern;
    
    if (page.type !== "CANVAS" || isIgnoredPage) {
      let reason = "not a canvas";
      if (isComponentsPage) {
        reason = "reserved component-library page";
      } else if (isIgnoredPattern) {
        reason = "ignored page pattern";
      }
      
      result.pages.push({
        id: page.id,
        name: page.name,
        normalizedName: normalizeText(page.name),
        nodeId: page.id,
        included: false,
        reason,
      });
      result.ignored.push({ id: page.id, name: page.name, reason });
      result.counts.ignored++;
      continue;
    }

    result.pages.push({
      id: page.id,
      name: page.name,
      normalizedName: normalizeText(page.name),
      nodeId: page.id,
      included: true,
    });

    const pageConfig = getPageConfig(page.name);
    const basePath = [
      { id: fileKey, name: file.name, type: "module" },
      { id: page.id, name: page.name, type: "page" },
    ];

    const pageScreens = collect(
      page,
      basePath,
      undefined,
      page.id,
      pageConfig,
      0,
      result,
      "",
    );

    for (const s of pageScreens) {
      result.screens.push(s);
    }
  }

  for (const s of result.screens) {
    if (s.confidence === "high") result.counts.high++;
    if (s.confidence === "medium") result.counts.medium++;
    if (s.confidence === "low") result.counts.low++;
  }

  for (let i = 0; i < result.rejected.length; i++) {
    result.counts.rejected++;
  }

  return result;
}

function collect(
  node: FigmaNode,
  parentPath: { id: string; name: string; type: string }[],
  currentBreakpoint: { id: string; name: string; code: string; width?: number; height?: number } | undefined,
  pageId: string,
  config: ReturnType<typeof getPageConfig>,
  depth: number,
  result: FigmaParseResult,
  parentName: string,
): FigmaScreenCandidate[] {
  if (node.visible === false) return [];

  const entry = { id: node.id, name: node.name, type: node.type };
  const fullPath = [...parentPath, entry];

  // Check for traditional breakpoint nodes (with dimension indicators)
  const bp = isBreakpoint(node);
  if (bp.is) {
    result.breakpoints.push({
      id: node.id,
      name: node.name,
      code: bp.code ?? "unknown",
      width: node.absoluteBoundingBox?.width,
      height: node.absoluteBoundingBox?.height,
      pageId,
      pageName: parentPath.find((p) => p.type === "page")?.name ?? "",
    });

    const bpInfo = {
      id: node.id,
      name: node.name,
      code: bp.code ?? "unknown",
      width: parseBreakpointWidth(node.name) ?? node.absoluteBoundingBox?.width,
      height: undefined,
    };

    const found: FigmaScreenCandidate[] = [];
    for (const child of node.children ?? []) {
      found.push(...collect(child, fullPath, bpInfo, pageId, config, depth + 1, result, node.name));
    }
    return found;
  }

  // Check for simple breakpoint sections (just "XL", "LG", "MD", "SM", "XS")
  // These are used in component-based hierarchies
  const bpSection = isBreakpointSection(node);
  if (bpSection.is) {
    const bpInfo = {
      id: node.id,
      name: node.name,
      code: bpSection.code ?? "unknown",
      width: node.absoluteBoundingBox?.width,
      height: node.absoluteBoundingBox?.height,
    };

    const found: FigmaScreenCandidate[] = [];
    for (const child of node.children ?? []) {
      found.push(...collect(child, fullPath, bpInfo, pageId, config, depth + 1, result, node.name));
    }
    return found;
  }

  // Build child candidates first. Only child candidates that are not rejected
  // are passed back up the tree; rejected leaves are recorded separately so
  // that they do not block parents from being treated as wireframes.
  const childCandidates: FigmaScreenCandidate[] = [];
  for (const child of node.children ?? []) {
    const childRes = collect(
      child,
      fullPath,
      currentBreakpoint,
      pageId,
      config,
      depth + 1,
      result,
      node.name,
    );
    for (const c of childRes) {
      if (c.confidence !== "rejected") {
        childCandidates.push(c);
      }
    }
  }

  // Handle FRAME nodes (existing logic)
  if (node.type === "FRAME") {
    const candidate = buildCandidate(
      node,
      fullPath,
      currentBreakpoint,
      pageId,
      config,
      depth,
      parentName,
      result.detectedScreenIds,
    );

    if (candidate.confidence === "rejected") {
      result.rejected.push(candidate);
      const isInternal =
        candidate.rejectionReasons.includes("generic name") ||
        candidate.rejectionReasons.includes("ignored name pattern") ||
        candidate.rejectionReasons.includes("parent indicates component internal") ||
        candidate.rejectionReasons.includes("exceeded max indexing depth");
      return isInternal ? [] : childCandidates;
    }

    // If this node has non-rejected child candidates, it is a layout
    // container rather than a leaf wireframe. The child candidates are kept
    // and this node is recorded as rejected so it does not become a duplicate.
    if (childCandidates.length > 0) {
      candidate.confidence = "rejected";
      candidate.confidenceScore = 0;
      candidate.rejectionReasons.push("contains nested wireframe candidates");
      candidate.ambiguityFlags.push("possible_layout_container");
      result.rejected.push(candidate);
      return childCandidates;
    }

    // Mark this as a detected screen to prevent nested instances from being detected
    result.detectedScreenIds.add(node.id);
    return [candidate];
  }

  // Handle INSTANCE nodes (component-based screens)
  if (node.type === "INSTANCE") {
    // Check if this instance qualifies as a screen variant
    // Note: parentPath doesn't include the current node yet
    if (!isQualifiedScreenInstance(node, parentPath, result.detectedScreenIds)) {
      // Not a qualified screen instance, but might contain child screens
      return childCandidates;
    }

    // Use currentBreakpoint if available (set by breakpoint section parent)
    const breakpointInfo = currentBreakpoint;

    const candidate = buildCandidate(
      node,
      fullPath,
      breakpointInfo,
      pageId,
      config,
      depth,
      parentName,
      result.detectedScreenIds,
    );

    if (candidate.confidence === "rejected") {
      result.rejected.push(candidate);
      return childCandidates;
    }

    // Mark this as a detected screen to prevent nested instances from being detected
    result.detectedScreenIds.add(node.id);
    
    // Don't recurse into children of INSTANCE nodes to avoid detecting nested components
    return [candidate];
  }

  return childCandidates;
}

function buildCandidate(
  node: FigmaNode,
  fullPath: { id: string; name: string; type: string }[],
  currentBreakpoint: { id: string; name: string; code: string; width?: number; height?: number } | undefined,
  pageId: string,
  config: ReturnType<typeof getPageConfig>,
  depth: number,
  parentName: string,
  _detectedScreenIds: Set<string>,
): FigmaScreenCandidate {
  const w = node.absoluteBoundingBox?.width ?? 0;
  const h = node.absoluteBoundingBox?.height ?? 0;
  const pageName =
    fullPath.find((p) => p.type === "page")?.name ?? "";

  const resolved = resolveConfidence(
    node,
    config,
    currentBreakpoint,
    depth,
    parentName,
  );

  const { metadata, ambiguityFlags } = parseMetadata(node.name);

  const allAmbiguity = Array.from(
    new Set([...resolved.ambiguityFlags, ...ambiguityFlags]),
  );

  // Extract section name for component-based hierarchy
  // Pattern: Page → Logical Screen Section → Breakpoint Section → Instance
  // We want the section name before the breakpoint section
  let sectionName: string | undefined;
  if (node.type === "INSTANCE" && fullPath.length >= 3) {
    // Check if immediate parent is a breakpoint section
    const immediateParent = fullPath[fullPath.length - 2];
    if (immediateParent && immediateParent.type === "SECTION") {
      const bpCheck = isBreakpointSection(immediateParent as FigmaNode);
      if (bpCheck.is) {
        // Parent of breakpoint section is the logical screen section
        const logicalScreenSection = fullPath[fullPath.length - 3];
        if (logicalScreenSection && logicalScreenSection.type === "SECTION") {
          sectionName = logicalScreenSection.name;
        }
      }
    }
  }

  return {
    id: node.id,
    name: node.name,
    normalizedName: normalizeText(node.name),
    displayName: node.name,
    originalName: node.name,
    nodeType: node.type,
    pageId,
    pageName,
    pageNodeId: pageId,
    sectionName,
    breakpointId: currentBreakpoint?.id ?? resolved.inferredBreakpoint?.id,
    breakpointName: currentBreakpoint?.name ?? resolved.inferredBreakpoint?.name,
    breakpointCode: currentBreakpoint?.code ?? resolved.inferredBreakpoint?.code,
    parentPath: fullPath.filter((p) =>
      ["product", "module", "page", "breakpoint"].includes(p.type),
    ),
    fullParentPath: fullPath,
    immediateParent: fullPath.length > 1 ? fullPath[fullPath.length - 2] : undefined,
    width: w,
    height: h,
    hierarchyPattern: config.hierarchyPattern,
    visible: node.visible === false ? false : true,
    metadata,
    ambiguityFlags: allAmbiguity,
    confidence: resolved.confidence,
    confidenceScore: resolved.score,
    detectionReasons: resolved.detectionReasons,
    rejectionReasons: resolved.rejectionReasons,
    childFrameCount: (node.children ?? []).filter((c) => c.type === "FRAME").length,
    widthRatio: resolved.widthRatio,
    containsShell: resolved.containsShell,
    generic: resolved.generic,
    depth,
  };
}
