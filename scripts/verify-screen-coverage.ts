/**
 * READ-ONLY Screen coverage diagnostic. Reports per-Module accepted/needs-review
 * screen counts from flow_screens, plus state-name diagnostics that separate
 * raw Figma occurrences from what is actually indexed as a SCREEN (so we can see
 * recall/precision at a glance). Current NBF-MODULES scope only.
 */
import { getDb } from "../src/lib/db";
import { flowScreensTable, modulesTable } from "../drizzle/schema";
import { eq, sql, inArray } from "drizzle-orm";

async function main() {
  const db = getDb();
  const modules = (await db.select().from(modulesTable)).filter((m) => m.status !== "archived");
  const modIds = modules.map((m) => m.id);
  const modName = new Map(modules.map((m) => [m.id, m.name]));

  const rows = await db.select().from(flowScreensTable).where(inArray(flowScreensTable.moduleId, modIds));
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  console.log(`flow_screens (current modules): total=${rows.length} ${JSON.stringify(byStatus)}\n`);

  console.log("Per module (detected / needs_review / stale):");
  for (const m of modules) {
    const mine = rows.filter((r) => r.moduleId === m.id);
    const d = mine.filter((r) => r.status === "detected").length;
    const nr = mine.filter((r) => r.status === "needs_review").length;
    const st = mine.filter((r) => r.status === "stale").length;
    console.log(`  ${modName.get(m.id)}: ${d} / ${nr} / ${st}`);
  }

  const detected = rows.filter((r) => r.status === "detected");
  console.log(`\nState-name diagnostics (indexed SCREEN names, status=detected):`);
  for (const kw of ["hover", "default", "selected", "error", "success", "empty", "populated", "open", "modal", "tooltip"]) {
    const hits = detected.filter((r) => r.name.toLowerCase().includes(kw));
    console.log(`  "${kw}": ${hits.length} screen(s)`);
  }

  // Dimension sanity: distribution of accepted screen sizes.
  const withDims = detected.filter((r) => r.width && r.height);
  const tiny = withDims.filter((r) => (r.width! < 400 || r.height! < 400)).length;
  console.log(`\nAccepted screens with dims: ${withDims.length}; smaller than 400x400: ${tiny}`);
  void sql; void eq;
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
