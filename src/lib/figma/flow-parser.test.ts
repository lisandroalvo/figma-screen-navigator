import { describe, it, expect } from "vitest";
import { extractScreenCandidates, isFlowSection } from "./flow-parser";

describe("Flow Parser - Screen Detection", () => {
  // Mock Figma node structure based on real QA Flows
  const mockAddEventFlow = {
    id: "21:32338",
    name: "Add Event Modal - Flow",
    type: "SECTION" as const,
    children: [
      // 3 Note annotations (should be excluded)
      {
        id: "21:32370",
        name: "Note",
        type: "INSTANCE" as const,
        absoluteBoundingBox: { x: 0, y: 0, width: 424, height: 424 },
      },
      {
        id: "21:32418",
        name: "Note",
        type: "INSTANCE" as const,
        absoluteBoundingBox: { x: 100, y: 0, width: 424, height: 424 },
      },
      {
        id: "21:32505",
        name: "Note",
        type: "INSTANCE" as const,
        absoluteBoundingBox: { x: 200, y: 0, width: 424, height: 424 },
      },
      // Groups containing actual screens
      {
        id: "group1",
        name: "Group 2710",
        type: "GROUP" as const,
        children: [
          {
            id: "21:32353",
            name: "Modal",
            type: "INSTANCE" as const,
            absoluteBoundingBox: { x: 0, y: 500, width: 1280, height: 800 },
          },
        ],
      },
      {
        id: "group2",
        name: "Group 2713",
        type: "GROUP" as const,
        children: [
          {
            id: "21:32369",
            name: "Modal",
            type: "INSTANCE" as const,
            absoluteBoundingBox: { x: 1300, y: 500, width: 1280, height: 800 },
          },
        ],
      },
      // Text label (should be excluded)
      {
        id: "group3",
        name: "Group 2709",
        type: "GROUP" as const,
        children: [
          {
            id: "21:32382",
            name: "Note",
            type: "FRAME" as const,
            absoluteBoundingBox: { x: 0, y: 1400, width: 1167, height: 81 },
          },
        ],
      },
    ],
  };

  const mockStartPayFlow = {
    id: "21:18433",
    name: "Start Pay - Flow",
    type: "SECTION" as const,
    children: [
      {
        id: "21:18607",
        name: "Frame 8949456",
        type: "FRAME" as const,
        absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1231 },
      },
      {
        id: "21:18442",
        name: "Modal",
        type: "INSTANCE" as const,
        absoluteBoundingBox: { x: 2000, y: 0, width: 1920, height: 1080 },
      },
      // Text label (should be excluded)
      {
        id: "21:18452",
        name: "Note",
        type: "FRAME" as const,
        absoluteBoundingBox: { x: 4000, y: 0, width: 1158, height: 88 },
      },
    ],
  };

  it("should detect exactly 5 screens in Add Event Mock (simplified)", () => {
    const screens = extractScreenCandidates(mockAddEventFlow as any);
    
    // Should find 2 Modal instances inside groups, excluding:
    // - 3 Note annotations
    // - 1 text label
    expect(screens.length).toBe(2);
    
    const screenIds = screens.map((s) => s.nodeId);
    expect(screenIds).toContain("21:32353");
    expect(screenIds).toContain("21:32369");
    
    // Should NOT include annotations
    expect(screenIds).not.toContain("21:32370");
    expect(screenIds).not.toContain("21:32418");
    expect(screenIds).not.toContain("21:32505");
    
    // Should NOT include text label
    expect(screenIds).not.toContain("21:32382");
  });

  it("should detect exactly 2 screens in Start Pay Mock", () => {
    const screens = extractScreenCandidates(mockStartPayFlow as any);
    
    // Should find 2 screens, excluding text label
    expect(screens.length).toBe(2);
    
    const screenIds = screens.map((s) => s.nodeId);
    expect(screenIds).toContain("21:18607");
    expect(screenIds).toContain("21:18442");
    
    // Should NOT include text label
    expect(screenIds).not.toContain("21:18452");
  });

  it("should exclude Note INSTANCE nodes < 600px (annotations)", () => {
    const annotationNode = {
      id: "test-note",
      name: "Note",
      type: "INSTANCE" as const,
      absoluteBoundingBox: { x: 0, y: 0, width: 424, height: 424 },
    };
    
    const section = {
      id: "section",
      name: "Test Section",
      type: "SECTION" as const,
      children: [annotationNode],
    };
    
    const screens = extractScreenCandidates(section as any);
    expect(screens.length).toBe(0);
  });

  it("should exclude FRAME nodes with height < 150 (labels)", () => {
    const labelNode = {
      id: "test-label",
      name: "Note",
      type: "FRAME" as const,
      absoluteBoundingBox: { x: 0, y: 0, width: 1000, height: 88 },
    };
    
    const section = {
      id: "section",
      name: "Test Section",
      type: "SECTION" as const,
      children: [labelNode],
    };
    
    const screens = extractScreenCandidates(section as any);
    expect(screens.length).toBe(0);
  });

  it("should include large FRAME nodes >= 1500px wide", () => {
    const screenNode = {
      id: "test-screen",
      name: "Frame 8949456",
      type: "FRAME" as const,
      absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1231 },
    };
    
    const section = {
      id: "section",
      name: "Test Section",
      type: "SECTION" as const,
      children: [screenNode],
    };
    
    const screens = extractScreenCandidates(section as any);
    expect(screens.length).toBe(1);
    expect(screens[0].nodeId).toBe("test-screen");
  });

  it("should include Modal INSTANCE nodes >= 1000px wide", () => {
    const modalNode = {
      id: "test-modal",
      name: "Modal",
      type: "INSTANCE" as const,
      absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 800 },
    };
    
    const section = {
      id: "section",
      name: "Test Section",
      type: "SECTION" as const,
      children: [modalNode],
    };
    
    const screens = extractScreenCandidates(section as any);
    expect(screens.length).toBe(1);
    expect(screens[0].nodeId).toBe("test-modal");
  });

  it("should detect screens nested inside GROUP containers", () => {
    const nestedStructure = {
      id: "section",
      name: "Test Section",
      type: "SECTION" as const,
      children: [
        {
          id: "group",
          name: "Group",
          type: "GROUP" as const,
          children: [
            {
              id: "nested-modal",
              name: "Modal",
              type: "INSTANCE" as const,
              absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 800 },
            },
          ],
        },
      ],
    };
    
    const screens = extractScreenCandidates(nestedStructure as any);
    expect(screens.length).toBe(1);
    expect(screens[0].nodeId).toBe("nested-modal");
  });

  it("should not double-count parent and child", () => {
    const structure = {
      id: "section",
      name: "Test Section",
      type: "SECTION" as const,
      children: [
        {
          id: "parent-frame",
          name: "Parent Frame",
          type: "FRAME" as const,
          absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1200 },
          children: [
            {
              id: "child-modal",
              name: "Modal",
              type: "INSTANCE" as const,
              absoluteBoundingBox: { x: 100, y: 100, width: 1280, height: 800 },
            },
          ],
        },
      ],
    };
    
    const screens = extractScreenCandidates(structure as any);
    // Should detect parent FRAME (1920px), not recurse into child
    expect(screens.length).toBe(1);
    expect(screens[0].nodeId).toBe("parent-frame");
  });
});

describe("Flow Section Detection", () => {
  it("should detect sections ending with '- Flow'", () => {
    const flowNode = {
      id: "test",
      name: "Add Event Modal - Flow",
      type: "SECTION" as const,
    };
    
    expect(isFlowSection(flowNode as any)).toBe(true);
  });

  it("should detect sections ending with '-Flow'", () => {
    const flowNode = {
      id: "test",
      name: "Test-Flow",
      type: "SECTION" as const,
    };
    
    expect(isFlowSection(flowNode as any)).toBe(true);
  });

  it("should NOT detect non-SECTION nodes", () => {
    const frameNode = {
      id: "test",
      name: "Something - Flow",
      type: "FRAME" as const,
    };
    
    expect(isFlowSection(frameNode as any)).toBe(false);
  });

  it("should NOT detect sections without '- Flow' suffix", () => {
    const sectionNode = {
      id: "test",
      name: "Components",
      type: "SECTION" as const,
    };
    
    expect(isFlowSection(sectionNode as any)).toBe(false);
  });
});
