import { getDb } from "../src/lib/db";
import { modulesTable, figmaPagesTable, flowsTable } from "../drizzle/schema";

async function main() {
  const db = getDb();
  const modules = await db.select().from(modulesTable);
  const pages = await db.select().from(figmaPagesTable);
  const flows = await db.select().from(flowsTable);

  const active = modules.filter((m) => m.status !== "archived");
  const byId = new Map(active.map((m) => [m.id, m]));

  const isCurrent = (updatedAt: Date, moduleId: string) => {
    const m = byId.get(moduleId);
    if (!m || !m.lastSyncedAt) return false;
    return updatedAt.getTime() >= m.lastSyncedAt.getTime();
  };

  const curPages = pages.filter((p) => isCurrent(p.updatedAt, p.moduleId));
  const curFlows = flows.filter((f) => isCurrent(f.updatedAt, f.moduleId));

  const pageCountByMod = new Map<string, number>();
  for (const p of curPages) pageCountByMod.set(p.moduleId, (pageCountByMod.get(p.moduleId) ?? 0) + 1);
  const curModules = active.filter((m) => (pageCountByMod.get(m.id) ?? 0) > 0);

  console.log("Active modules:", active.length, " -> with current pages:", curModules.length);
  console.log("Pages: total(active-incl-stale)=", pages.filter((p) => byId.has(p.moduleId)).length, " current=", curPages.length);
  console.log("Flows: total(active-incl-stale)=", flows.filter((f) => byId.has(f.moduleId)).length, " current=", curFlows.length);

  // Show excluded (stale) records
  const staleP = pages.filter((p) => byId.has(p.moduleId) && !isCurrent(p.updatedAt, p.moduleId));
  const staleF = flows.filter((f) => byId.has(f.moduleId) && !isCurrent(f.updatedAt, f.moduleId));
  console.log("\nEXCLUDED stale pages:", staleP.length);
  for (const p of staleP) console.log(`  ${JSON.stringify(p.name)} (mod ${byId.get(p.moduleId)?.name})`);
  console.log("EXCLUDED stale flows:", staleF.length);
  for (const f of staleF) console.log(`  ${JSON.stringify(f.name)} node=${f.figmaSectionNodeId} (mod ${byId.get(f.moduleId)?.name})`);

  const zeroPageModules = active.filter((m) => (pageCountByMod.get(m.id) ?? 0) === 0);
  console.log("\nModules excluded (0 current pages):", zeroPageModules.map((m) => m.name));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
