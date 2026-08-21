/**
 * Golden correction #1 only: S10 Edit Populated (21:19236) submits via a CLICK
 * on the real Add button. Change S10->D3 trigger next->click and add a hotspot
 * from the Add button INSTANCE bbox (full button, not just the text).
 * #2 (S13->S7 QDRO) is already correct — verified, not modified. No other edges.
 */
import { getDb } from "../src/lib/db";
import { flowsTable, flowStepsTable, flowInteractionsTable, flowHotspotsTable } from "../drizzle/schema";
import { updateInteraction, createHotspot } from "../src/lib/repositories/flows";
import { eq, and } from "drizzle-orm";

const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";
const S10 = "21:19236", D3 = "21:18724", S13 = "21:19127", S7 = "21:19062";

// Full Add button INSTANCE (49x40) rel to S10 screen.
const HOTSPOT = { x: 0.81, y: 0.741, w: 0.026, h: 0.032 };

async function main() {
  const db = getDb();
  const [flow] = await db.select().from(flowsTable).where(eq(flowsTable.id, FLOW));
  if (!flow || flow.status !== "draft") throw new Error("refusing: flow missing/not draft");

  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const idOf = new Map(steps.map((s) => [s.figmaNodeId, s.id]));
  const interactions = await db.select().from(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));

  const s10d3 = interactions.find((i) => i.sourceStepId === idOf.get(S10) && i.destinationStepId === idOf.get(D3));
  if (!s10d3) throw new Error("S10->D3 not found");

  // #1: trigger next -> click, and set the Add-button hotspot (replace any).
  await updateInteraction(s10d3.id, { trigger: "click" });
  await db.delete(flowHotspotsTable).where(eq(flowHotspotsTable.interactionId, s10d3.id));
  const hs = await createHotspot({ interactionId: s10d3.id, xPercent: HOTSPOT.x, yPercent: HOTSPOT.y, widthPercent: HOTSPOT.w, heightPercent: HOTSPOT.h });
  console.log(`S10->D3 (${s10d3.label}) trigger: next -> click; hotspot ${hs.id} = x=${hs.xPercent} y=${hs.yPercent} w=${hs.widthPercent} h=${hs.heightPercent}`);

  // #2: verify S13->S7 exists as click (do NOT duplicate / modify).
  const s13s7all = interactions.filter((i) => i.sourceStepId === idOf.get(S13) && i.destinationStepId === idOf.get(S7));
  console.log(`S13->S7 edges found: ${s13s7all.length}`);
  for (const e of s13s7all) {
    const hs2 = await db.select().from(flowHotspotsTable).where(eq(flowHotspotsTable.interactionId, e.id));
    console.log(`  id=${e.id} trigger=${e.trigger} review=${e.reviewStatus} hotspots=${hs2.length} label="${e.label}"`);
  }
  if (s13s7all.length !== 1) console.log("!! expected exactly 1 S13->S7 edge");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
