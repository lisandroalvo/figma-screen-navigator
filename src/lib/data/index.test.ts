import { describe, expect, it } from "vitest";
import {
  getFilterOptions,
  getModuleBySlug,
  getScreenById,
  listRelatedScreens,
  listResponsiveVariants,
  listScreensByModule,
  searchScreens,
} from "@/lib/data";

describe("data API (mock mode)", () => {
  it("gets a module by slug", async () => {
    const figmaModule = await getModuleBySlug("pension-calculation");
    expect(figmaModule).toBeDefined();
    expect(figmaModule?.name).toBe("Pension Calculation");
  });

  it("returns null for an unknown module", async () => {
    const figmaModule = await getModuleBySlug("unknown");
    expect(figmaModule).toBeNull();
  });

  it("lists screens for a module", async () => {
    const figmaModule = await getModuleBySlug("pension-calculation");
    const screens = await listScreensByModule(figmaModule!.id);
    expect(screens.length).toBeGreaterThan(0);
  });

  it("returns undefined for an unknown screen", async () => {
    const screen = await getScreenById("unknown");
    expect(screen).toBeNull();
  });

  it("ranks representative search queries", async () => {
    const results = await searchScreens("contact accordion open");
    expect(results[0].displayName).toMatch(/Contact Accordion.*Popover Open/i);
  });

  it("returns related and responsive screens", async () => {
    const screen = (await searchScreens("estimate detail 50 j s retro early"))[0];
    const related = await listRelatedScreens(screen.id);
    expect(related.length).toBeGreaterThan(0);
    const variants = await listResponsiveVariants(screen.id);
    expect(variants.length).toBeGreaterThan(0);
  });

  it("returns filter options", async () => {
    const options = await getFilterOptions();
    expect(options.modules.length).toBe(3);
    expect(options.products.length).toBe(1);
    expect(options.statuses.length).toBe(5);
  });
});
