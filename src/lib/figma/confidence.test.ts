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

describe("confidence rules", () => {
  it("rejects generic frames", () => {
    const file = makeFile("Pension", [
      canvas("🟠 Page", "1:1", [
        frame("Frame 8947839", "2:1", 1200, 800),
      ]),
    ]);
    const parsed = parseFigmaFile("abc", file);
    expect(parsed.screens).toHaveLength(0);
    expect(parsed.counts.rejected).toBeGreaterThan(0);
  });

  it("rejects behavior overlays smaller than breakpoint", () => {
    const file = makeFile("Pension", [
      canvas("🟠 Page", "1:1", [
        frame("Modal / Alert Hire status", "2:1", 300, 300),
      ]),
    ]);
    const parsed = parseFigmaFile("abc", file);
    const modal = parsed.screens.find((s) => s.name.includes("Modal"));
    expect(modal?.confidence).not.toBe("high");
  });

  it("preserves full-size wireframe with internal layout", () => {
    const file = makeFile("Pension", [
      canvas("🟠 Page", "1:1", [
        frame("Create Calculation Modal / Default", "2:1", 1280, 800, [
          frame("Modal / Alert Hire status", "3:1", 530, 428),
          frame("Frame 8947590", "3:2", 1176, 735),
          frame("Participant Menu Items", "3:3", 80, 759),
        ]),
      ]),
    ]);
    const parsed = parseFigmaFile("abc", file);
    const screen = parsed.screens.find(
      (s) => s.name === "Create Calculation Modal / Default",
    );
    expect(screen).toBeDefined();
    expect(screen?.confidence).toBe("high");
  });

  it("rejects nested component internals", () => {
    const file = makeFile("Pension", [
      canvas("🟠 Page", "1:1", [
        frame("Create Calculation Modal", "2:1", 1280, 800, [
          frame("Frame 8949266", "3:1", 1280, 800, [
            frame("List Calculations / Credits Changed", "4:1", 1280, 800),
          ]),
        ]),
      ]),
    ]);
    const parsed = parseFigmaFile("abc", file);
    const list = parsed.screens.find((s) =>
      s.name.includes("List Calculations"),
    );
    expect(list).toBeUndefined();
  });
});
