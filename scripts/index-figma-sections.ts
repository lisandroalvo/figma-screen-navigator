/**
 * GLOBAL searchable-SECTION indexer — all CURRENT NBF-MODULES modules.
 *
 * For every current (non-archived) Module → every current Page → recursively
 * index EVERY node.type === "SECTION" into flow_sections (search-only; additive).
 * Does NOT touch the interactive `flows` table, FlowPlayer, Golden Flow,
 * Module/Page/Flow indexing, or reconciliation. Idempotent (upsert by
 * moduleId+figmaNodeId). Non-destructive stale handling: sections no longer
 * present in Figma are marked status='stale' (never deleted) so they drop out of
 * normal search while remaining for diagnostics.
 *
 * "Current page" uses the same rule as the Navigator: page.updatedAt >=
 * module.lastSyncedAt. Only node.type === "SECTION" is recorded (no
 * FRAME/TEXT/INSTANCE/… — false-positive safe).
 *
 * Run: npx tsx --env-file=.env.local -r tsconfig-paths/register scripts/index-figma-sections.ts
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { generateFigmaNodeUrl } from "../src/lib/figma/flow-parser";
import { getDb } from "../src/lib/db";
import { modulesTable, figmaPagesTable, flowSectionsTable } from "../drizzle/schema";
import { and, eq, notInArray } from "drizzle-orm";
import { batchUpsertFlowSections, type UpsertFlowSectionInput } from "../src/lib/repositories/flow-sections";
import { withDbRetry, withFigmaRetry } from "../src/lib/db/retry";

const isFlowContainer = (name: string) => name.trim().toLowerCase().endsWith("- flow");
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

interface Collected {
  figmaNodeId: string;
  name: string;
  parentNodeId: string;
  parentName: string;
  parentFlowNodeId: string | null;
  parentFlowName: string | null;
  depth: number;
}

function collectSections(
  node: FigmaNode,
  depth: number,
  parentName: string,
  parentId: string,
  flowAncestor: { id: string; name: string } | null,
  out: Collected[],
) {
  if (node.type === "SECTION") {
    out.push({
      figmaNodeId: node.id,
      name: node.name,
      parentNodeId: parentId,
      parentName,
      parentFlowNodeId: flowAncestor?.id ?? null,
      parentFlowName: flowAncestor?.name ?? null,
      depth,
    });
  }
  // A "- flow" SECTION becomes the flow ancestor for its descendants.
  const nextFlow = node.type === "SECTION" && isFlowContainer(node.name)
    ? { id: node.id, name: node.name }
    : flowAncestor;
  for (const c of node.children ?? []) {
    collectSections(c, depth + 1, node.name, node.id, nextFlow, out);
  }
}

async function main() {
  const db = getDb();
  const modules = (await db.select().from(modulesTable)).filter((m) => m.status !== "archived");
  const pages = await db.select().from(figmaPagesTable);

  console.log(`Current (non-archived) modules: ${modules.length}`);
  let totalSections = 0, totalStale = 0, processed = 0;
  const failed: string[] = [];

  for (const mod of modules) {
    // Current pages for this module (same rule as the Navigator).
    const modPages = pages.filter(
      (p) => p.moduleId === mod.id && mod.lastSyncedAt && p.updatedAt.getTime() >= mod.lastSyncedAt.getTime(),
    );
    if (modPages.length === 0) continue;
    const pageByNodeId = new Map(modPages.map((p) => [p.figmaNodeId, p]));

    let file;
    try {
      file = await withFigmaRetry(() => getFile(mod.figmaFileKey), { module: mod.name, op: "getFile" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push(`${mod.name}: ${msg}`);
      console.log(`  [SKIP] ${mod.name} (${mod.figmaFileKey}): ${msg}`);
      continue;
    }
    processed++;

    // 1) Build ALL section records for this module IN MEMORY (no DB held open
    //    while we traversed the freshly-fetched Figma tree).
    const canvases = (file.document.children ?? []).filter((n) => n.type === "CANVAS");
    const records: UpsertFlowSectionInput[] = [];
    const seen: string[] = [];
    for (const canvas of canvases) {
      const dbPage = pageByNodeId.get(canvas.id);
      if (!dbPage) continue; // only current DB pages
      const found: Collected[] = [];
      for (const c of canvas.children ?? []) collectSections(c, 1, canvas.name, canvas.id, null, found);
      for (const s of found) {
        records.push({
          productId: mod.productId,
          moduleId: mod.id,
          figmaPageId: dbPage.id,
          figmaFileKey: mod.figmaFileKey,
          figmaPageNodeId: canvas.id,
          figmaNodeId: s.figmaNodeId,
          parentNodeId: s.parentNodeId,
          parentName: s.parentName,
          parentFlowNodeId: s.parentFlowNodeId,
          parentFlowName: s.parentFlowName,
          name: s.name,
          normalizedName: norm(s.name),
          figmaUrl: generateFigmaNodeUrl(mod.figmaFileKey, s.figmaNodeId),
          depth: s.depth,
          isFlowContainer: isFlowContainer(s.name),
          status: "detected",
        });
        seen.push(s.figmaNodeId);
      }
    }

    // 2) Short-lived, batched, retryable DB write (one round-trip per module).
    try {
      await withDbRetry(() => batchUpsertFlowSections(records), { module: mod.name, op: "batchUpsertFlowSections" });
      // 3) Non-destructive stale reconcile — ONLY after this module's write
      //    succeeded (§8: never stale on a failed run). Kept for diagnostics.
      let staleCount = 0;
      if (seen.length > 0) {
        const staled = await withDbRetry(() => db
          .update(flowSectionsTable)
          .set({ status: "stale", updatedAt: new Date() })
          .where(and(
            eq(flowSectionsTable.moduleId, mod.id),
            eq(flowSectionsTable.status, "detected"),
            notInArray(flowSectionsTable.figmaNodeId, seen),
          ))
          .returning({ id: flowSectionsTable.id }), { module: mod.name, op: "staleReconcile" });
        staleCount = staled.length;
      }
      totalSections += records.length;
      totalStale += staleCount;
      console.log(`  ${mod.name}: ${records.length} section(s)${staleCount ? `, ${staleCount} marked stale` : ""}`);
    } catch (e) {
      // A DB failure on this module must not corrupt already-written modules
      // (§7 resumability): record it and continue; a re-run upserts safely.
      const msg = e instanceof Error ? e.message : String(e);
      failed.push(`${mod.name} (db): ${msg}`);
      console.log(`  [DB-FAIL] ${mod.name}: ${msg}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("GLOBAL SECTION INDEX COMPLETE");
  console.log(`  Modules processed: ${processed} / ${modules.length}`);
  console.log(`  Searchable SECTIONs upserted (detected): ${totalSections}`);
  console.log(`  Marked stale (non-destructive): ${totalStale}`);
  if (failed.length) { console.log(`  Fetch failed: ${failed.length}`); failed.forEach((f) => console.log(`    - ${f}`)); }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
