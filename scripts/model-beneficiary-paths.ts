/**
 * Phase B: model the fuller Beneficiary graph as PROPOSED edges + one decision
 * step, so they appear in admin Graph Review for human approval. Nothing here
 * is approved, so the player is unaffected. Idempotent (skips existing edges).
 */
import { getDb } from "../src/lib/db";
import { flowsTable, flowStepsTable, flowInteractionsTable } from "../drizzle/schema";
import { upsertFlowStep, createInteraction, updateStepDisplayName } from "../src/lib/repositories/flows";
import { eq, and } from "drizzle-orm";

const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";

async function main() {
  const db = getDb();
  const [flow] = await db.select().from(flowsTable).where(eq(flowsTable.id, FLOW));
  if (!flow || flow.status !== "draft") throw new Error("refusing: flow missing or not draft");

  // Decision step "Matches?" (SSN exists check) — Figma text node 21:18653
  const decision = await upsertFlowStep({
    flowId: FLOW,
    figmaNodeId: "21:18653",
    name: "Matches?",
    normalizedName: "matches",
    stepType: "decision",
    figmaX: 6105,
    figmaY: 8755,
  });
  await updateStepDisplayName(decision.id, "Matches? (SSN exists)");

  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const byNode = new Map(steps.map((s) => [s.figmaNodeId, s]));
  const id = (n: string) => byNode.get(n)?.id;

  const existing = await db.select().from(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));
  const has = (src?: string, dst?: string) =>
    !!src && !!dst && existing.some((e) => e.sourceStepId === src && e.destinationStepId === dst);

  // [sourceNode, destNode, label, trigger]
  const PROPOSED: Array<[string, string, string, "click" | "branch" | "next"]> = [
    // SSN-exists decision path
    ["21:19067", "21:18653", "Enter SSN — check for match", "next"],
    ["21:18653", "21:19263", "Matching SSN (Yes)", "branch"],
    // With-QDRO path
    ["21:19067", "21:18735", "With QDRO", "branch"],
    ["21:18735", "21:19062", "Open QDRO documents", "click"],
    // Edit path
    ["21:19194", "21:18730", "Edit / Update beneficiary", "click"],
    ["21:18730", "21:19236", "Edit details", "next"],
    ["21:19236", "21:18654", "Open phone type dropdown", "click"],
    ["21:19236", "21:19127", "Save (Success)", "branch"],
    ["21:19236", "21:19057", "Save (Error)", "branch"],
  ];

  let created = 0, skipped = 0;
  for (const [srcNode, dstNode, label, trigger] of PROPOSED) {
    const src = id(srcNode), dst = id(dstNode);
    if (!src || !dst) { console.log("!! missing node", srcNode, dstNode); continue; }
    if (has(src, dst)) { skipped++; continue; }
    await createInteraction({ flowId: FLOW, sourceStepId: src, destinationStepId: dst, label, trigger });
    created++;
  }
  console.log("Decision step:", decision.id, "(Matches?)");
  console.log("Proposed edges created:", created, " skipped(existing):", skipped);
  console.log("NOTE: all new edges are reviewStatus='proposed' — not shown in player until approved.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
