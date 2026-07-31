import { describe, expect, it } from "vitest";
import { searchScreens, tokenize } from "@/lib/search";

describe("tokenize", () => {
  it("splits on punctuation and whitespace", () => {
    expect(tokenize("Estimate Detail / 50% J&S / Retro / Early")).toEqual([
      "estimate",
      "detail",
      "50",
      "j",
      "s",
      "retro",
      "early",
    ]);
  });

  it("treats – and - as separators", () => {
    expect(tokenize("XL – 1280px MD-768")).toEqual([
      "xl",
      "1280px",
      "md",
      "768",
    ]);
  });

  it("ignores extra whitespace and case", () => {
    expect(tokenize("  Contact   Accordion   Open ")).toEqual([
      "contact",
      "accordion",
      "open",
    ]);
  });
});

describe("searchScreens", () => {
  it("returns all screens for an empty query", () => {
    const results = searchScreens("");
    expect(results.length).toBeGreaterThan(17);
  });

  it("matches scenario matrix query 'pension calculation retro early'", () => {
    const results = searchScreens("pension calculation retro early");
    const top = results[0];
    expect(top).toBeDefined();
    expect(
      results.some((r) =>
        r.screen.displayName.includes("50% J&S / Retro / Early"),
      ),
    ).toBe(true);
  });

  it("matches 'estimate detail tooltip'", () => {
    const results = searchScreens("estimate detail tooltip");
    const displayNames = results.map((r) => r.screen.displayName);
    expect(
      displayNames.some((name) => name.includes("Tooltip / Open")),
    ).toBe(true);
  });

  it("matches 'pensioner contact popover'", () => {
    const results = searchScreens("pensioner contact popover");
    expect(
      results.some((r) =>
        r.screen.displayName.includes("Contact Accordion / Popover Open"),
      ),
    ).toBe(true);
  });

  it("matches 'contact accordion open'", () => {
    const results = searchScreens("contact accordion open");
    const top = results[0];
    expect(top.screen.displayName).toMatch(/Contact Accordion.*Popover Open/i);
  });

  it("matches 'rate group validation error'", () => {
    const results = searchScreens("rate group validation error");
    const displayNames = results.map((r) => r.screen.displayName);
    expect(
      displayNames.some((name) =>
        name.includes("Add Rate Group Modal / Validation Error"),
      ),
    ).toBe(true);
  });

  it("matches 'md 768 estimate'", () => {
    const results = searchScreens("md 768 estimate");
    expect(
      results.some((r) => r.screen.breakpointId === "bp-md-5"),
    ).toBe(true);
  });

  it("matches 'no access contract'", () => {
    const results = searchScreens("no access contract");
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some((r) => r.screen.state?.toLowerCase() === "no access"),
    ).toBe(true);
  });

  it("matches '50 j s no delay'", () => {
    const results = searchScreens("50 j s no delay");
    expect(
      results.some((r) =>
        r.screen.displayName.includes("No Delay Option / Early"),
      ),
    ).toBe(true);
  });

  it("ranks full display-name matches above keyword-only matches", () => {
    const results = searchScreens("estimate detail tooltip open");
    expect(results[0].screen.displayName).toMatch(/Tooltip.*Open/i);
  });

  it("filters by status", () => {
    const results = searchScreens("", { status: "qa_ready" });
    expect(results.every((r) => r.screen.status === "qa_ready")).toBe(true);
  });

  it("filters by module", () => {
    const results = searchScreens("", { moduleId: "module-pension-calculation" });
    expect(
      results.every((r) => r.screen.moduleId === "module-pension-calculation"),
    ).toBe(true);
  });
});
