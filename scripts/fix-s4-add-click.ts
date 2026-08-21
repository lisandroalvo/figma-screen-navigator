/**
 * Fix: S4 Add Beneficiary Modal — Populated submits via a CLICK on the real
 * Add button (not a guided Next). Change the S4->D2 interaction trigger to
 * click and add a hotspot derived from the Add button's Figma bbox.
 * S3->D1 is left as `next` (Golden models SSN Match? as SSN-entry evaluation).
 */
import { getDb } from "../src/lib/db";
import { flowsTable, flowStepsTable, flowInteractionsTable, flowHotspotsTable } from "../drizzle/schema";
import { updateInteraction, createHotspot } from "../src/lib/repositories/flows";
import { eq, and } from "drizzle-orm";

const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";
const S4 = "21:19067"; // Add Beneficiary Modal — Populated
const D2 = "21:18717"; // Success? (Add)

// Add-button hotspot (Figma-derived): label bbox 11962,9048 25x17 within
// S4 bbox 10394,8108 1920x1253 -> button rect with padding.
const HOTSPOT = { x: 0.808, y: 0.74, w: 0.036, h: 0.03 };

async function main() {
  const db = getDb();
  const [flow] = await db.select().from(flowsTable).where(eq(flowsTable.id, FLOW));
  if (!flow || flow.status !== "draft") throw new Error("refusing: flow missing/not draft");

  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const idOf = new Map(steps.map((s) => [s.figmaNodeId, s.id]));
  const s4 = idOf.get(S4), d2 = idOf.get(D2);
  if (!s4 || !d2) throw new Error("S4 or D2 step missing");

  const [edge] = await db
    .select()
    .from(flowInteractionsTable)
    .where(and(eq(flowInteractionsTable.sourceStepId, s4), eq(flowInteractionsTable.destinationStepId, d2)));
  if (!edge) throw new Error("S4->D2 interaction not found");

  // 1. Change trigger to click.
  await updateInteraction(edge.id, { trigger: "click" });
  console.log(`S4->D2 (${edge.label}) trigger: ${edge.trigger} -> click`);

  // 2. Ensure a single hotspot on the Add button (idempotent).
  await db.delete(flowHotspotsTable).where(eq(flowHotspotsTable.interactionId, edge.id));
  const hs = await createHotspot({ interactionId: edge.id, xPercent: HOTSPOT.x, yPercent: HOTSPOT.y, widthPercent: HOTSPOT.w, heightPercent: HOTSPOT.h });
  console.log(`Add-button hotspot created ${hs.id}: x=${hs.xPercent} y=${hs.yPercent} w=${hs.widthPercent} h=${hs.heightPercent}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
