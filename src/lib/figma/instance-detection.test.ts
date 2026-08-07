import { describe, expect, it } from "vitest";
import { parseFigmaFile } from "./parser";
import { groupIntoLogicalScreens } from "./grouping";
import type { FigmaFileResponse, FigmaNode } from "./client";

/**
 * Helper to create nested Figma structures for testing INSTANCE detection
 */
function makeNestedFile(
  name: string,
  pages: Array<{
    name: string;
    id: string;
    children?: FigmaNode[];
  }>,
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
        children: p.children ?? [],
      })),
    },
  };
}

describe("INSTANCE-based screen detection", () => {
  it("detects INSTANCE inside Logical Screen → Breakpoint Section hierarchy", () => {
    const file = makeNestedFile("QA Module", [
      {
        name: "QA - page 1",
        id: "1:1",
        children: [
          {
            id: "2:1",
            name: "Default",
            type: "SECTION",
            children: [
              {
                id: "3:1",
                name: "XL",
                type: "SECTION",
                children: [
                  {
                    id: "4:1",
                    name: "Layout Instance",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
                    visible: true,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const parsed = parseFigmaFile("test-key", file);
    
    // Should detect the INSTANCE as a screen
    expect(parsed.screens.length).toBeGreaterThan(0);
    
    const screen = parsed.screens.find((s) => s.nodeType === "INSTANCE");
    expect(screen).toBeDefined();
    expect(screen?.breakpointCode).toBe("xl");
    expect(screen?.sectionName).toBe("Default");
  });

  it("ignores nested INSTANCE inside detected screen", () => {
    const file = makeNestedFile("QA Module", [
      {
        name: "QA - page 1",
        id: "1:1",
        children: [
          {
            id: "2:1",
            name: "Default",
            type: "SECTION",
            children: [
              {
                id: "3:1",
                name: "XL",
                type: "SECTION",
                children: [
                  {
                    id: "4:1",
                    name: "Layout Instance",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
                    visible: true,
                    children: [
                      {
                        id: "5:1",
                        name: "Header Instance",
                        type: "INSTANCE",
                        absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 80 },
                        visible: true,
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const parsed = parseFigmaFile("test-key", file);
    
    // Should only detect the root INSTANCE, not the nested Header
    const instances = parsed.screens.filter((s) => s.nodeType === "INSTANCE");
    expect(instances).toHaveLength(1);
    expect(instances[0].name).toBe("Layout Instance");
  });

  it("ignores INSTANCE inside Components page", () => {
    const file = makeNestedFile("QA Module", [
      {
        name: "Components",
        id: "1:1",
        children: [
          {
            id: "2:1",
            name: "Layout",
            type: "SECTION",
            children: [
              {
                id: "3:1",
                name: "XL",
                type: "SECTION",
                children: [
                  {
                    id: "4:1",
                    name: "Component Instance",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
                    visible: true,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const parsed = parseFigmaFile("test-key", file);
    
    // Components page should be excluded
    const componentsPage = parsed.pages.find((p) => p.name === "Components");
    expect(componentsPage?.included).toBe(false);
    
    // No screens should be detected from Components page
    expect(parsed.screens).toHaveLength(0);
  });

  it("ignores INSTANCE not inside breakpoint section", () => {
    const file = makeNestedFile("QA Module", [
      {
        name: "QA - page 1",
        id: "1:1",
        children: [
          {
            id: "2:1",
            name: "Random Section",
            type: "SECTION",
            children: [
              {
                id: "3:1",
                name: "Layout Instance",
                type: "INSTANCE",
                absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
                visible: true,
                children: [],
              },
            ],
          },
        ],
      },
    ]);

    const parsed = parseFigmaFile("test-key", file);
    
    // Should not detect INSTANCE without breakpoint section parent
    const instances = parsed.screens.filter((s) => s.nodeType === "INSTANCE");
    expect(instances).toHaveLength(0);
  });

  it("continues to detect FRAME-based screens", () => {
    const file = makeNestedFile("Pension Calculation", [
      {
        name: "Estimate Detail",
        id: "1:1",
        children: [
          {
            id: "2:1",
            name: "Estimate / XL",
            type: "FRAME",
            absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
            visible: true,
            children: [],
          },
        ],
      },
    ]);

    const parsed = parseFigmaFile("test-key", file);
    
    // Should still detect FRAME-based screens
    const frames = parsed.screens.filter((s) => s.nodeType === "FRAME");
    expect(frames.length).toBeGreaterThan(0);
  });

  it("groups INSTANCE variants by section name and page", () => {
    const file = makeNestedFile("QA Module", [
      {
        name: "QA - page 1",
        id: "1:1",
        children: [
          {
            id: "2:1",
            name: "Default",
            type: "SECTION",
            children: [
              {
                id: "3:1",
                name: "XL",
                type: "SECTION",
                children: [
                  {
                    id: "4:1",
                    name: "Layout",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
                    visible: true,
                    children: [],
                  },
                ],
              },
              {
                id: "3:2",
                name: "LG",
                type: "SECTION",
                children: [
                  {
                    id: "4:2",
                    name: "Layout",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 800 },
                    visible: true,
                    children: [],
                  },
                ],
              },
              {
                id: "3:3",
                name: "MD",
                type: "SECTION",
                children: [
                  {
                    id: "4:3",
                    name: "Layout",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 768, height: 800 },
                    visible: true,
                    children: [],
                  },
                ],
              },
              {
                id: "3:4",
                name: "SM",
                type: "SECTION",
                children: [
                  {
                    id: "4:4",
                    name: "Layout",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 640, height: 800 },
                    visible: true,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const parsed = parseFigmaFile("test-key", file);
    const { groups } = groupIntoLogicalScreens(parsed.screens);
    
    // Should group all 4 variants into one logical screen
    expect(groups).toHaveLength(1);
    expect(groups[0].variants).toHaveLength(4);
    expect(groups[0].logicalName).toBe("Default");
    expect(groups[0].sectionName).toBe("Default");
    expect(groups[0].availableBreakpoints).toContain("xl");
    expect(groups[0].availableBreakpoints).toContain("lg");
    expect(groups[0].availableBreakpoints).toContain("md");
    expect(groups[0].availableBreakpoints).toContain("sm");
  });

  it("treats same screen name on different pages as different logical screens", () => {
    const file = makeNestedFile("QA Module", [
      {
        name: "QA - page 1",
        id: "1:1",
        children: [
          {
            id: "2:1",
            name: "Default",
            type: "SECTION",
            children: [
              {
                id: "3:1",
                name: "XL",
                type: "SECTION",
                children: [
                  {
                    id: "4:1",
                    name: "Layout",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
                    visible: true,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "QA - page 2",
        id: "1:2",
        children: [
          {
            id: "2:2",
            name: "Default",
            type: "SECTION",
            children: [
              {
                id: "3:2",
                name: "XL",
                type: "SECTION",
                children: [
                  {
                    id: "4:2",
                    name: "Layout",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
                    visible: true,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const parsed = parseFigmaFile("test-key", file);
    const { groups } = groupIntoLogicalScreens(parsed.screens);
    
    // Should create 2 separate logical screens (one per page)
    expect(groups).toHaveLength(2);
    expect(groups[0].pageName).not.toBe(groups[1].pageName);
    expect(groups[0].logicalName).toBe("Default");
    expect(groups[1].logicalName).toBe("Default");
  });

  it("chooses LG as primary when XL is missing", () => {
    const file = makeNestedFile("QA Module", [
      {
        name: "QA - page 1",
        id: "1:1",
        children: [
          {
            id: "2:1",
            name: "Default",
            type: "SECTION",
            children: [
              {
                id: "3:2",
                name: "LG",
                type: "SECTION",
                children: [
                  {
                    id: "4:2",
                    name: "Layout",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 800 },
                    visible: true,
                    children: [],
                  },
                ],
              },
              {
                id: "3:3",
                name: "MD",
                type: "SECTION",
                children: [
                  {
                    id: "4:3",
                    name: "Layout",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 768, height: 800 },
                    visible: true,
                    children: [],
                  },
                ],
              },
              {
                id: "3:4",
                name: "SM",
                type: "SECTION",
                children: [
                  {
                    id: "4:4",
                    name: "Layout",
                    type: "INSTANCE",
                    absoluteBoundingBox: { x: 0, y: 0, width: 640, height: 800 },
                    visible: true,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const parsed = parseFigmaFile("test-key", file);
    const { groups } = groupIntoLogicalScreens(parsed.screens);
    
    expect(groups).toHaveLength(1);
    // Primary should be LG (largest available)
    expect(groups[0].primaryVariant.breakpointCode).toBe("lg");
  });

  it("handles empty page correctly", () => {
    const file = makeNestedFile("QA Module", [
      {
        name: "QA - page 3",
        id: "1:3",
        children: [],
      },
    ]);

    const parsed = parseFigmaFile("test-key", file);
    
    // Page should be included but have no screens
    const page = parsed.pages.find((p) => p.name === "QA - page 3");
    expect(page?.included).toBe(true);
    expect(parsed.screens).toHaveLength(0);
  });
});
