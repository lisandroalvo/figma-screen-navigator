/**
 * READ-ONLY §5 check: no accepted Screen should have an ancestor that is also an
 * accepted Screen. Re-derives accepted node ids per module via detectScreensGlobal,
 * builds a nodeId→parentId map, and walks ancestors. Reports the count (target 0).
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { detectScreensGlobal } from "../src/lib/figma/screen-detector";
import { getDb } from "../src/lib/db";
import { modulesTable, figmaPagesTable } from "../drizzle/schema";
import { withFigmaRetry } from "../src/lib/db/retry";

async function main() {
  const db = getDb();
  const modules = (await db.select().from(modulesTable)).filter((m) => m.status !== "archived");
  const pages = await db.select().from(figmaPagesTable);

  let totalAccepted = 0, nested = 0;
  const examples: string[] = [];

  for (const mod of modules) {
    const current = pages.filter((p) => p.moduleId === mod.id && mod.lastSyncedAt && p.updatedAt.getTime() >= mod.lastSyncedAt.getTime());
    const pageNodeIds = new Set(current.map((p) => p.figmaNodeId));
    let file;
    try { file = await withFigmaRetry(() => getFile(mod.figmaFileKey), { module: mod.name, op: "getFile" }); }
    catch { console.log(`  [SKIP] ${mod.name}: fetch failed`); continue; }
    const canvases = (file.document.children ?? []).filter((n) => n.type === "CANVAS" && pageNodeIds.has(n.id));

    for (const canvas of canvases) {
      if (canvas.name.toLowerCase().replace(/\s+/g, " ").includes("component")) continue;
      const accepted = new Set(detectScreensGlobal(canvas).filter((s) => s.verdict === "accept").map((s) => s.figmaNodeId));
      totalAccepted += accepted.size;
      const parent = new Map<string, string>();
      (function walk(n: FigmaNode) { for (const c of n.children ?? []) { parent.set(c.id, n.id); walk(c); } })(canvas);
      for (const id of accepted) {
        let p = parent.get(id);
        while (p) { if (accepted.has(p)) { nested++; if (examples.length < 10) examples.push(`${mod.name}: ${id} inside ${p}`); break; } p = parent.get(p); }
      }
    }
  }

  console.log(`Accepted screens checked: ${totalAccepted}`);
  console.log(`Accepted screens whose ancestor is also accepted: ${nested}`);
  examples.forEach((e) => console.log(`   - ${e}`));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
