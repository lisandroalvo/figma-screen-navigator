/**
 * Phase A repairs (approved by user): set human-verified step display names,
 * fix the two swapped branch destinations, and approve the 5 pilot edges.
 * Draft flow only. Every label is backed by a fresh Figma render.
 */
import { getDb } from "../src/lib/db";
import { flowsTable, flowStepsTable, flowInteractionsTable } from "../drizzle/schema";
import {
  updateStepDisplayName,
  updateInteraction,
} from "../src/lib/repositories/flows";
import { eq } from "drizzle-orm";

const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";

// Verified labels (render-checked). Node id -> display name.
const LABELS: Record<string, string> = {
  "21:19162": "Beneficiaries Tab - Default",
  "21:19194": "Beneficiaries Tab - Row Selected",
  "21:18725": "Add Beneficiary Modal - Empty",
  "21:19067": "Add Beneficiary Modal - Populated",
  "21:19094": "Add Beneficiary Modal - Success", // was "With QDRO"
  "21:18761": "Add Beneficiary Modal - Error", // was "Success"
  "21:19062": "QDRO Documents Modal", // was "Error"
  "21:18735": "Add Beneficiary Modal - With QDRO", // was "QDRO Documents Modal"
  "21:18730": "Edit Beneficiary Modal - Default",
  "21:19236": "Edit Beneficiary Modal - Populated",
  "21:18654": "Edit Beneficiary Modal - Phone Dropdown",
  "21:19057": "Edit Beneficiary Modal - Error", // was "Success"
  "21:19127": "Edit Beneficiary Modal - Success", // was "Error"
  "21:19263": "SSN Exists", // was "Beneficiary Confirmation Modal"
};

async function main() {
  const db = getDb();
  const [flow] = await db.select().from(flowsTable).where(eq(flowsTable.id, FLOW));
  if (!flow) throw new Error("flow not found");
  if (flow.status !== "draft") throw new Error(`refusing: status ${flow.status}`);

  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const stepByNode = new Map(steps.map((s) => [s.figmaNodeId, s]));

  // 1. Display names
  let named = 0;
  for (const [node, label] of Object.entries(LABELS)) {
    const step = stepByNode.get(node);
    if (!step) { console.log("!! missing step for", node); continue; }
    await updateStepDisplayName(step.id, label);
    named++;
  }
  console.log("Display names set:", named, "/ 14");

  // 2. Fix branch destinations
  const interactions = await db.select().from(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));
  const byLabel = (n: string) => interactions.find((i) => (i.label ?? "").toLowerCase().includes(n));
  const successStep = stepByNode.get("21:19094"); // real success
  const errorStep = stepByNode.get("21:18761"); // real error
  const saveSuccess = byLabel("save (success)") ?? byLabel("success");
  const saveError = byLabel("save (error)") ?? byLabel("error");

  if (saveSuccess && successStep) {
    await updateInteraction(saveSuccess.id, { destinationStepId: successStep.id });
    console.log(`Save (Success) -> ${LABELS["21:19094"]} (21:19094)`);
  }
  if (saveError && errorStep) {
    await updateInteraction(saveError.id, { destinationStepId: errorStep.id });
    console.log(`Save (Error) -> ${LABELS["21:18761"]} (21:18761)`);
  }

  // 3. Approve the 5 verified pilot edges
  const pilotLabels = ["select beneficiary row", "add beneficiary", "fill form", "save (success)", "save (error)"];
  let approved = 0;
  for (const it of interactions) {
    if (pilotLabels.some((l) => (it.label ?? "").toLowerCase().includes(l))) {
      await updateInteraction(it.id, { reviewStatus: "approved" });
      approved++;
    }
  }
  console.log("Approved pilot edges:", approved);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
