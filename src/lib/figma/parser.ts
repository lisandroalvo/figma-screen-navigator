import type { FigmaFileResponse, FigmaNode } from "./client";

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
  breakpointId?: string;
  breakpointName?: string;
  breakpointCode?: string;
  parentPath: { id: string; name: string; type: string }[];
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
  ignored: boolean;
  ignoreReason?: string;
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

const IGNORED_NAME_PATTERNS = [
  /\bcopy\b/i,
  /\btest\b/i,
  /\bold\b/i,
  /\barchive\b/i,
  /\barchived\b/i,
  /\bdeprecated\b/i,
  /\bfinal new\b/i,
  /\bv2\b/i,
  /\bbackup\b/i,
  /\btemp\b/i,
  /\bscratch\b/i,
  /\bframe\s+\d+/i,
  /\brectangle\s+\d+/i,
  /\bgroup\s+\d+/i,
  /\bellipse\s+\d+/i,
  /\bnote\b/i,
  /\bimage\b/i,
  /^arrow/i,
  /^vector/i,
  /^text\s/i,
  /^stage[-\s]/i,
  /^link\s+stages/i,
  /\b(header|chips|widget|rows|property)\b/i,
  /\b(button)\b/i,
  /\bpension calculation[-\s]table\b/i,
  /\btable[-\s](?:header|rows)\b/i,
];

const BREAKPOINT_PATTERNS = [
  { code: "xl", pattern: /\b(?:xl|extra[-\s]?large)\b(?![\s\w]*responsive)/i },
  { code: "lg", pattern: /\b(?:lg|large)\b(?![\s\w]*responsive)/i },
  { code: "md", pattern: /\b(?:md|medium|tablet)\b(?![\s\w]*responsive)/i },
  { code: "sm", pattern: /\b(?:sm|small|mobile)\b(?![\s\w]*responsive)/i },
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
    .replace(/[\/\\|–—\-_.;:,'"!?()[\]{}<>&%@#$^*+=~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeName(name: string): string[] {
  return name
    .split(/[\/\\|–—\-_.;:,'"!?()[\]{}<>@#$^*+=~`]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isIgnoredName(name: string): { ignored: boolean; reason?: string } {
  for (const pattern of IGNORED_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return {
        ignored: true,
        reason: `matched ignore pattern: ${pattern.source}`,
      };
    }
  }
  return { ignored: false };
}

const BREAKPOINT_DIMENSION = /\b\d+\s*px|\b(1280|1024|768|640|540|414|390|375|360)\b/i;

function isBreakpoint(node: FigmaNode): { is: boolean; code?: string } {
  if (node.type !== "FRAME" && node.type !== "SECTION") return { is: false };
  if (!hasBreakpointDimensions(node)) return { is: false };
  if (!BREAKPOINT_DIMENSION.test(node.name)) return { is: false };
  const normalized = node.name.toLowerCase();
  for (const bp of BREAKPOINT_PATTERNS) {
    if (bp.pattern.test(node.name) || bp.pattern.test(normalized)) {
      return { is: true, code: bp.code };
    }
  }
  return { is: false };
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

function hasDimensions(
  node: FigmaNode,
  minArea: number,
): { width: number; height: number } | null {
  const w = node.absoluteBoundingBox?.width ?? 0;
  const h = node.absoluteBoundingBox?.height ?? 0;
  if (w > 0 && h > 0 && w * h >= minArea) return { width: w, height: h };
  return null;
}

function hasBreakpointDimensions(node: FigmaNode) {
  return hasDimensions(node, 80_000);
}

function hasScreenDimensions(node: FigmaNode) {
  return hasDimensions(node, 50_000);
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
  };

  for (const page of file.document.children ?? []) {
    const isIgnoredPage = IGNORED_PAGE_PATTERNS.some((p) => p.test(page.name));
    if (page.type !== "CANVAS" || isIgnoredPage) {
      result.pages.push({
        id: page.id,
        name: page.name,
        normalizedName: normalizeText(page.name),
        nodeId: page.id,
        included: false,
        reason: isIgnoredPage ? "ignored page" : "not a canvas",
      });
      result.ignored.push({
        id: page.id,
        name: page.name,
        reason: "ignored page",
      });
      continue;
    }

    result.pages.push({
      id: page.id,
      name: page.name,
      normalizedName: normalizeText(page.name),
      nodeId: page.id,
      included: true,
    });

    const basePath = [
      { id: fileKey, name: file.name, type: "module" },
      { id: page.id, name: page.name, type: "page" },
    ];

    const pageScreens = collectScreens(page, basePath, undefined, page.id, result);
    result.screens.push(...pageScreens);
  }

  return result;
}

function collectScreens(
  node: FigmaNode,
  parentPath: { id: string; name: string; type: string }[],
  currentBreakpoint:
    | { id: string; name: string; code: string }
    | undefined,
  pageId: string,
  result: FigmaParseResult,
): FigmaScreenCandidate[] {
  if (node.visible === false) return [];

  const bp = isBreakpoint(node);
  if (bp.is) {
    const dims = hasBreakpointDimensions(node);
    result.breakpoints.push({
      id: node.id,
      name: node.name,
      code: bp.code ?? "unknown",
      width: dims?.width,
      height: dims?.height,
      pageId,
      pageName: parentPath.find((p) => p.type === "page")?.name ?? "",
    });

    const nextPath = [
      ...parentPath,
      { id: node.id, name: node.name, type: "breakpoint" },
    ];

    const found: FigmaScreenCandidate[] = [];
    for (const child of node.children ?? []) {
      found.push(
        ...collectScreens(
          child,
          nextPath,
          { id: node.id, name: node.name, code: bp.code ?? "unknown" },
          pageId,
          result,
        ),
      );
    }
    return found;
  }

  const dims = hasScreenDimensions(node);
  const ignore = isIgnoredName(node.name);

  const childCandidates: FigmaScreenCandidate[] = [];
  for (const child of node.children ?? []) {
    childCandidates.push(...collectScreens(child, parentPath, currentBreakpoint, pageId, result));
  }

  const isScreenNode = node.type === "FRAME" && dims !== null;

  if (isScreenNode) {
    if (ignore.ignored) {
      result.ignored.push({
        id: node.id,
        name: node.name,
        reason: ignore.reason ?? "ignored",
      });
      return childCandidates;
    }

    // This node is a leaf-like wireframe only if none of its descendants
    // are also valid screen candidates. Otherwise it is a container.
    if (childCandidates.length === 0) {
      const { metadata, ambiguityFlags } = parseMetadata(node.name);
      const screen: FigmaScreenCandidate = {
        id: node.id,
        name: node.name,
        normalizedName: normalizeText(node.name),
        displayName: node.name,
        originalName: node.name,
        nodeType: node.type,
        pageId,
        pageName: parentPath.find((p) => p.type === "page")?.name ?? "",
        pageNodeId: pageId,
        breakpointId: currentBreakpoint?.id,
        breakpointName: currentBreakpoint?.name,
        breakpointCode: currentBreakpoint?.code,
        parentPath,
        width: dims.width,
        height: dims.height,
        visible: node.visible ?? true,
        metadata,
        ambiguityFlags,
        ignored: false,
      };
      return [screen];
    }
  }

  return childCandidates;
}
