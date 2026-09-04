/** READ-ONLY current-checkpoint audit: dupes + Participant Search + Adjustment. */
import { getDb } from "../src/lib/db";
import { modulesTable, figmaPagesTable, flowsTable, flowSectionsTable, flowScreensTable } from "../drizzle/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

async function auditModule(name: string) {
  const db = getDb();
  const m = (await db.select().from(modulesTable).where(eq(modulesTable.name, name))).find((x) => x.status !== "archived");
  if (!m) { console.log(`\n### ${name}: NOT FOUND (active)`); return; }
  const pages = await db.select().from(figmaPagesTable).where(eq(figmaPagesTable.moduleId, m.id));
  const flows = await db.select({ n: sql<number>`count(*)` }).from(flowsTable).where(eq(flowsTable.moduleId, m.id));
  const sec = await db.select({ n: sql<number>`count(*)` }).from(flowSectionsTable).where(and(eq(flowSectionsTable.moduleId, m.id), eq(flowSectionsTable.status, "detected")));
  const scr = await db.select({ n: sql<number>`count(*)` }).from(flowScreensTable).where(and(eq(flowScreensTable.moduleId, m.id), eq(flowScreensTable.status, "detected")));
  console.log(`\n### ${name} (${m.figmaFileKey})`);
  console.log(`  pages(${pages.length}): ${pages.map((p) => `"${p.name}"`).join(", ")}`);
  console.log(`  components page present: ${pages.some((p) => p.name.toLowerCase().includes("component"))}`);
  console.log(`  flows(detected): ${flows[0].n} | sections(detected): ${sec[0].n} | screens(detected): ${scr[0].n}`);
  const scrS = await db.select().from(flowScreensTable).where(and(eq(flowScreensTable.moduleId, m.id), eq(flowScreensTable.status, "detected"))).limit(2);
  for (const s of scrS) console.log(`  SCREEN "${s.name}" sect="${s.parentSectionName}" titles=${JSON.stringify(s.searchTitles)} -> ${s.figmaUrl}`);
  const secS = await db.select().from(flowSectionsTable).where(and(eq(flowSectionsTable.moduleId, m.id), eq(flowSectionsTable.status, "detected"))).limit(2);
  for (const s of secS) console.log(`  SECTION "${s.name}" -> ${s.figmaUrl}`);
  const pg = pages[0];
  if (pg) console.log(`  PAGE "${pg.name}" nodeId=${pg.figmaNodeId}`);
}

async function main() {
  const db = getDb();
  const mods = (await db.select().from(modulesTable)).filter((m) => m.status !== "archived");
  const ids = mods.map((m) => m.id);
  const secT = await db.select({ n: sql<number>`count(*)` }).from(flowSectionsTable).where(and(inArray(flowSectionsTable.moduleId, ids), eq(flowSectionsTable.status, "detected")));
  const secD = await db.select({ n: sql<number>`count(distinct (${flowSectionsTable.moduleId}||':'||${flowSectionsTable.figmaNodeId}))` }).from(flowSectionsTable).where(and(inArray(flowSectionsTable.moduleId, ids), eq(flowSectionsTable.status, "detected")));
  const secStale = await db.select({ n: sql<number>`count(*)` }).from(flowSectionsTable).where(and(inArray(flowSectionsTable.moduleId, ids), eq(flowSectionsTable.status, "stale")));
  const scrStatus = await db.select({ s: flowScreensTable.status, n: sql<number>`count(*)` }).from(flowScreensTable).where(inArray(flowScreensTable.moduleId, ids)).groupBy(flowScreensTable.status);
  const scrD = await db.select({ n: sql<number>`count(distinct (${flowScreensTable.moduleId}||':'||${flowScreensTable.figmaNodeId}))` }).from(flowScreensTable).where(and(inArray(flowScreensTable.moduleId, ids), eq(flowScreensTable.status, "detected")));
  const scrDet = Number(scrStatus.find((r) => r.s === "detected")?.n ?? 0);
  console.log(`ACTIVE MODULES: ${mods.length}`);
  console.log(`SECTIONS detected=${secT[0].n} distinct=${secD[0].n} dupes=${Number(secT[0].n) - Number(secD[0].n)} stale=${secStale[0].n}`);
  console.log(`SCREENS ${JSON.stringify(scrStatus)} distinct(detected)=${scrD[0].n} screenDupes=${scrDet - Number(scrD[0].n)}`);
  await auditModule("Participant Search");
  await auditModule("Adjustment");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
