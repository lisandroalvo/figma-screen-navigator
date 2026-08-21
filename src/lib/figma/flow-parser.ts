import type { FigmaNode } from "./client";

export interface FlowCandidate {
  sectionId: string;
  sectionName: string;
  normalizedName: string;
  figmaFileKey: string;
  pageId: string;
  pageName: string;
  moduleId: string;
  moduleName: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface ScreenCandidate {
  nodeId: string;
  name: string;
  normalizedName: string;
  type: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface GuidanceCandidate {
  nodeId: string;
  text: string;
  type: "guidance" | "action" | "decision" | "branch_label";
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

/**
 * Detect if a Section node represents a Flow
 */
export function isFlowSection(node: FigmaNode): boolean {
  if (node.type !== "SECTION") return false;
  
  const normalized = node.name.toLowerCase().trim();
  return normalized.endsWith("- flow") || normalized.endsWith("-flow");
}

/**
 * Extract Flow candidates from a Figma file
 */
export function extractFlowCandidates(
  file: {
    name: string;
    document: FigmaNode;
  },
  moduleId: string,
  moduleName: string,
  figmaFileKey: string,
): FlowCandidate[] {
  const flows: FlowCandidate[] = [];

  for (const page of file.document.children || []) {
    if (page.type !== "CANVAS") continue;
    
    // Exclude Components page
    const pageNormalized = page.name.toLowerCase().trim();
    if (pageNormalized === "components" || pageNormalized === "component") {
      continue;
    }

    for (const child of page.children || []) {
      if (isFlowSection(child)) {
        flows.push({
          sectionId: child.id,
          sectionName: child.name,
          normalizedName: child.name.toLowerCase().trim(),
          figmaFileKey,
          pageId: page.id,
          pageName: page.name,
          moduleId,
          moduleName,
          boundingBox: child.absoluteBoundingBox || null,
        });
      }
    }
  }

  return flows;
}

/**
 * Identify screen candidates within a Flow Section (RECURSIVE)
 * Screens can be nested inside GROUP containers
 */
export function extractScreenCandidates(sectionNode: FigmaNode): ScreenCandidate[] {
  const screens: ScreenCandidate[] = [];
  const visitedIds = new Set<string>();

  function findScreensRecursive(node: FigmaNode, depth: number) {
    // Avoid infinite loops
    if (visitedIds.has(node.id)) return;
    visitedIds.add(node.id);

    // Check if this node is a screen
    if (isScreenCandidate(node)) {
      screens.push({
        nodeId: node.id,
        name: node.name,
        normalizedName: node.name.toLowerCase().trim(),
        type: node.type,
        boundingBox: node.absoluteBoundingBox || null,
      });
      
      // Don't recurse into children of detected screens
      // to avoid double-counting nested content
      return;
    }

    // Recurse into children (but not too deep - max 5 levels)
    if (node.children && depth < 5) {
      for (const child of node.children) {
        findScreensRecursive(child, depth + 1);
      }
    }
  }

  if (sectionNode.children) {
    for (const child of sectionNode.children) {
      findScreensRecursive(child, 0);
    }
  }

  // Sort by spatial position (left-to-right, top-to-bottom)
  screens.sort((a, b) => {
    if (!a.boundingBox || !b.boundingBox) return 0;
    
    // Primary sort by Y position (top to bottom)
    const yDiff = a.boundingBox.y - b.boundingBox.y;
    if (Math.abs(yDiff) > 100) return yDiff;
    
    // Secondary sort by X position (left to right)
    return a.boundingBox.x - b.boundingBox.x;
  });

  return screens;
}

/**
 * Determine if a node is a screen candidate
 * Based on visual audit of real QA Flows (24 screens across 3 flows)
 */
function isScreenCandidate(node: FigmaNode): boolean {
  // Must be INSTANCE or FRAME
  if (node.type !== "INSTANCE" && node.type !== "FRAME") {
    return false;
  }

  const bbox = node.absoluteBoundingBox;
  if (!bbox) return false;

  const normalized = node.name.toLowerCase().trim();

  // EXCLUDE: "Note" INSTANCE nodes < 600px (these are annotation components)
  if (node.type === "INSTANCE" && 
      normalized === "note" && 
      bbox.width < 600) {
    return false;
  }

  // EXCLUDE: Small FRAME nodes with height < 150 (text labels/actions)
  if (node.type === "FRAME" && bbox.height < 150) {
    return false;
  }

  // INCLUDE: Large FRAME nodes (>= 1500px wide) - full UI screenshots
  if (node.type === "FRAME" && bbox.width >= 1500) {
    return true;
  }

  // INCLUDE: Modal/Layout INSTANCE nodes (>= 1000px wide)
  if (node.type === "INSTANCE" && bbox.width >= 1000) {
    return true;
  }

  // EXCLUDE: Everything else
  return false;
}

/**
 * Extract guidance candidates from a Flow Section
 */
export function extractGuidanceCandidates(sectionNode: FigmaNode): GuidanceCandidate[] {
  const guidance: GuidanceCandidate[] = [];

  if (!sectionNode.children) return guidance;

  for (const child of sectionNode.children) {
    const candidate = classifyGuidanceNode(child);
    if (candidate) {
      guidance.push(candidate);
    }
  }

  return guidance;
}

/**
 * Classify a node as guidance, action, decision, or branch label
 */
function classifyGuidanceNode(node: FigmaNode): GuidanceCandidate | null {
  // TEXT nodes - likely decisions or branch labels
  if (node.type === "TEXT") {
    const text = extractTextContent(node);
    if (!text) return null;

    const normalized = text.toLowerCase().trim();
    
    // Decision point (ends with ?)
    if (normalized.endsWith("?")) {
      return {
        nodeId: node.id,
        text,
        type: "decision",
        boundingBox: node.absoluteBoundingBox || null,
      };
    }

    // Branch labels (yes/no/success/error/etc)
    if (
      normalized === "yes" ||
      normalized === "no" ||
      normalized.includes("success") ||
      normalized.includes("error") ||
      normalized.includes("match")
    ) {
      return {
        nodeId: node.id,
        text,
        type: "branch_label",
        boundingBox: node.absoluteBoundingBox || null,
      };
    }

    return null;
  }

  // FRAME nodes - could be guidance or action labels
  if (node.type === "FRAME" || node.type === "INSTANCE") {
    const text = extractTextFromFrame(node);
    if (!text) return null;

    const bbox = node.absoluteBoundingBox;
    if (!bbox) return null;

    // Small frames (~88px height) are likely action labels
    if (bbox.height < 150 && bbox.width < 600) {
      return {
        nodeId: node.id,
        text,
        type: "action",
        boundingBox: bbox,
      };
    }

    // Larger frames with multi-sentence text are guidance
    if (bbox.width > 400 || text.length > 100) {
      return {
        nodeId: node.id,
        text,
        type: "guidance",
        boundingBox: bbox,
      };
    }
  }

  return null;
}

/**
 * Extract text content from a TEXT node
 */
function extractTextContent(node: FigmaNode): string | null {
  if (node.type === "TEXT" && "characters" in node && node.characters) {
    return (node.characters as string).trim();
  }
  return null;
}

/**
 * Extract text from a FRAME by finding TEXT children
 */
function extractTextFromFrame(node: FigmaNode): string | null {
  if (!node.children) return null;

  const textParts: string[] = [];

  for (const child of node.children) {
    if (child.type === "TEXT" && "characters" in child && child.characters) {
      textParts.push((child.characters as string).trim());
    }
  }

  return textParts.length > 0 ? textParts.join(" ") : null;
}

/**
 * Generate Figma deep link to a specific node
 */
export function generateFigmaNodeUrl(
  fileKey: string,
  nodeId: string,
): string {
  // Convert node ID format: "14:16311" -> "14-16311"
  const formattedNodeId = nodeId.replace(/:/g, "-");
  return `https://www.figma.com/file/${fileKey}?node-id=${formattedNodeId}`;
}

/**
 * Calculate relative hotspot coordinates
 */
export function calculateRelativeCoordinates(
  screenBbox: { x: number; y: number; width: number; height: number },
  elementBbox: { x: number; y: number; width: number; height: number },
): {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
} {
  return {
    xPercent: Math.round(((elementBbox.x - screenBbox.x) / screenBbox.width) * 10000),
    yPercent: Math.round(((elementBbox.y - screenBbox.y) / screenBbox.height) * 10000),
    widthPercent: Math.round((elementBbox.width / screenBbox.width) * 10000),
    heightPercent: Math.round((elementBbox.height / screenBbox.height) * 10000),
  };
}
