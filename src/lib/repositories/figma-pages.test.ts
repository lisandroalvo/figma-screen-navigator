import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getServerEnv } from "@/lib/env";
import { getDb } from "@/lib/db";
import {
  productsTable,
  modulesTable,
  figmaPagesTable,
} from "../../../drizzle/schema";
import { getPageByModuleAndNode } from "./figma-pages";

// Skip these tests if database is not configured
const isDatabaseEnabled = () => {
  try {
    const env = getServerEnv();
    return env.DATA_SOURCE === "database" && !!env.DATABASE_URL;
  } catch {
    return false;
  }
};

describe.skipIf(!isDatabaseEnabled())("Figma Page Identity Scoping", () => {
  let testProductId: string;
  let testModuleAId: string;
  let testModuleBId: string;

  beforeAll(async () => {
    const db = getDb();

    // Create test product
    const [product] = await db
      .insert(productsTable)
      .values({
        name: "Test Product",
        slug: "test-product-pages",
      })
      .returning();
    testProductId = product.id;

    // Create two test modules (representing different Figma files)
    const [moduleA] = await db
      .insert(modulesTable)
      .values({
        productId: testProductId,
        name: "Module A",
        slug: "module-a",
        figmaFileKey: "file-a-key",
        status: "active",
      })
      .returning();
    testModuleAId = moduleA.id;

    const [moduleB] = await db
      .insert(modulesTable)
      .values({
        productId: testProductId,
        name: "Module B",
        slug: "module-b",
        figmaFileKey: "file-b-key",
        status: "active",
      })
      .returning();
    testModuleBId = moduleB.id;
  });

  afterAll(async () => {
    const db = getDb();
    const { eq } = await import("drizzle-orm");
    // Clean up test data
    await db.delete(figmaPagesTable).where(eq(figmaPagesTable.moduleId, testModuleAId));
    await db.delete(figmaPagesTable).where(eq(figmaPagesTable.moduleId, testModuleBId));
    await db.delete(modulesTable).where(eq(modulesTable.id, testModuleAId));
    await db.delete(modulesTable).where(eq(modulesTable.id, testModuleBId));
    await db.delete(productsTable).where(eq(productsTable.id, testProductId));
  });

  it("allows same node ID in different modules", async () => {
    const db = getDb();

    // Create page with node ID "1:2" in Module A
    const [pageA] = await db
      .insert(figmaPagesTable)
      .values({
        moduleId: testModuleAId,
        figmaNodeId: "1:2",
        name: "Page A",
        normalizedName: "page a",
        orderIndex: 0,
      })
      .returning();

    // Create page with same node ID "1:2" in Module B
    const [pageB] = await db
      .insert(figmaPagesTable)
      .values({
        moduleId: testModuleBId,
        figmaNodeId: "1:2",
        name: "Page B",
        normalizedName: "page b",
        orderIndex: 0,
      })
      .returning();

    expect(pageA.id).not.toBe(pageB.id);
    expect(pageA.figmaNodeId).toBe("1:2");
    expect(pageB.figmaNodeId).toBe("1:2");
    expect(pageA.name).toBe("Page A");
    expect(pageB.name).toBe("Page B");
  });

  it("retrieves correct page by module and node", async () => {
    const pageA = await getPageByModuleAndNode(testModuleAId, "1:2");
    const pageB = await getPageByModuleAndNode(testModuleBId, "1:2");

    expect(pageA).not.toBeNull();
    expect(pageB).not.toBeNull();
    expect(pageA?.name).toBe("Page A");
    expect(pageB?.name).toBe("Page B");
    expect(pageA?.moduleId).toBe(testModuleAId);
    expect(pageB?.moduleId).toBe(testModuleBId);
  });

  it("updating Module A page does not affect Module B", async () => {
    const db = getDb();
    const { eq, and } = await import("drizzle-orm");

    // Update Module A's page
    await db
      .update(figmaPagesTable)
      .set({ name: "Page A Updated" })
      .where(
        and(
          eq(figmaPagesTable.moduleId, testModuleAId),
          eq(figmaPagesTable.figmaNodeId, "1:2"),
        ),
      );

    // Verify Module A updated
    const pageA = await getPageByModuleAndNode(testModuleAId, "1:2");
    expect(pageA?.name).toBe("Page A Updated");

    // Verify Module B unchanged
    const pageB = await getPageByModuleAndNode(testModuleBId, "1:2");
    expect(pageB?.name).toBe("Page B");
  });

  it("prevents duplicate (module, node) pairs", async () => {
    const db = getDb();

    // Try to create duplicate page in Module A
    await expect(
      db.insert(figmaPagesTable).values({
        moduleId: testModuleAId,
        figmaNodeId: "1:2",
        name: "Duplicate Page",
        normalizedName: "duplicate page",
        orderIndex: 0,
      }),
    ).rejects.toThrow();
  });

  it("allows different node IDs in same module", async () => {
    const db = getDb();

    const [page1] = await db
      .insert(figmaPagesTable)
      .values({
        moduleId: testModuleAId,
        figmaNodeId: "1:3",
        name: "Page 3",
        normalizedName: "page 3",
        orderIndex: 1,
      })
      .returning();

    const [page2] = await db
      .insert(figmaPagesTable)
      .values({
        moduleId: testModuleAId,
        figmaNodeId: "1:4",
        name: "Page 4",
        normalizedName: "page 4",
        orderIndex: 2,
      })
      .returning();

    expect(page1.id).not.toBe(page2.id);
    expect(page1.moduleId).toBe(testModuleAId);
    expect(page2.moduleId).toBe(testModuleAId);
  });
});
