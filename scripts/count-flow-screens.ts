/** READ-ONLY count of flow_screens (idempotency proof). */
import { getDb } from "../src/lib/db";
import { flowScreensTable } from "../drizzle/schema";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  const total = await db.select({ n: sql<number>`count(*)` }).from(flowScreensTable);
  const byStatus = await db
    .select({ s: flowScreensTable.status, n: sql<number>`count(*)` })
    .from(flowScreensTable)
    .groupBy(flowScreensTable.status);
  const distinctFlows = await db
    .select({ f: flowScreensTable.flowId })
    .from(flowScreensTable)
    .groupBy(flowScreensTable.flowId);
  console.log(`total flow_screens rows: ${total[0].n}`);
  console.log(`by status: ${JSON.stringify(byStatus)}`);
  console.log(`distinct flows with screens: ${distinctFlows.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
