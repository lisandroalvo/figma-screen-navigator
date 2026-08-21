import { getDb } from "../src/lib/db";
import { flowStepsTable, flowInteractionsTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";

async function main() {
  const db = getDb();
  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const name = new Map(steps.map((s) => [s.id, s.displayName || s.name]));
  const ix = await db.select().from(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));

  console.log("Total interactions:", ix.length);
  const seen = new Map<string, number>();
  for (const i of ix) {
    const k = i.sourceStepId + ">" + i.destinationStepId;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dups = [...seen.values()].filter((n) => n > 1).length;
  console.log("Duplicate edges:", dups);

  const byTrig: Record<string, number> = {};
  for (const i of ix) byTrig[i.trigger] = (byTrig[i.trigger] ?? 0) + 1;
  console.log("By trigger:", JSON.stringify(byTrig));

  console.log("Click edges:");
  for (const i of ix.filter((x) => x.trigger === "click")) {
    console.log(`   ${name.get(i.sourceStepId)} -> ${name.get(i.destinationStepId)} | ${i.label}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
