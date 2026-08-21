import { getDb } from "../src/lib/db";
import { modulesTable, figmaPagesTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  const modules = await db.select().from(modulesTable);
  const pages = await db.select().from(figmaPagesTable);

  const pageCount = new Map<string, number>();
  for (const p of pages) pageCount.set(p.moduleId, (pageCount.get(p.moduleId) ?? 0) + 1);

  // Detect duplicate module names
  const byName = new Map<string, number>();
  for (const m of modules) byName.set(m.name, (byName.get(m.name) ?? 0) + 1);

  console.log("ALL MODULES:", modules.length);
  for (const m of [...modules].sort((a, b) => a.name.localeCompare(b.name))) {
    const dup = (byName.get(m.name) ?? 0) > 1 ? "  <== DUP NAME" : "";
    console.log(
      `  ${JSON.stringify(m.name)} | slug=${m.slug} | key=${m.figmaFileKey} | pages=${pageCount.get(m.id) ?? 0} | synced=${m.lastSyncedAt ? "yes" : "NEVER"}${dup}`,
    );
  }

  console.log("\nDUPLICATE MODULE NAMES:");
  for (const [name, n] of byName) if (n > 1) console.log(`  ${JSON.stringify(name)} x${n}`);

  // Contract Maintenance specifics
  console.log("\nCONTRACT MAINTENANCE modules:");
  const cms = modules.filter((m) => m.name.toLowerCase().includes("contract maintenance"));
  for (const m of cms) {
    const mp = pages.filter((p) => p.moduleId === m.id);
    console.log(`  id=${m.id} slug=${m.slug} key=${m.figmaFileKey} pages=${mp.length}`);
    for (const p of mp) console.log(`     page: ${JSON.stringify(p.name)} node=${p.figmaNodeId}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
