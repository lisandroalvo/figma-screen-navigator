/**
 * GLOBAL screen indexer — all CURRENT NBF-MODULES modules.
 *
 * Module → current Page → detectScreensGlobal() → flow_screens. A screen is a
 * FRAME/INSTANCE that is a direct child of a SECTION, screen-sized relative to
 * its siblings, not inside a COMPONENT/COMPONENT_SET. High-confidence accepts
 * are status='detected' (searchable); solo mid-size frames are 'needs_review'
 * (kept, not searchable). Component-library pages (name contains "component")
 * are skipped for SCREEN detection (they remain SECTION-searchable). Idempotent
 * (upsert by moduleId+figmaNodeId); non-destructive stale reconcile. One getFile
 * per module (rate-limit friendly). Does NOT touch flows/FlowPlayer/Golden Flow.
 *
 * Run: npx tsx --env-file=.env.local -r tsconfig-paths/register scripts/index-figma-screens.ts
 */
import { getFile } from "../src/lib/figma/client";
import { generateFigmaNodeUrl } from "../src/lib/figma/flow-parser";
import { detectScreensGlobal } from "../src/lib/figma/screen-detector";
import { getDb } from "../src/lib/db";
import { modulesTable, figmaPagesTable, flowsTable, flowScreensTable } from "../drizzle/schema";
import { and, eq, notInArray } from "drizzle-orm";
import { batchUpsertFlowScreens, type UpsertFlowScreenInput } from "../src/lib/repositories/flow-screens";
import { withDbRetry, withFigmaRetry } from "../src/lib/db/retry";
import { buildScreenAliases } from "../src/lib/search-normalize";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const isComponentPage = (name: string) => norm(name).includes("component");

async function main() {
  const db = getDb();
  const modules = (await db.select().from(modulesTable)).filter((m) => m.status !== "archived");
  const pages = await db.select().from(figmaPagesTable);
  const flows = await db.select().from(flowsTable);

  console.log(`Current modules: ${modules.length}`);
  let totalAcc = 0, totalReview = 0, totalStale = 0, processed = 0, skippedPages = 0;
  const failed: string[] = [];

  for (const mod of modules) {
    const current = pages.filter(
      (p) => p.moduleId === mod.id && mod.lastSyncedAt && p.updatedAt.getTime() >= mod.lastSyncedAt.getTime(),
    );
    if (current.length === 0) continue;
    const pageByNodeId = new Map(current.map((p) => [p.figmaNodeId, p]));
    const flowIdBySection = new Map(flows.filter((f) => f.moduleId === mod.id).map((f) => [f.figmaSectionNodeId, f.id]));

    let file;
    try { file = await withFigmaRetry(() => getFile(mod.figmaFileKey), { module: mod.name, op: "getFile" }); }
    catch (e) { const msg = e instanceof Error ? e.message : String(e); failed.push(`${mod.name}: ${msg}`); console.log(`  [SKIP] ${mod.name}: ${msg}`); continue; }
    processed++;

    // 1) Detect + build ALL screen records for the module IN MEMORY.
    const canvases = (file.document.children ?? []).filter((n) => n.type === "CANVAS" && pageByNodeId.has(n.id));
    const records: UpsertFlowScreenInput[] = [];
    const seen: string[] = [];
    let acc = 0, review = 0;
    for (const canvas of canvases) {
      if (isComponentPage(canvas.name)) { skippedPages++; continue; } // component library, not wireframes
      const dbPage = pageByNodeId.get(canvas.id)!;
      const screens = detectScreensGlobal(canvas);
      for (const s of screens) {
        const flowId = s.parentFlowNodeId ? flowIdBySection.get(s.parentFlowNodeId) ?? null : null;
        records.push({
          productId: mod.productId,
          moduleId: mod.id,
          figmaPageId: dbPage.id,
          flowId,
          figmaFileKey: mod.figmaFileKey,
          figmaPageNodeId: canvas.id,
          figmaSectionNodeId: s.parentSectionNodeId,
          parentSectionNodeId: s.parentSectionNodeId,
          parentSectionName: s.parentSectionName,
          parentFlowNodeId: s.parentFlowNodeId,
          parentFlowName: s.parentFlowName,
          figmaNodeId: s.figmaNodeId,
          figmaFrameName: s.figmaNodeName,
          name: s.name,
          normalizedName: norm(s.name),
          searchTitles: s.searchTitles,
          searchAliases: buildScreenAliases({
            name: s.name,
            searchTitles: s.searchTitles,
            parentSectionName: s.parentSectionName,
            parentFlowName: s.parentFlowName,
          }),
          figmaUrl: generateFigmaNodeUrl(mod.figmaFileKey, s.figmaNodeId),
          width: s.width || null,
          height: s.height || null,
          detectionConfidence: s.confidence,
          detectionReason: s.reason,
          status: s.verdict === "accept" ? "detected" : "needs_review",
          orderIndex: null,
        });
        seen.push(s.figmaNodeId);
        if (s.verdict === "accept") acc++; else review++;
      }
    }

    // 2) Short-lived, batched, retryable write; 3) stale reconcile only after
    //    this module's write succeeds (§7/§8 resumability + safe reconcile).
    try {
      await withDbRetry(() => batchUpsertFlowScreens(records), { module: mod.name, op: "batchUpsertFlowScreens" });
      let stale = 0;
      if (seen.length > 0) {
        const staled = await withDbRetry(() => db.update(flowScreensTable)
          .set({ status: "stale", updatedAt: new Date() })
          .where(and(
            eq(flowScreensTable.moduleId, mod.id),
            notInArray(flowScreensTable.status, ["stale"]),
            notInArray(flowScreensTable.figmaNodeId, seen),
          ))
          .returning({ id: flowScreensTable.id }), { module: mod.name, op: "staleReconcile" });
        stale = staled.length;
      }
      totalAcc += acc; totalReview += review; totalStale += stale;
      console.log(`  ${mod.name}: ${acc} screen(s), ${review} needs-review${stale ? `, ${stale} stale` : ""}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push(`${mod.name} (db): ${msg}`);
      console.log(`  [DB-FAIL] ${mod.name}: ${msg}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("GLOBAL SCREEN INDEX COMPLETE");
  console.log(`  Modules processed: ${processed} / ${modules.length}`);
  console.log(`  Component pages skipped: ${skippedPages}`);
  console.log(`  Accepted screens (detected): ${totalAcc}`);
  console.log(`  Needs review (not searchable): ${totalReview}`);
  console.log(`  Marked stale (non-destructive): ${totalStale}`);
  if (failed.length) { console.log(`  Fetch failed: ${failed.length}`); failed.forEach((f) => console.log(`    - ${f}`)); }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
