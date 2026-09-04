/**
 * READ-ONLY §5/§13 check: no accepted Screen has an ancestor that is also an
 * accepted Screen — over the EXACT PERSISTED current screen set (status='detected').
 * This does NOT re-detect screens (§14): it loads the stored screen node ids and
 * checks their ancestor relationships against the live Figma tree. Uses
 * withFigmaRetry so a transient fetch never leaves the verification partial; if
 * any module tree cannot be fetched after retries it is reported and the run is
 * NOT declared complete.
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { getDb } from "../src/lib/db";
import { modulesTable, flowScreensTable } from "../drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { withFigmaRetry } from "../src/lib/db/retry";

async function main() {
  const db = getDb();
  const modules = (await db.select().from(modulesTable)).filter((m) => m.status !== "archived");
  const ids = modules.map((m) => m.id);
  const screens = await db.select().from(flowScreensTable).where(and(inArray(flowScreensTable.moduleId, ids), eq(flowScreensTable.status, "detected")));
  const byModule = new Map<string, Set<string>>();
  for (const s of screens) {
    if (!byModule.has(s.moduleId)) byModule.set(s.moduleId, new Set());
    byModule.get(s.moduleId)!.add(s.figmaNodeId);
  }

  const totalScreens = screens.length;
  let checked = 0, nested = 0;
  const failed: string[] = [];
  const examples: string[] = [];

  for (const mod of modules) {
    const accepted = byModule.get(mod.id);
    if (!accepted || accepted.size === 0) continue;
    let file;
    try { file = await withFigmaRetry(() => getFile(mod.figmaFileKey), { module: mod.name, op: "getFile" }); }
    catch (e) { failed.push(`${mod.name}: ${e instanceof Error ? e.message : e}`); console.log(`  [FETCH-FAIL] ${mod.name}`); continue; }

    const parent = new Map<string, string>();
    (function walk(n: FigmaNode) { for (const c of n.children ?? []) { parent.set(c.id, n.id); walk(c); } })(file.document);

    for (const id of accepted) {
      checked++;
      let p = parent.get(id);
      while (p) { if (accepted.has(p)) { nested++; if (examples.length < 10) examples.push(`${mod.name}: ${id} inside ${p}`); break; } p = parent.get(p); }
    }
  }

  console.log(`\nPersisted current screens: ${totalScreens}`);
  console.log(`Screens actually checked: ${checked}`);
  console.log(`Accepted screens whose ancestor is also accepted: ${nested}`);
  examples.forEach((e) => console.log(`   - ${e}`));
  if (failed.length) { console.log(`FETCH FAILURES (verification INCOMPLETE): ${failed.length}`); failed.forEach((f) => console.log(`   - ${f}`)); }
  const complete = failed.length === 0 && checked === totalScreens;
  console.log(`COMPLETE: ${complete} | NESTED=${nested}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
