/**
 * Re-associate Beneficiary notes to the Golden graph (after graph rebuild).
 * Approves the explicitly-tied action/decision/branch annotations; keeps the
 * unresolved ones (plus-icon/aliases, Matches?, screen-frame titles) as
 * needs_review. Adds the missing Y3 QDRO-rules yellow annotation.
 * Original Figma text is never modified.
 */
import { getDb } from "../src/lib/db";
import { flowsTable, flowStepsTable, flowInteractionsTable, flowGuidanceTable } from "../drizzle/schema";
import { updateGuidanceAssociation, upsertFlowGuidance } from "../src/lib/repositories/flows";
import { eq, and } from "drizzle-orm";

const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";
const Y3_TEXT =
  "If no QDRO document, leave field blank\nIf 1 QDRO document, display file name\nIf >1 QDRO document, display “x documents”";

type Cat = "USER_GUIDANCE" | "ACTION_INSTRUCTION" | "QA_NOTE" | "EXPLANATION" | "DECISION_CONTEXT" | "GENERAL_FLOW_NOTE";

async function main() {
  const db = getDb();
  const [flow] = await db.select().from(flowsTable).where(eq(flowsTable.id, FLOW));
  if (!flow || flow.status !== "draft") throw new Error("refusing: flow missing/not draft");

  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const stepByNode = new Map(steps.map((s) => [s.figmaNodeId, s.id]));
  const interactions = await db.select().from(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));
  const edge = (srcN: string, dstN: string) => {
    const s = stepByNode.get(srcN), d = stepByNode.get(dstN);
    return interactions.find((i) => i.sourceStepId === s && i.destinationStepId === d)?.id;
  };

  // note figmaNodeId -> association
  type A = { scope: "flow" | "step" | "interaction" | "decision"; cat: Cat; review: "approved" | "needs_review"; stepNode?: string; edge?: [string, string]; decisionNode?: string };
  const MAP: Record<string, A> = {
    "21:18684": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:19162", "21:19194"] }, // Check a row
    "21:18686": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:19194", "21:18725"] }, // Go to Add
    "21:18689": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:19194", "21:18730"] }, // Go to Edit
    "21:18697": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:19161", "21:19263"] }, // Matching SSN
    "21:18699": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:19161", "21:19067"] }, // No Match
    "21:18701": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:19161", "21:18735"] }, // With QDRO
    "21:18705": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:18730", "21:19236"] }, // Enter Beneficiary details
    "21:18707": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:18730", "21:18654"] }, // Click on the Dropdown
    "21:18651": { scope: "interaction", cat: "EXPLANATION", review: "approved", edge: ["21:18730", "21:18654"] }, // Y4 dropdown explanation
    "21:18715": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:18717", "21:19094"] }, // Yes (Add)
    "21:18713": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:18717", "21:18761"] }, // No (Add)
    "21:18722": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:18724", "21:19127"] }, // Yes (Edit)
    "21:18720": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:18724", "21:19057"] }, // No (Edit)
    "21:18717": { scope: "decision", cat: "DECISION_CONTEXT", review: "approved", decisionNode: "21:18717" }, // Success? (Add)
    "21:18724": { scope: "decision", cat: "DECISION_CONTEXT", review: "approved", decisionNode: "21:18724" }, // Success? (Edit)
    "21:19243": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:18735", "21:19062"] }, // file icon (Add QDRO) instance
    "21:19231": { scope: "interaction", cat: "ACTION_INSTRUCTION", review: "approved", edge: ["21:19127", "21:19062"] }, // file icon (Edit success) instance
    // Unresolved / non-instructional — keep needs_review
    "21:18647": { scope: "step", cat: "GENERAL_FLOW_NOTE", review: "needs_review", stepNode: "21:19162" }, // "Beneficiary Tab"
    "21:18649": { scope: "flow", cat: "EXPLANATION", review: "needs_review" }, // Y1 plus-icon (aliases not drawn)
    "21:18709": { scope: "flow", cat: "EXPLANATION", review: "needs_review" }, // Y2 plus-icon
    "21:18653": { scope: "flow", cat: "GENERAL_FLOW_NOTE", review: "needs_review" }, // "Matches?" unresolved
  };
  // Screen-frame title notes -> GENERAL_FLOW_NOTE / needs_review, associated to their screen.
  for (const node of ["21:18725", "21:18730", "21:18735", "21:18761", "21:19057", "21:19062", "21:19067", "21:19094", "21:19236"]) {
    MAP[node] = { scope: "step", cat: "GENERAL_FLOW_NOTE", review: "needs_review", stepNode: node };
  }

  const guidance = await db.select().from(flowGuidanceTable).where(eq(flowGuidanceTable.flowId, FLOW));
  let approved = 0, needs = 0, missingTargets = 0, unmapped = 0;
  for (const g of guidance) {
    const a = MAP[g.figmaNodeId];
    if (!a) { unmapped++; continue; }
    const data: Parameters<typeof updateGuidanceAssociation>[1] = {
      scope: a.scope, category: a.cat, reviewStatus: a.review,
      stepId: null, interactionId: null, decisionStepId: null,
    };
    if (a.scope === "step") data.stepId = a.stepNode ? stepByNode.get(a.stepNode) ?? null : null;
    if (a.scope === "decision") data.decisionStepId = a.decisionNode ? stepByNode.get(a.decisionNode) ?? null : null;
    if (a.scope === "interaction") {
      const eid = a.edge ? edge(a.edge[0], a.edge[1]) : undefined;
      if (!eid) { missingTargets++; console.log("!! missing edge for note", g.figmaNodeId, a.edge); }
      data.interactionId = eid ?? null;
    }
    await updateGuidanceAssociation(g.id, data);
    if (a.review === "approved") approved++; else needs++;
  }

  // Add Y3 QDRO display rules if not present.
  const hasY3 = guidance.some((g) => g.text.includes("QDRO document, leave field blank"));
  if (!hasY3) {
    const rec = await upsertFlowGuidance({ flowId: FLOW, figmaNodeId: "21:19265", text: Y3_TEXT, guidanceType: "guidance" });
    await updateGuidanceAssociation(rec.id, { scope: "step", category: "USER_GUIDANCE", reviewStatus: "approved", stepId: stepByNode.get("21:18735") ?? null });
    console.log("Added Y3 QDRO-rules note ->", rec.id);
    approved++;
  } else {
    console.log("Y3 already present");
  }

  console.log(`Notes updated: approved=${approved} needs_review=${needs} unmapped(untouched)=${unmapped} missingEdgeTargets=${missingTargets}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
