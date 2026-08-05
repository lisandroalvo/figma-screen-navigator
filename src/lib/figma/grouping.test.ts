import { describe, expect, it } from "vitest";
import { groupIntoLogicalScreens, screenIdentityKey } from "./grouping";
import type { FigmaScreenCandidate } from "./parser";

function makeCandidate(overrides: Partial<FigmaScreenCandidate>): FigmaScreenCandidate {
  return {
    id: crypto.randomUUID(),
    name: "Screen",
    normalizedName: "screen",
    originalName: "Screen",
    displayName: "Screen",
    nodeType: "FRAME",
    pageId: "1:1",
    pageName: "Page",
    pageNodeId: "1:1",
    parentPath: [],
    fullParentPath: [],
    width: 1280,
    height: 800,
    visible: true,
    metadata: {},
    ambiguityFlags: [],
    confidence: "high",
    confidenceScore: 100,
    detectionReasons: [],
    rejectionReasons: [],
    childFrameCount: 0,
    containsShell: false,
    generic: false,
    depth: 2,
    hierarchyPattern: "screen_group_contains_screens",
    ...overrides,
  } as FigmaScreenCandidate;
}

describe("screenIdentityKey", () => {
  it("uses screen metadata when available", () => {
    const c = makeCandidate({
      originalName: "Create Estimate / 50% / Early",
      metadata: { screen: "Create Estimate", scenario: "50%" },
    });
    expect(screenIdentityKey(c)).toContain("create estimate");
    expect(screenIdentityKey(c)).toContain("50%");
  });
});

describe("groupIntoLogicalScreens", () => {
  it("groups responsive variants by identity", () => {
    const base = {
      originalName: "Create Estimate / 50% / Early",
      metadata: { screen: "Create Estimate", scenario: "50%" },
    };
    const variants = [
      makeCandidate({ ...base, breakpointCode: "xl", width: 1280 }),
      makeCandidate({ ...base, breakpointCode: "lg", width: 1024 }),
      makeCandidate({ ...base, breakpointCode: "md", width: 768 }),
      makeCandidate({ ...base, breakpointCode: "sm", width: 640 }),
    ];
    const { groups, responsiveGroups, singleVariantGroups } =
      groupIntoLogicalScreens(variants);
    expect(groups).toHaveLength(1);
    expect(groups[0].variants).toHaveLength(4);
    expect(groups[0].primaryVariant.breakpointCode).toBe("xl");
    expect(responsiveGroups).toBe(1);
    expect(singleVariantGroups).toBe(0);
    expect(groups[0].isResponsive).toBe(true);
  });

  it("keeps different scenarios separate", () => {
    const a = makeCandidate({
      originalName: "A / Retro",
      metadata: { screen: "A", scenario: "Retro" },
    });
    const b = makeCandidate({
      originalName: "A / No Delay",
      metadata: { screen: "A", scenario: "No Delay" },
    });
    const { groups } = groupIntoLogicalScreens([a, b]);
    expect(groups).toHaveLength(2);
  });

  it("flags same-breakpoint collisions", () => {
    const base = {
      originalName: "Modal / Default",
      metadata: { screen: "Modal" },
    };
    const variants = [
      makeCandidate({ ...base, breakpointCode: "xl", width: 1280 }),
      makeCandidate({ ...base, breakpointCode: "xl", width: 1280 }),
    ];
    const { groups, sameBreakpointCollisions } =
      groupIntoLogicalScreens(variants);
    expect(sameBreakpointCollisions).toBe(1);
    expect(groups[0].sameBreakpointCollision).toBe(true);
    expect(groups[0].ambiguityFlags).toContain("duplicate_breakpoint_variant");
  });
});
