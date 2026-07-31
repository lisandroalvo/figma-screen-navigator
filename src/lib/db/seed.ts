import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { eq, and } from "drizzle-orm";
import { getDb } from "./index";
import * as schema from "../../../drizzle/schema";
import {
  breakpoints as mockBreakpoints,
  figmaPages as mockPages,
  modules as mockModules,
  products as mockProducts,
  screenRelationships as mockRelationships,
  screens as mockScreens,
} from "../data/mock";

const metadata = {
  source: "development-seed",
  note: "Representative NBF data for local development and QA testing",
};

async function seed() {
  const db = getDb();

  // --- product ---
  const mockProduct = mockProducts[0];
  const productRows = await db
    .insert(schema.productsTable)
    .values({
      name: mockProduct.name,
      slug: mockProduct.slug,
      description: mockProduct.description,
    })
    .onConflictDoNothing({ target: schema.productsTable.slug })
    .returning();

  let product = productRows[0];
  if (!product) {
    const rows = await db
      .select()
      .from(schema.productsTable)
      .where(eq(schema.productsTable.slug, mockProduct.slug));
    product = rows[0];
  }
  if (!product) throw new Error("Product seed failed");

  // --- modules ---
  const moduleIdMap = new Map<string, string>();
  for (const m of mockModules) {
    const rows = await db
      .insert(schema.modulesTable)
      .values({
        productId: product.id,
        name: m.name,
        slug: m.slug,
        figmaFileKey: m.figmaFileKey,
        figmaFileName: m.figmaFileName,
        status: m.status,
      })
      .onConflictDoNothing({
        target: [schema.modulesTable.productId, schema.modulesTable.slug],
      })
      .returning();

    let row = rows[0];
    if (!row) {
      const existing = await db
        .select()
        .from(schema.modulesTable)
        .where(
          and(
            eq(schema.modulesTable.productId, product.id),
            eq(schema.modulesTable.slug, m.slug),
          ),
        );
      row = existing[0];
    }
    if (!row) throw new Error(`Module seed failed for ${m.slug}`);
    moduleIdMap.set(m.id, row.id);
  }

  // --- figma pages ---
  const pageIdMap = new Map<string, string>();
  for (const p of mockPages) {
    const moduleDbId = moduleIdMap.get(p.moduleId);
    if (!moduleDbId) throw new Error(`Missing module mapping for page ${p.name}`);

    const rows = await db
      .insert(schema.figmaPagesTable)
      .values({
        moduleId: moduleDbId,
        figmaNodeId: p.figmaNodeId,
        name: p.name,
        normalizedName: p.normalizedName,
        orderIndex: p.orderIndex,
        isSearchable: p.isSearchable,
      })
      .onConflictDoNothing({
        target: [
          schema.figmaPagesTable.moduleId,
          schema.figmaPagesTable.figmaNodeId,
        ],
      })
      .returning();

    let row = rows[0];
    if (!row) {
      const existing = await db
        .select()
        .from(schema.figmaPagesTable)
        .where(
          and(
            eq(schema.figmaPagesTable.moduleId, moduleDbId),
            eq(schema.figmaPagesTable.figmaNodeId, p.figmaNodeId),
          ),
        );
      row = existing[0];
    }
    if (!row) throw new Error(`Page seed failed for ${p.name}`);
    pageIdMap.set(p.id, row.id);
  }

  // --- breakpoints ---
  const breakpointIdMap = new Map<string, string>();
  for (const b of mockBreakpoints) {
    const pageDbId = pageIdMap.get(b.figmaPageId);
    if (!pageDbId)
      throw new Error(`Missing page mapping for breakpoint ${b.name}`);

    const rows = await db
      .insert(schema.breakpointsTable)
      .values({
        figmaPageId: pageDbId,
        figmaNodeId: b.figmaNodeId,
        name: b.name,
        code: b.code,
        width: b.width,
        height: b.height,
        orderIndex: b.orderIndex,
      })
      .onConflictDoNothing({
        target: [
          schema.breakpointsTable.figmaPageId,
          schema.breakpointsTable.figmaNodeId,
        ],
      })
      .returning();

    let row = rows[0];
    if (!row) {
      const existing = await db
        .select()
        .from(schema.breakpointsTable)
        .where(
          and(
            eq(schema.breakpointsTable.figmaPageId, pageDbId),
            eq(schema.breakpointsTable.figmaNodeId, b.figmaNodeId),
          ),
        );
      row = existing[0];
    }
    if (!row) throw new Error(`Breakpoint seed failed for ${b.name}`);
    breakpointIdMap.set(b.id, row.id);
  }

  // --- screens ---
  const screenIdMap = new Map<string, string>();
  for (const s of mockScreens) {
    const productDbId = product.id;
    const moduleDbId = moduleIdMap.get(s.moduleId);
    const pageDbId = pageIdMap.get(s.figmaPageId);
    const breakpointDbId = breakpointIdMap.get(s.breakpointId);
    if (!moduleDbId || !pageDbId || !breakpointDbId)
      throw new Error(`Missing parent mapping for screen ${s.displayName}`);

    const parentPath = [
      { id: productDbId, name: mockProduct.name, type: "product" },
      { id: moduleDbId, name: mockModules.find((m) => m.id === s.moduleId)!.name, type: "module" },
      { id: pageDbId, name: mockPages.find((p) => p.id === s.figmaPageId)!.name, type: "page" },
      { id: breakpointDbId, name: mockBreakpoints.find((b) => b.id === s.breakpointId)!.name, type: "breakpoint" },
    ];

    const rows = await db
      .insert(schema.screensTable)
      .values({
        productId: productDbId,
        moduleId: moduleDbId,
        figmaPageId: pageDbId,
        breakpointId: breakpointDbId,
        figmaFileKey: s.figmaFileKey,
        figmaPageNodeId: s.figmaPageNodeId,
        figmaNodeId: s.figmaNodeId,
        originalName: s.originalName,
        normalizedName: s.normalizedName,
        displayName: s.displayName,
        figmaUrl: s.figmaUrl,
        previewUrl: s.previewUrl,
        status: s.status,
        screen: s.screen,
        flow: s.flow,
        step: s.step,
        scenario: s.scenario,
        option: s.option,
        condition: s.condition,
        behavior: s.behavior,
        state: s.state,
        keywords: s.keywords,
        description: s.description,
        parentPath,
        ambiguityFlags: s.ambiguityFlags,
        metadata: { ...s.metadata, ...metadata, entity: "screen" },
      })
      .onConflictDoNothing({
        target: [schema.screensTable.moduleId, schema.screensTable.figmaNodeId],
      })
      .returning();

    let row = rows[0];
    if (!row) {
      const existing = await db
        .select()
        .from(schema.screensTable)
        .where(
          and(
            eq(schema.screensTable.moduleId, moduleDbId),
            eq(schema.screensTable.figmaNodeId, s.figmaNodeId),
          ),
        );
      row = existing[0];
    }
    if (!row) throw new Error(`Screen seed failed for ${s.displayName}`);
    screenIdMap.set(s.figmaNodeId, row.id);
  }

  // --- relationships ---
  for (const r of mockRelationships) {
    const source = mockScreens.find((s) => s.id === r.sourceScreenId);
    const target = mockScreens.find((s) => s.id === r.targetScreenId);
    if (!source || !target) continue;

    const sourceDbId = screenIdMap.get(source.figmaNodeId);
    const targetDbId = screenIdMap.get(target.figmaNodeId);
    if (!sourceDbId || !targetDbId) continue;

    await db
      .insert(schema.screenRelationshipsTable)
      .values({
        sourceScreenId: sourceDbId,
        targetScreenId: targetDbId,
        type: r.type,
      })
      .onConflictDoNothing({
        target: [
          schema.screenRelationshipsTable.sourceScreenId,
          schema.screenRelationshipsTable.targetScreenId,
          schema.screenRelationshipsTable.type,
        ],
      });
  }

  console.log("Seed completed successfully");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
