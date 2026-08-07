import type { FigmaScreenCandidate } from "./parser";

const BP_ORDER = ["xs", "sm", "md", "lg", "xl"];

export interface LogicalScreenGroup {
  id: string;
  displayName: string;
  originalName: string;
  logicalName: string; // Derived from sectionName or metadata.screen
  pageName: string;
  pageNodeId: string;
  sectionName?: string; // For component-based hierarchy
  metadata: FigmaScreenCandidate["metadata"];
  variants: FigmaScreenCandidate[];
  primaryVariant: FigmaScreenCandidate;
  availableBreakpoints: string[];
  sameBreakpointCollision: boolean;
  isResponsive: boolean;
  ambiguityFlags: string[];
  hierarchyPattern: string;
  confidence: "high" | "medium" | "low" | "rejected";
  confidenceScore: number;
}

export function screenIdentityKey(c: FigmaScreenCandidate): string {
  const m = c.metadata ?? {};
  
  // For component-based screens (INSTANCE), use sectionName as the logical screen name
  // For frame-based screens, use metadata.screen or originalName
  const logicalScreenName = c.sectionName 
    ? c.sectionName.toLowerCase()
    : (m.screen ?? c.originalName).toLowerCase();
  
  const parts = [
    c.pageName,
    logicalScreenName,
    (m.flow ?? "").toLowerCase(),
    (m.scenario ?? "").toLowerCase(),
    (m.option ?? "").toLowerCase(),
    (m.condition ?? "").toLowerCase(),
    (m.behavior ?? "").toLowerCase(),
    (m.state ?? "").toLowerCase(),
  ];
  return parts.join("|");
}

function choosePrimaryVariant(variants: FigmaScreenCandidate[]): FigmaScreenCandidate {
  const ordered = [...variants].sort((a, b) => {
    const ai = BP_ORDER.indexOf(a.breakpointCode ?? "");
    const bi = BP_ORDER.indexOf(b.breakpointCode ?? "");
    if (ai !== bi) return bi - ai; // larger breakpoint first (xl before xs)
    return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
  });
  return ordered[0] ?? variants[0];
}

export function groupIntoLogicalScreens(
  candidates: FigmaScreenCandidate[],
): {
  groups: LogicalScreenGroup[];
  sameBreakpointCollisions: number;
  responsiveGroups: number;
  singleVariantGroups: number;
} {
  const byIdentity = new Map<string, FigmaScreenCandidate[]>();
  for (const c of candidates) {
    const key = screenIdentityKey(c);
    const arr = byIdentity.get(key) ?? [];
    arr.push(c);
    byIdentity.set(key, arr);
  }

  const groups: LogicalScreenGroup[] = [];
  let sameBreakpointCollisions = 0;
  let responsiveGroups = 0;
  let singleVariantGroups = 0;

  for (const [, variants] of byIdentity) {
    const primary = choosePrimaryVariant(variants);
    const breakpoints = variants.map((v) => v.breakpointCode ?? "(none)");
    const uniqueBps = new Set(breakpoints);
    const sameBreakpointCollision = variants.length > uniqueBps.size;
    const isResponsive = uniqueBps.size > 1;

    if (sameBreakpointCollision) sameBreakpointCollisions++;
    if (isResponsive) responsiveGroups++;
    if (variants.length === 1) singleVariantGroups++;

    const ambiguityFlags = Array.from(
      new Set(variants.flatMap((v) => v.ambiguityFlags ?? [])),
    );
    if (sameBreakpointCollision) ambiguityFlags.push("duplicate_breakpoint_variant");

    // Derive logical name from sectionName (for INSTANCE) or metadata.screen (for FRAME)
    const logicalName = primary.sectionName 
      ? primary.sectionName
      : (primary.metadata.screen ?? primary.originalName);

    groups.push({
      id: crypto.randomUUID(),
      displayName: primary.displayName ?? primary.originalName,
      originalName: primary.originalName,
      logicalName,
      pageName: primary.pageName,
      pageNodeId: primary.pageNodeId,
      sectionName: primary.sectionName,
      metadata: primary.metadata,
      variants,
      primaryVariant: primary,
      availableBreakpoints: Array.from(uniqueBps),
      sameBreakpointCollision,
      isResponsive,
      ambiguityFlags,
      hierarchyPattern: primary.hierarchyPattern ?? "unknown",
      confidence: primary.confidence,
      confidenceScore: primary.confidenceScore,
    });
  }

  groups.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { groups, sameBreakpointCollisions, responsiveGroups, singleVariantGroups };
}
