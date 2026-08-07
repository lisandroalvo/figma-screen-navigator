import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getServerEnv } from "@/lib/env";
import { getDb } from "@/lib/db";
import {
  productsTable,
  modulesTable,
  figmaPagesTable,
  breakpointsTable,
  screensTable,
} from "../../../drizzle/schema";
import { searchScreens } from "./screens";

// Skip these tests if database is not configured
const isDatabaseEnabled = () => {
  try {
    const env = getServerEnv();
    return env.DATA_SOURCE === "database" && !!env.DATABASE_URL;
  } catch {
    return false;
  }
};

describe.skipIf(!isDatabaseEnabled())("searchScreens", () => {
  let testProductId: string;
  let testModuleId: string;
  let testPageId: string;
  let testBreakpointId: string;

  beforeAll(async () => {
    const db = getDb();

    // Create test product
    const [product] = await db
      .insert(productsTable)
      .values({
        name: "Test Product",
        slug: "test-product",
      })
      .returning();
    testProductId = product.id;

    // Create test module
    const [module] = await db
      .insert(modulesTable)
      .values({
        productId: testProductId,
        name: "Test Module",
        slug: "test-module",
        figmaFileKey: "test-file-key",
        status: "active",
      })
      .returning();
    testModuleId = module.id;

    // Create test page
    const [page] = await db
      .insert(figmaPagesTable)
      .values({
        moduleId: testModuleId,
        figmaNodeId: "1:1",
        name: "Test Page 1",
        normalizedName: "test page 1",
        orderIndex: 0,
      })
      .returning();
    testPageId = page.id;

    // Create test breakpoint
    const [breakpoint] = await db
      .insert(breakpointsTable)
      .values({
        figmaPageId: testPageId,
        figmaNodeId: "1:1:xl",
        name: "XL",
        code: "xl",
        orderIndex: 0,
      })
      .returning();
    testBreakpointId = breakpoint.id;

    // Create test screen
    await db.insert(screensTable).values({
      productId: testProductId,
      moduleId: testModuleId,
      figmaPageId: testPageId,
      breakpointId: testBreakpointId,
      figmaFileKey: "test-file-key",
      figmaPageNodeId: "1:1",
      figmaNodeId: "1:1:1",
      originalName: "Test Screen",
      normalizedName: "test screen",
      displayName: "Test Screen",
      figmaUrl: "https://figma.com/design/test-file-key?node-id=1-1-1",
      status: "qa_ready",
      source: "figma",
      keywords: [],
      parentPath: [],
      ambiguityFlags: [],
      metadata: {},
    });
  });

  afterAll(async () => {
    const db = getDb();
    const { eq } = await import("drizzle-orm");
    // Clean up test data
    await db.delete(screensTable).where(eq(screensTable.productId, testProductId));
    await db.delete(breakpointsTable).where(eq(breakpointsTable.figmaPageId, testPageId));
    await db.delete(figmaPagesTable).where(eq(figmaPagesTable.id, testPageId));
    await db.delete(modulesTable).where(eq(modulesTable.id, testModuleId));
    await db.delete(productsTable).where(eq(productsTable.id, testProductId));
  });

  it("includes moduleName in search results", async () => {
    const results = await searchScreens("Test Screen", { source: "figma" });
    const testScreen = results.find((r) => r.displayName === "Test Screen");

    expect(testScreen).toBeDefined();
    expect(testScreen?.moduleName).toBe("Test Module");
  });

  it("includes productName in search results", async () => {
    const results = await searchScreens("Test Screen", { source: "figma" });
    const testScreen = results.find((r) => r.displayName === "Test Screen");

    expect(testScreen).toBeDefined();
    expect(testScreen?.productName).toBe("Test Product");
  });

  it("includes pageName in search results", async () => {
    const results = await searchScreens("Test Screen", { source: "figma" });
    const testScreen = results.find((r) => r.displayName === "Test Screen");

    expect(testScreen).toBeDefined();
    expect(testScreen?.pageName).toBe("Test Page 1");
  });

  it("finds screens by module name", async () => {
    const results = await searchScreens("Test Module", { source: "figma" });
    const testScreen = results.find((r) => r.displayName === "Test Screen");

    expect(testScreen).toBeDefined();
  });

  it("finds screens by page name", async () => {
    const results = await searchScreens("Test Page 1", { source: "figma" });
    const testScreen = results.find((r) => r.displayName === "Test Screen");

    expect(testScreen).toBeDefined();
  });

  it("finds screens by product name", async () => {
    const results = await searchScreens("Test Product", { source: "figma" });
    const testScreen = results.find((r) => r.displayName === "Test Screen");

    expect(testScreen).toBeDefined();
  });

  it("finds screens by breakpoint code", async () => {
    const results = await searchScreens("XL", { source: "figma" });
    const testScreen = results.find((r) => r.displayName === "Test Screen");

    expect(testScreen).toBeDefined();
  });

  it("excludes mock screens by default", async () => {
    const results = await searchScreens("", {});
    const mockScreens = results.filter((r) => r.source === "mock");

    expect(mockScreens).toHaveLength(0);
  });
});
