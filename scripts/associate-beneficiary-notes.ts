/**
 * Associate the 30 Beneficiary guidance notes (draft flow) using the audit
 * output. Deterministic rules; only clearly-correct pilot-path notes are
 * auto-approved. Never edits the original Figma `text`.
 */
import { getDb } from "../src/lib/db";
import { flowStepsTable, flowInteractionsTable, flowGuidanceTable } from "../drizzle/schema";
import { updateGuidanceAssociation } from "../src/lib/repositories/flows";
import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";

const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";

type Scope = "flow" | "step" | "interaction" | "decision";
type Review = "proposed" | "approved" | "rejected" | "needs_review";
type Category =
  | "USER_GUIDANCE" | "ACTION_INSTRUCTION" | "QA_NOTE"
  | "EXPLANATION" | "DECISION_CONTEXT" | "GENERAL_FLOW_NOTE";

async function main() {
  const db = getDb();
  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const interactions = await db.select().from(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));
  const guidance = await db.select().from(flowGuidanceTable).where(eq(flowGuidanceTable.flowId, FLOW));

  const stepByNode = new Map(steps.map((s) => [s.figmaNodeId, s]));
  const stepNodeSet = new Set(steps.map((s) => s.figmaNodeId));
  const populated = steps.find((s) => s.figmaNodeId === "21:19067"); // branch source
  const interactionByLabel = (needle: string) =>
    interactions.find((i) => (i.label ?? "").toLowerCase().includes(needle.toLowerCase()));

  const selectRow = interactionByLabel("select beneficiary row");
  const addBenef = interactionByLabel("add beneficiary");

  const audit = JSON.parse(await readFile("/tmp/benef-notes-audit.json", "utf8")) as {
    inventory: Array<{
      nodeId: string; type: string; text: string;
      box: { x: number; y: number; width: number; height: number } | null;
      nearestScreen: { id: string; node: string; d: number } | null;
      nearestInteraction: { id: string; label: string | null; trigger: string; d: number } | null;
      confidence: string;
    }>;
  };
  const auditByNode = new Map(audit.inventory.map((n) => [n.nodeId, n]));

  // Explicit auto-approvals for the pilot path (high confidence).
  const APPROVE: Record<string, { scope: Scope; category: Category; interactionId?: string; decisionStepId?: string }> = {};
  if (selectRow) APPROVE["21:18684"] = { scope: "interaction", category: "ACTION_INSTRUCTION", interactionId: selectRow.id }; // "Check a row"
  if (addBenef) APPROVE["21:18686"] = { scope: "interaction", category: "ACTION_INSTRUCTION", interactionId: addBenef.id }; // "Go to Add Beneficiary Modal"
  if (populated) APPROVE["21:18653"] = { scope: "decision", category: "DECISION_CONTEXT", decisionStepId: populated.id }; // "Matches?"
  if (populated) APPROVE["21:18717"] = { scope: "decision", category: "DECISION_CONTEXT", decisionStepId: populated.id }; // "Success ?"

  let approved = 0, needsReview = 0, proposed = 0;

  for (const g of guidance) {
    const a = auditByNode.get(g.figmaNodeId);
    const box = a?.box ?? null;
    const type = a?.type ?? g.guidanceType;

    let scope: Scope = "step";
    let category: Category = "USER_GUIDANCE";
    let review: Review = "proposed";
    let stepId: string | null = null;
    let interactionId: string | null = null;
    let decisionStepId: string | null = null;

    if (APPROVE[g.figmaNodeId]) {
      const ap = APPROVE[g.figmaNodeId];
      scope = ap.scope; category = ap.category; review = "approved";
      interactionId = ap.interactionId ?? null;
      decisionStepId = ap.decisionStepId ?? null;
    } else if (stepNodeSet.has(g.figmaNodeId)) {
      // Frame-title text captured as guidance — not a real annotation.
      scope = "step"; stepId = stepByNode.get(g.figmaNodeId)!.id;
      category = "GENERAL_FLOW_NOTE"; review = "needs_review";
    } else if (type === "decision") {
      scope = "decision"; decisionStepId = populated?.id ?? null;
      category = "DECISION_CONTEXT"; review = "needs_review";
    } else if (type === "action" || type === "branch_label") {
      scope = "interaction";
      interactionId = a?.nearestInteraction?.id ?? null;
      category = "ACTION_INSTRUCTION";
      review = a && a.nearestInteraction && a.nearestInteraction.d < 400 ? "proposed" : "needs_review";
    } else {
      // descriptive guidance / explanation
      scope = "step"; stepId = a?.nearestScreen?.id ?? null;
      category = "EXPLANATION";
      review = a && a.nearestScreen && a.nearestScreen.d < 1200 ? "proposed" : "needs_review";
    }

    await updateGuidanceAssociation(g.id, {
      scope, stepId, interactionId, decisionStepId, category, reviewStatus: review,
    });
    // Position metadata (separate update to keep the helper association-only)
    if (box) {
      await db.update(flowGuidanceTable).set({
        figmaX: Math.round(box.x), figmaY: Math.round(box.y),
        figmaWidth: Math.round(box.width), figmaHeight: Math.round(box.height),
        confidence: a?.confidence ?? null,
      }).where(eq(flowGuidanceTable.id, g.id));
    }

    if (review === "approved") approved++;
    else if (review === "needs_review") needsReview++;
    else proposed++;
  }

  console.log("Associated", guidance.length, "notes.");
  console.log("  approved:", approved, " proposed:", proposed, " needs_review:", needsReview);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
