import { describe, expect, it } from "vitest";
import { parseFigmaFile } from "./parser";
import type { FigmaFileResponse, FigmaNode } from "./client";

function frame(
  name: string,
  id: string,
  w: number,
  h: number,
  children: FigmaNode[] = [],
): FigmaNode {
  return {
    id,
    name,
    type: "FRAME",
    absoluteBoundingBox: { x: 0, y: 0, width: w, height: h },
    visible: true,
    children,
  } as FigmaNode;
}

function section(
  name: string,
  id: string,
  w: number,
  h: number,
  children: FigmaNode[] = [],
): FigmaNode {
  return {
    id,
    name,
    type: "SECTION",
    absoluteBoundingBox: { x: 0, y: 0, width: w, height: h },
    visible: true,
    children,
  } as FigmaNode;
}

function canvas(name: string, id: string, children: FigmaNode[]): FigmaNode {
  return {
    id,
    name,
    type: "CANVAS",
    visible: true,
    children,
  } as FigmaNode;
}

function makeFile(name: string, canvases: FigmaNode[]): FigmaFileResponse {
  return {
    name,
    lastModified: "2026-01-01T00:00:00Z",
    thumbnailUrl: "",
    version: "1",
    document: {
      id: "0:1",
      name: "Document",
      type: "DOCUMENT",
      children: canvases,
    },
  };
}

describe("hierarchy patterns", () => {
  it("detects breakpoint_contains_screens", () => {
    const file = makeFile("Pension", [
      canvas("🟠 Estimate Detail", "1:1", [
        section("XL - 1280px", "2:1", 1280, 800, [
          frame("Create Estimate / 50% / Early", "3:1", 1280, 800),
        ]),
        section("LG - 1024 px", "2:2", 1024, 800, [
          frame("Create Estimate / 50% / Early", "3:2", 1024, 800),
        ]),
      ]),
    ]);
    const parsed = parseFigmaFile("abc", file);
    expect(parsed.breakpoints).toHaveLength(2);
    expect(parsed.screens).toHaveLength(2);
    expect(parsed.screens.every((s) => s.confidence === "high")).toBe(true);
  });

  it("detects screen_group_contains_screens", () => {
    const file = makeFile("Pension", [
      canvas("🟠 Accrual Detail", "1:1", [
        frame("Accrual Detail", "2:1", 1280, 800, [
          frame("Review Modal", "3:1", 1280, 800),
          frame("Confirm Verification", "3:2", 1280, 800),
        ]),
      ]),
    ]);
    const parsed = parseFigmaFile("abc", file);
    expect(parsed.screens.length).toBeGreaterThanOrEqual(1);
  });

  it("infers breakpoint from dimensions when no breakpoint parent", () => {
    const file = makeFile("Pension", [
      canvas("🟠 List Estimates", "1:1", [
        frame("Pension Calculation", "2:1", 1280, 800, [
          frame("Create Calculation Modal / Default", "3:1", 1280, 800),
        ]),
      ]),
    ]);
    const parsed = parseFigmaFile("abc", file);
    const screen = parsed.screens.find(
      (s) => s.name === "Create Calculation Modal / Default",
    );
    expect(screen).toBeDefined();
    expect(screen?.breakpointCode).toBe("xl");
    expect(screen?.confidence).toBe("high");
  });
});
