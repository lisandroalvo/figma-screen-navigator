/**
 * Data-quality report for the Module -> Page -> Flow index.
 * Read-only. Checks duplicates, orphans, and invalid flow names.
 */
import { getDb } from "../src/lib/db";
import { modulesTable, figmaPagesTable, flowsTable } from "../drizzle/schema";

async function main() {
  const db = getDb();
  const modules = await db.select().from(modulesTable);
  const pages = await db.select().from(figmaPagesTable);
  const flows = await db.select().from(flowsTable);

  const moduleIds = new Set(modules.map((m) => m.id));
  const pageIds = new Set(pages.map((p) => p.id));

  // Duplicate modules by file key
  const byKey = new Map<string, number>();
  for (const m of modules) byKey.set(m.figmaFileKey, (byKey.get(m.figmaFileKey) ?? 0) + 1);
  const dupModules = [...byKey.entries()].filter(([, n]) => n > 1);

  // Duplicate pages within same module (moduleId + figmaNodeId)
  const byPageKey = new Map<string, number>();
  for (const p of pages) {
    const k = p.moduleId + "|" + p.figmaNodeId;
    byPageKey.set(k, (byPageKey.get(k) ?? 0) + 1);
  }
  const dupPages = [...byPageKey.entries()].filter(([, n]) => n > 1);

  // Duplicate flow node IDs within same module
  const byFlowKey = new Map<string, number>();
  for (const f of flows) {
    const k = f.moduleId + "|" + f.figmaSectionNodeId;
    byFlowKey.set(k, (byFlowKey.get(k) ?? 0) + 1);
  }
  const dupFlows = [...byFlowKey.entries()].filter(([, n]) => n > 1);

  // Orphans
  const pagesWithoutModule = pages.filter((p) => !moduleIds.has(p.moduleId));
  const flowsWithoutModule = flows.filter((f) => !moduleIds.has(f.moduleId));
  const flowsWithoutPage = flows.filter((f) => !pageIds.has(f.figmaPageId));

  // Flow names not ending in "- flow"
  const badFlowNames = flows.filter((f) => !f.name.trim().toLowerCase().endsWith("- flow"));

  console.log("=== INDEX DATA QUALITY ===");
  console.log("Modules:", modules.length, " Pages:", pages.length, " Flows:", flows.length);
  console.log("Duplicate modules (file key):", dupModules.length, dupModules);
  console.log("Duplicate pages (module+node):", dupPages.length, dupPages);
  console.log("Duplicate flows (module+section):", dupFlows.length, dupFlows);
  console.log("Pages without module:", pagesWithoutModule.length);
  console.log("Flows without module:", flowsWithoutModule.length);
  console.log("Flows without page:", flowsWithoutPage.length);
  console.log("Flow names NOT ending '- flow':", badFlowNames.length, badFlowNames.map((f) => f.name));

  const clean =
    dupModules.length === 0 && dupPages.length === 0 && dupFlows.length === 0 &&
    pagesWithoutModule.length === 0 && flowsWithoutModule.length === 0 &&
    flowsWithoutPage.length === 0 && badFlowNames.length === 0;
  console.log("\nSTRUCTURE CLEAN:", clean);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
