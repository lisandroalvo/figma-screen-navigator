/**
 * Rebuild the Beneficiary draft graph to match beneficiary-modal-golden-flow.md
 * EXACTLY. Deletes prior interactions + the speculative Phase-B "Matches?"
 * decision node, creates the 3 Golden decisions + 17 explicitly-drawn edges
 * (approved), and the 6 click hotspots. Draft only. No invented edges.
 */
import { getDb } from "../src/lib/db";
import { flowsTable, flowStepsTable, flowInteractionsTable, flowHotspotsTable } from "../drizzle/schema";
import { upsertFlowStep, updateStepDisplayName, createInteraction, updateInteraction, createHotspot } from "../src/lib/repositories/flows";
import { eq, and } from "drizzle-orm";

const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";

// Golden decision nodes (Figma-resolved, distinct from the UNRESOLVED "Matches?" 21:18653)
const D1 = { node: "21:19161", name: "SSN Match?", display: "SSN Match?" };
const D2 = { node: "21:18717", name: "Success ? (Add)", display: "Success? (Add)" };
const D3 = { node: "21:18724", name: "Success ? (Edit)", display: "Success? (Edit)" };

// [srcNode, dstNode, label, trigger]
const EDGES: Array<[string, string, string, "click" | "branch" | "next"]> = [
  ["21:19162", "21:19194", "Check a row", "click"],                       // S1->S2
  ["21:19194", "21:18725", "Go to Add Beneficiary Modal", "click"],       // S2->S3 (Add)
  ["21:19194", "21:18730", "Go to Edit Beneficiary Modal", "click"],      // S2->S9 (Update)
  ["21:18725", "21:19161", "Enter SSN", "next"],                          // S3->D1
  ["21:19161", "21:19263", "Matching SSN", "branch"],                     // D1->S14
  ["21:19161", "21:19067", "No Match", "branch"],                         // D1->S4
  ["21:19161", "21:18735", "With QDRO", "branch"],                        // D1->S8
  ["21:19067", "21:18717", "Add (submit)", "next"],                       // S4->D2
  ["21:18717", "21:19094", "Yes", "branch"],                              // D2->S5
  ["21:18717", "21:18761", "No", "branch"],                               // D2->S6
  ["21:18735", "21:19062", "Clicking the file icon opens the QDRO Documents modal.", "click"], // S8->S7
  ["21:18730", "21:19236", "Enter Beneficiary details", "next"],          // S9->S10
  ["21:18730", "21:18654", "Click on the Dropdown", "click"],             // S9->S11
  ["21:19236", "21:18724", "Save", "next"],                               // S10->D3
  ["21:18724", "21:19127", "Yes", "branch"],                              // D3->S13
  ["21:18724", "21:19057", "No", "branch"],                               // D3->S12
  ["21:19127", "21:19062", "Clicking the file icon opens the QDRO Documents modal.", "click"], // S13->S7
];

// Hotspots for click edges (relative 0-1). H1-H4 Figma-derived; H5/H6 manual fallback.
const HOTSPOTS: Array<{ src: string; dst: string; x: number; y: number; w: number; h: number }> = [
  { src: "21:19162", dst: "21:19194", x: 0.06, y: 0.27, w: 0.92, h: 0.03 },   // row
  { src: "21:19194", dst: "21:18725", x: 0.962, y: 0.412, w: 0.028, h: 0.03 }, // Add btn
  { src: "21:19194", dst: "21:18730", x: 0.922, y: 0.412, w: 0.035, h: 0.03 }, // Update btn
  { src: "21:18730", dst: "21:18654", x: 0.64, y: 0.437, w: 0.094, h: 0.032 }, // phone dropdown
  { src: "21:18735", dst: "21:19062", x: 0.44, y: 0.585, w: 0.05, h: 0.035 },  // S8 file icon (manual)
  { src: "21:19127", dst: "21:19062", x: 0.85, y: 0.29, w: 0.03, h: 0.03 },    // S13 file icon (manual)
];

async function main() {
  const db = getDb();
  const [flow] = await db.select().from(flowsTable).where(eq(flowsTable.id, FLOW));
  if (!flow || flow.status !== "draft") throw new Error("refusing: flow missing or not draft");

  // 1. Delete all existing interactions (cascades hotspots) for a clean rebuild.
  const existing = await db.select().from(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));
  for (const it of existing) {
    await db.delete(flowHotspotsTable).where(eq(flowHotspotsTable.interactionId, it.id));
  }
  await db.delete(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));
  console.log("Deleted interactions:", existing.length);

  // 2. Remove the speculative Phase-B "Matches?" decision node (21:18653) — UNRESOLVED per spec.
  const del = await db
    .delete(flowStepsTable)
    .where(and(eq(flowStepsTable.flowId, FLOW), eq(flowStepsTable.figmaNodeId, "21:18653"), eq(flowStepsTable.stepType, "decision")))
    .returning();
  console.log("Deleted stale decision step(s):", del.length);

  // 3. Create the 3 Golden decision steps.
  for (const d of [D1, D2, D3]) {
    const step = await upsertFlowStep({ flowId: FLOW, figmaNodeId: d.node, name: d.name, normalizedName: d.name.toLowerCase(), stepType: "decision" });
    await updateStepDisplayName(step.id, d.display);
  }

  // 4. Resolve node -> stepId (screens + the new decisions).
  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const idOf = new Map(steps.map((s) => [s.figmaNodeId, s.id]));

  // 5. Create the 17 edges, all approved.
  let created = 0;
  const edgeIdBy = new Map<string, string>();
  for (const [srcN, dstN, label, trigger] of EDGES) {
    const src = idOf.get(srcN), dst = idOf.get(dstN);
    if (!src || !dst) { console.log("!! missing node", srcN, dstN); continue; }
    const it = await createInteraction({ flowId: FLOW, sourceStepId: src, destinationStepId: dst, label, trigger });
    await updateInteraction(it.id, { reviewStatus: "approved" });
    edgeIdBy.set(srcN + ">" + dstN, it.id);
    created++;
  }
  console.log("Created approved edges:", created);

  // 6. Hotspots for click edges.
  let hs = 0;
  for (const h of HOTSPOTS) {
    const iid = edgeIdBy.get(h.src + ">" + h.dst);
    if (!iid) { console.log("!! no edge for hotspot", h.src, h.dst); continue; }
    await createHotspot({ interactionId: iid, xPercent: h.x, yPercent: h.y, widthPercent: h.w, heightPercent: h.h });
    hs++;
  }
  console.log("Created hotspots:", hs);
  console.log("Decisions:", steps.filter((s) => s.stepType === "decision").map((s) => s.displayName));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
