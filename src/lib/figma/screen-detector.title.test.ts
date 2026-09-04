import { describe, it, expect } from "vitest";
import { extractScreenSearchTitles } from "./screen-detector";
import type { FigmaNode } from "./client";

type N = FigmaNode & { absoluteBoundingBox?: { x: number; y: number; width: number; height: number }; characters?: string };
const box = (w: number, h: number) => ({ x: 0, y: 0, width: w, height: h });

// Synthetic accepted screen: 1280x800 with a modal, chrome, a meaningful
// direct-child container, generic frames, and a data-value TEXT node.
const screen: N = {
  id: "s1", name: "Adjustment / Pop-up", type: "FRAME", absoluteBoundingBox: box(1280, 800),
  children: [
    { id: "m1", name: "Rate Group Modal", type: "INSTANCE", absoluteBoundingBox: box(1215, 424), children: [] } as N,
    { id: "f1", name: "Frame 8948459", type: "FRAME", absoluteBoundingBox: box(1280, 800), children: [] } as N,
    { id: "r1", name: "Rectangle 4", type: "RECTANGLE", absoluteBoundingBox: box(1280, 800), children: [] } as N,
    { id: "nav", name: "Bottom Navigation", type: "FRAME", absoluteBoundingBox: box(1176, 48), children: [] } as N,
    { id: "c1", name: "Component 12", type: "INSTANCE", absoluteBoundingBox: box(80, 759), children: [] } as N,
    { id: "cm", name: "Contract Maintenance", type: "FRAME", absoluteBoundingBox: box(1152, 453), children: [] } as N,
    { id: "t1", name: "value", type: "TEXT", absoluteBoundingBox: box(60, 20), characters: "10487", children: [] } as N,
  ],
};

describe("extractScreenSearchTitles", () => {
  const titles = extractScreenSearchTitles(screen);

  it("captures the modal layer name and its bare title", () => {
    expect(titles).toContain("Rate Group Modal");
    expect(titles).toContain("Rate Group");
  });
  it("captures a meaningful non-generic direct-child container", () => {
    expect(titles).toContain("Contract Maintenance");
  });
  it("rejects generic frame names", () => {
    expect(titles).not.toContain("Frame 8948459");
  });
  it("rejects chrome/technical wrappers", () => {
    expect(titles).not.toContain("Bottom Navigation");
    expect(titles).not.toContain("Component 12");
    expect(titles).not.toContain("Rectangle 4");
  });
  it("does NOT extract TEXT node data values (TEXT extraction disabled)", () => {
    expect(titles).not.toContain("10487");
    expect(titles.some((t) => /10487/.test(t))).toBe(false);
  });
  it("is bounded", () => {
    expect(titles.length).toBeLessThanOrEqual(8);
  });
});
