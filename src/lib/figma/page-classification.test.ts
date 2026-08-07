import { describe, expect, it } from "vitest";
import { shouldIgnoreFigmaPage, classifyFigmaPage } from "./page-classification";

describe("shouldIgnoreFigmaPage", () => {
  it('should ignore "Components" page', () => {
    expect(shouldIgnoreFigmaPage("Components")).toBe(true);
  });

  it('should ignore "Component" page', () => {
    expect(shouldIgnoreFigmaPage("Component")).toBe(true);
  });

  it('should ignore "components" (lowercase)', () => {
    expect(shouldIgnoreFigmaPage("components")).toBe(true);
  });

  it('should ignore " COMPONENTS " (with whitespace)', () => {
    expect(shouldIgnoreFigmaPage(" COMPONENTS ")).toBe(true);
  });

  it('should NOT ignore "Component Detail"', () => {
    expect(shouldIgnoreFigmaPage("Component Detail")).toBe(false);
  });

  it('should NOT ignore "Component Maintenance"', () => {
    expect(shouldIgnoreFigmaPage("Component Maintenance")).toBe(false);
  });

  it('should NOT ignore "Calculation Detail"', () => {
    expect(shouldIgnoreFigmaPage("Calculation Detail")).toBe(false);
  });

  it('should NOT ignore "QA - page 1"', () => {
    expect(shouldIgnoreFigmaPage("QA - page 1")).toBe(false);
  });

  it('should NOT ignore empty string', () => {
    expect(shouldIgnoreFigmaPage("")).toBe(false);
  });

  it('should ignore "component" (exact match, lowercase)', () => {
    expect(shouldIgnoreFigmaPage("component")).toBe(true);
  });
});

describe("classifyFigmaPage", () => {
  it('should classify "Components" as components page', () => {
    expect(classifyFigmaPage("Components")).toBe("components");
  });

  it('should classify "Component" as components page', () => {
    expect(classifyFigmaPage("Component")).toBe("components");
  });

  it('should classify "Calculation Detail" as product page', () => {
    expect(classifyFigmaPage("Calculation Detail")).toBe("product");
  });

  it('should classify "QA - page 1" as product page', () => {
    expect(classifyFigmaPage("QA - page 1")).toBe("product");
  });
});
