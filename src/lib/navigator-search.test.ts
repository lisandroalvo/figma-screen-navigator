import { describe, it, expect } from "vitest";
import { searchNavigator, type NavigatorIndex, type ScreenResult } from "./navigator-search";
import { buildScreenAliases } from "./search-normalize";

function screen(p: Partial<ScreenResult> & { id: string; name: string }): ScreenResult {
  const searchTitles = p.searchTitles ?? [];
  return {
    type: "screen",
    moduleName: p.moduleName ?? "Adjustment",
    moduleSlug: p.moduleSlug ?? "adjustment",
    pageId: p.pageId ?? "pg1",
    pageName: p.pageName ?? "Adjustment",
    parentName: p.parentName ?? "",
    searchTitles,
    searchAliases: p.searchAliases ?? buildScreenAliases({
      name: p.name, searchTitles, parentSectionName: p.parentName ?? null, parentFlowName: null,
    }),
    figmaUrl: p.figmaUrl ?? `https://figma/${p.id}`,
    ...p,
  } as ScreenResult;
}

// The real acceptance example + realistic distractors.
const TARGET = screen({
  id: "target",
  name: "Adjustment / Pop-up",
  parentName: "Adjustment",
  searchTitles: ["Rate Group Modal", "Rate Group"],
});
const index: NavigatorIndex = {
  modules: [], pages: [], flows: [], sections: [],
  screens: [
    TARGET,
    screen({ id: "def", name: "Default", parentName: "Adjustment" }),
    screen({ id: "rg-canon", name: "Rate Group", parentName: "Contract Maintenance", moduleName: "Contract Maintenance" }),
    screen({ id: "other-pop", name: "Warning Modal", parentName: "Adjustment", searchTitles: ["Warning Modal"] }),
    screen({ id: "err", name: "Adjustment / Error Modal", parentName: "Adjustment", searchTitles: ["Error Modal"] }),
    screen({ id: "noise1", name: "Participant Search - Default", parentName: "Participant Search", moduleName: "Participant Maintenance" }),
    screen({ id: "noise2", name: "Bond Release - Collapse", parentName: "Bond Release Tracker", moduleName: "Bond Release Tracker" }),
  ],
  counts: { modules: 0, pages: 0, flows: 0, screens: 7 },
};

const topScreenId = (q: string) => searchNavigator(index, q).screens[0]?.id;
const rankOf = (q: string, id: string) => searchNavigator(index, q).screens.findIndex((s) => s.id === id);

describe("screen search: acceptance queries for Adjustment / Pop-up (Rate Group Modal)", () => {
  for (const q of [
    "Adjustment Pop Up", "Adjustments Pop Up", "Adjustment Popup", "Adjustment Pop-up",
    "adjustment pop-up", "ADJUSTMENT POPUP",
  ]) {
    it(`"${q}" ranks the target screen first`, () => {
      expect(topScreenId(q)).toBe("target");
    });
  }
  for (const q of ["Rate Group", "Rate Group Modal", "Rate Group Popup", "rate-group popup", "Adjustment Rate Group", "Adjustment Rate Group Pop Up"]) {
    it(`"${q}" returns the target in the top 2`, () => {
      const r = rankOf(q, "target");
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    });
  }
});

describe("screen search: exact canonical always wins", () => {
  it('"Default" ranks the screen literally named Default first', () => {
    expect(topScreenId("Default")).toBe("def");
  });
  it('"Rate Group" ranks a canonical "Rate Group" screen at or above a title-only match', () => {
    const res = searchNavigator(index, "Rate Group").screens;
    const canon = res.findIndex((s) => s.id === "rg-canon");
    const titleMatch = res.findIndex((s) => s.id === "target");
    expect(canon).toBeGreaterThanOrEqual(0);
    expect(canon).toBeLessThanOrEqual(titleMatch); // canonical exact not below title match
  });
});

describe("screen search: matched-field hint", () => {
  it('sets matched="Rate Group Modal" when the query hit the modal title', () => {
    const r = searchNavigator(index, "Rate Group Modal").screens.find((s) => s.id === "target");
    expect(r?.matched).toBe("Rate Group Modal");
  });
  it("matched is null when the canonical name satisfied the query", () => {
    const r = searchNavigator(index, "Adjustment Pop Up").screens.find((s) => s.id === "target");
    expect(r?.matched ?? null).toBeNull();
  });
});

describe("screen search: false positives", () => {
  it("a data-value query does not match the target (no TEXT indexing)", () => {
    expect(rankOf("10487", "target")).toBe(-1);
  });
  it("common word 'modal' does not make the target outrank an exact 'Default'", () => {
    // 'modal' is common; ensure it doesn't explode ranking above exact canonical for its own query
    expect(topScreenId("Default")).toBe("def");
  });
});

// §12 — multi-token eligibility precision: a common token alone must not qualify.
describe("screen search: multi-token eligibility (precision)", () => {
  const idx2: NavigatorIndex = {
    modules: [], pages: [], flows: [], sections: [],
    screens: [
      // canonical differs, but carries the exact modal title:
      screen({ id: "lp-title", name: "Contract Maintenance - Rate Groups - Applied", parentName: "Rate Modal",
        moduleName: "Contract Maintenance", searchTitles: ["Link Production Modal", "Link Production"] }),
      // shares ONLY the common word "modal":
      screen({ id: "ben", name: "Beneficiary Modal", parentName: "Beneficiaries Tab",
        moduleName: "Participant Maintenance", searchTitles: ["Beneficiary Modal"] }),
      // shares only "group":
      screen({ id: "grp", name: "Group Overview", parentName: "Employers Tab", moduleName: "Contract Maintenance", searchTitles: [] }),
      screen({ id: "distract", name: "Some Other Screen", parentName: "X", moduleName: "Adjustment", searchTitles: [] }),
    ],
    counts: { modules: 0, pages: 0, flows: 0, screens: 4 },
  };
  const ids2 = (q: string) => searchNavigator(idx2, q).screens.map((s) => s.id);

  it('"Link Production Modal" does NOT match a screen sharing only "modal"', () => {
    const r = ids2("Link Production Modal");
    expect(r).not.toContain("ben");
    expect(r).not.toContain("distract");
  });
  it('"Link Production Modal" matches the screen whose search_title carries it (cross-field)', () => {
    const r = ids2("Link Production Modal");
    expect(r[0]).toBe("lp-title");
  });
  it('"Rate Group" does not qualify a screen containing only "Group"', () => {
    expect(ids2("Rate Group")).not.toContain("grp");
  });
  it('single-token "modal" stays broad (still matches Beneficiary Modal)', () => {
    expect(ids2("modal")).toContain("ben");
    expect(ids2("modal")).toContain("lp-title");
  });
});
