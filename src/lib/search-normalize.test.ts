import { describe, it, expect } from "vitest";
import {
  tokenize, tokenStem, tokenVariants, buildTokenIndex,
  queryTokenMatches, buildScreenAliases,
} from "./search-normalize";

describe("search-normalize: compound variants", () => {
  it("normalizes popup / pop-up / pop up to the same tokens", () => {
    const a = tokenize("Popup"), b = tokenize("Pop-up"), c = tokenize("Pop up");
    expect(a).toEqual(["pop", "up"]);
    expect(b).toEqual(["pop", "up"]);
    expect(c).toEqual(["pop", "up"]);
  });
  it("normalizes dropdown / drop down and checkbox / check box", () => {
    expect(tokenize("Dropdown")).toEqual(["drop", "down"]);
    expect(tokenize("drop-down")).toEqual(["drop", "down"]);
    expect(tokenize("Checkbox")).toEqual(["check", "box"]);
    expect(tokenize("check box")).toEqual(["check", "box"]);
  });
});

describe("search-normalize: conservative plural", () => {
  it("matches adjustment <-> adjustments via stem", () => {
    expect(tokenStem("adjustments")).toBe("adjustment");
    expect(tokenStem("adjustment")).toBe("adjustment");
  });
  it("does NOT destroy access / status / business / -ss words", () => {
    expect(tokenStem("access")).toBe("access");
    expect(tokenStem("status")).toBe("status");
    expect(tokenStem("business")).toBe("business");
    expect(tokenStem("process")).toBe("process");
  });
  it("handles -es plurals correctly (boxes->box, dates->date)", () => {
    expect(tokenStem("boxes")).toBe("box");
    expect(tokenStem("dates")).toBe("date");
    expect(tokenStem("dashes")).toBe("dash");
  });
  it("keeps the original token available in variants", () => {
    expect(tokenVariants("adjustments").has("adjustments")).toBe(true);
    expect(tokenVariants("adjustments").has("adjustment")).toBe(true);
  });
});

describe("search-normalize: queryTokenMatches", () => {
  const idx = buildTokenIndex(["Adjustment / Pop-up", "Rate Group"]);
  it("matches exact, stem (plural), and prefix", () => {
    expect(queryTokenMatches(idx.stems, idx.tokens, "adjustment")).toBe(true);
    expect(queryTokenMatches(idx.stems, idx.tokens, "adjustments")).toBe(true); // plural
    expect(queryTokenMatches(idx.stems, idx.tokens, "pop")).toBe(true);
    expect(queryTokenMatches(idx.stems, idx.tokens, "rate")).toBe(true);
    expect(queryTokenMatches(idx.stems, idx.tokens, "grp")).toBe(false);
  });
});

describe("search-normalize: buildScreenAliases (deterministic, bounded)", () => {
  it("produces normalized aliases from name + titles + section", () => {
    const aliases = buildScreenAliases({
      name: "Adjustment / Pop-up",
      searchTitles: ["Rate Group Modal", "Rate Group"],
      parentSectionName: "Adjustment",
      parentFlowName: null,
    });
    // normalized single forms present
    expect(aliases).toContain("adjustment / pop up");
    expect(aliases).toContain("rate group modal");
    expect(aliases).toContain("rate group");
    // bounded
    expect(aliases.length).toBeLessThanOrEqual(16);
    // deterministic (same input -> same output)
    const again = buildScreenAliases({
      name: "Adjustment / Pop-up",
      searchTitles: ["Rate Group Modal", "Rate Group"],
      parentSectionName: "Adjustment",
      parentFlowName: null,
    });
    expect(again).toEqual(aliases);
  });
});
