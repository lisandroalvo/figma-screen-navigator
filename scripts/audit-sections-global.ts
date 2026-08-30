/** READ-ONLY global audit of flow_sections: totals + keyword matches (current). */
import { getDb } from "../src/lib/db";
import { flowSectionsTable, modulesTable, figmaPagesTable } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  const total = await db.select({ n: sql<number>`count(*)` }).from(flowSectionsTable).where(eq(flowSectionsTable.status, "detected"));
  const stale = await db.select({ n: sql<number>`count(*)` }).from(flowSectionsTable).where(eq(flowSectionsTable.status, "stale"));
  console.log(`flow_sections detected: ${total[0].n}  stale: ${stale[0].n}`);

  const rows = await db
    .select({
      name: flowSectionsTable.name,
      node: flowSectionsTable.figmaNodeId,
      parentFlow: flowSectionsTable.parentFlowName,
      isFlow: flowSectionsTable.isFlowContainer,
      mod: modulesTable.name,
      page: figmaPagesTable.name,
      modStatus: modulesTable.status,
    })
    .from(flowSectionsTable)
    .innerJoin(modulesTable, eq(flowSectionsTable.moduleId, modulesTable.id))
    .innerJoin(figmaPagesTable, eq(flowSectionsTable.figmaPageId, figmaPagesTable.id))
    .where(eq(flowSectionsTable.status, "detected"));

  const current = rows.filter((r) => r.modStatus !== "archived");
  for (const kw of ["modal", "tooltip", "default", "pop", "table", "success", "error"]) {
    const hits = current.filter((r) => r.name.toLowerCase().includes(kw));
    console.log(`\nSECTIONs containing "${kw}": ${hits.length}`);
    for (const h of hits.slice(0, 25)) {
      console.log(`   - "${h.name}"  [${h.mod} › ${h.page}${h.parentFlow ? ` › ${h.parentFlow}` : ""}]  node=${h.node}  isFlowContainer=${h.isFlow}`);
    }
    if (hits.length > 25) console.log(`   … +${hits.length - 25} more`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
