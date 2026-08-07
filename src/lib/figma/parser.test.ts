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

  it('excludes "Components" page from screen detection', () => {
    const file = makeFile("Test Module", [
      {
        name: "Components",
        id: "1:1",
        children: [
          { name: "Button Component", id: "2:1", type: "FRAME", w: 1920, h: 1080 },
          { name: "Layout Component", id: "2:2", type: "INSTANCE", w: 1280, h: 800 },
        ],
      },
      {
        name: "Product Page",
        id: "1:2",
        children: [
          { name: "Estimate Detail / XL", id: "3:1", type: "FRAME", w: 1920, h: 1080 },
        ],
      },
    ]);
    const parsed = parseFigmaFile("abc", file);
    
    // Components page should be excluded
    const componentsPage = parsed.pages.find((p) => p.name === "Components");
    expect(componentsPage?.included).toBe(false);
    expect(componentsPage?.reason).toBe("reserved component-library page");
    
    // No screens should be detected from Components page
    const componentsScreens = parsed.screens.filter((s) => s.pageName === "Components");
    expect(componentsScreens).toHaveLength(0);
    
    // Product page should still be processed
    const productPage = parsed.pages.find((p) => p.name === "Product Page");
    expect(productPage?.included).toBe(true);
  });

  it('excludes "Component" page (singular)', () => {
    const file = makeFile("Test Module", [
      {
        name: "Component",
        id: "1:1",
        children: [
          { name: "Large Frame", id: "2:1", type: "FRAME", w: 1920, h: 1080 },
        ],
      },
    ]);
    const parsed = parseFigmaFile("abc", file);
    
    const componentPage = parsed.pages.find((p) => p.name === "Component");
    expect(componentPage?.included).toBe(false);
    expect(componentPage?.reason).toBe("reserved component-library page");
  });

  it('excludes " COMPONENTS " with whitespace', () => {
    const file = makeFile("Test Module", [
      {
        name: " COMPONENTS ",
        id: "1:1",
        children: [
          { name: "Large Frame", id: "2:1", type: "FRAME", w: 1920, h: 1080 },
        ],
      },
    ]);
    const parsed = parseFigmaFile("abc", file);
    
    const componentsPage = parsed.pages.find((p) => p.name === " COMPONENTS ");
    expect(componentsPage?.included).toBe(false);
    expect(componentsPage?.reason).toBe("reserved component-library page");
  });

  it('does NOT exclude "Component Detail" page', () => {
    const file = makeFile("Test Module", [
      {
        name: "Component Detail",
        id: "1:1",
        children: [
          { name: "Screen / XL", id: "2:1", type: "FRAME", w: 1920, h: 1080 },
        ],
      },
    ]);
    const parsed = parseFigmaFile("abc", file);
    
    const page = parsed.pages.find((p) => p.name === "Component Detail");
    expect(page?.included).toBe(true);
  });

  it('does NOT exclude "Component Maintenance" page', () => {
    const file = makeFile("Test Module", [
      {
        name: "Component Maintenance",
        id: "1:1",
        children: [
          { name: "Screen / XL", id: "2:1", type: "FRAME", w: 1920, h: 1080 },
        ],
      },
    ]);
    const parsed = parseFigmaFile("abc", file);
    
    const page = parsed.pages.find((p) => p.name === "Component Maintenance");
    expect(page?.included).toBe(true);
  });

  it("works normally for modules without Components page", () => {
    const file = makeFile("Test Module", [
      {
        name: "Calculation Detail",
        id: "1:1",
        children: [
          { name: "Screen / XL", id: "2:1", type: "FRAME", w: 1920, h: 1080 },
        ],
      },
      {
        name: "Estimate Detail",
        id: "1:2",
        children: [
          { name: "Screen / XL", id: "3:1", type: "FRAME", w: 1920, h: 1080 },
        ],
      },
    ]);
    const parsed = parseFigmaFile("abc", file);
    
    // All pages should be included
    expect(parsed.pages.filter((p) => p.included)).toHaveLength(2);
    expect(parsed.pages.filter((p) => !p.included)).toHaveLength(0);
  });

});
