/** READ-ONLY section integrity: total/detected/distinct/duplicates + per-module coverage. */
import { getDb } from "../src/lib/db";
import { flowSectionsTable, modulesTable } from "../drizzle/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  const modules = (await db.select().from(modulesTable)).filter((m) => m.status !== "archived");
  const ids = modules.map((m) => m.id);
  const detected = await db.select({ n: sql<number>`count(*)` }).from(flowSectionsTable).where(and(inArray(flowSectionsTable.moduleId, ids), eq(flowSectionsTable.status, "detected")));
  const distinct = await db.select({ n: sql<number>`count(distinct (${flowSectionsTable.moduleId}||':'||${flowSectionsTable.figmaNodeId}))` }).from(flowSectionsTable).where(and(inArray(flowSectionsTable.moduleId, ids), eq(flowSectionsTable.status, "detected")));
  const stale = await db.select({ n: sql<number>`count(*)` }).from(flowSectionsTable).where(and(inArray(flowSectionsTable.moduleId, ids), eq(flowSectionsTable.status, "stale")));
  const perMod = await db.select({ m: flowSectionsTable.moduleId, n: sql<number>`count(*)` }).from(flowSectionsTable).where(and(inArray(flowSectionsTable.moduleId, ids), eq(flowSectionsTable.status, "detected"))).groupBy(flowSectionsTable.moduleId);
  const withSections = perMod.length;
  console.log(`sections detected: ${detected[0].n} | distinct: ${distinct[0].n} | duplicates: ${Number(detected[0].n) - Number(distinct[0].n)} | stale: ${stale[0].n}`);
  console.log(`modules with >=1 section: ${withSections} / ${modules.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
