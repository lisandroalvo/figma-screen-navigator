import { describe, expect, it } from "vitest";
import { parseFigmaFile, parseMetadata } from "./parser";
import type { FigmaFileResponse } from "./client";

function makeFile(
  name: string,
  pages: {
    name: string;
    id: string;
    children?: { name: string; id: string; type: string; w: number; h: number }[];
  }[],
): FigmaFileResponse {
  return {
    name,
    lastModified: "2026-01-01T00:00:00Z",
    thumbnailUrl: "",
    version: "1",
    document: {
      id: "0:1",
      name: "Document",
      type: "DOCUMENT",
      children: pages.map((p) => ({
        id: p.id,
        name: p.name,
        type: "CANVAS",
        children: (p.children ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          absoluteBoundingBox: { x: 0, y: 0, width: c.w, height: c.h },
          visible: true,
          children: [],
        })),
      })),
    },
  };
}

describe("parseMetadata", () => {
  it("classifies screen / scenario / option / state", () => {
    const result = parseMetadata("Estimate Detail / 50% J&S / Retro / Early");
    expect(result.metadata.screen).toBe("Estimate Detail");
    expect(result.metadata.scenario).toBe("50% J&S");
    expect(result.metadata.option).toBe("Retro");
    expect(result.metadata.state).toBe("Early");
  });

  it("classifies screen / behavior / state", () => {
    const result = parseMetadata("Estimate Detail / Tooltip / Open");
    expect(result.metadata.screen).toBe("Estimate Detail");
    expect(result.metadata.behavior).toBe("Tooltip");
    expect(result.metadata.state).toBe("Open");
  });

  it("flags duplicate states", () => {
    const result = parseMetadata("List Worksheets / Default / Empty State");
    expect(result.ambiguityFlags).toContain("duplicate_state");
  });
});

describe("parseFigmaFile", () => {
  it("ignores interactive prototype pages", () => {
    const file = makeFile("Pension", [
      { name: "🕹️ Interactive Prototype / Pension", id: "1:1" },
      { name: "🟠 Estimate Detail", id: "1:2" },
    ]);
    const parsed = parseFigmaFile("abc", file);
    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages.filter((p) => p.included)).toHaveLength(1);
  });

  it("detects breakpoint frames and their screens", () => {
    const file = makeFile("Pension", [
      {
        name: "🟠 Estimate Detail",
        id: "1:2",
        children: [
          { name: "XL - 1280px", id: "2:1", type: "FRAME", w: 1280, h: 900 },
          { name: "Estimate / 50% / Early", id: "3:1", type: "FRAME", w: 1200, h: 800 },
        ],
      },
    ]);
    const parsed = parseFigmaFile("abc", file);
    expect(parsed.breakpoints).toHaveLength(1);
    expect(parsed.breakpoints[0].code).toBe("xl");
    expect(parsed.screens).toHaveLength(1);
  });

  it("rejects tiny and generic frames", () => {
    const file = makeFile("Pension", [
      {
        name: "🟠 Estimate Detail",
        id: "1:2",
        children: [
          { name: "Header", id: "2:1", type: "FRAME", w: 1200, h: 80 },
          { name: "Frame 8947840", id: "2:2", type: "FRAME", w: 1200, h: 800 },
          { name: "Button / LG", id: "2:3", type: "FRAME", w: 120, h: 60 },
        ],
      },
    ]);
    const parsed = parseFigmaFile("abc", file);
    expect(parsed.screens.filter((s) => s.confidence === "high" || s.confidence === "medium")).toHaveLength(0);
    expect(parsed.counts.rejected).toBeGreaterThan(0);
  });
});
