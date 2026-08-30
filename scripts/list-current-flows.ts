/** READ-ONLY: print current-scope Flow SECTION names (module not archived). */
import { getDb } from "../src/lib/db";
import { flowsTable, modulesTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  const rows = await db
    .select({ name: flowsTable.name, section: flowsTable.figmaSectionNodeId, url: flowsTable.figmaUrl, mod: modulesTable.name, status: modulesTable.status })
    .from(flowsTable)
    .innerJoin(modulesTable, eq(flowsTable.moduleId, modulesTable.id));
  const current = rows.filter((r) => r.status !== "archived");
  console.log(`current flows: ${current.length}`);
  for (const f of current) console.log(`  - "${f.name}"  [${f.mod}]  section=${f.section}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
