/**
 * READ-ONLY audit of Figma-authored notes/guidance for the Beneficiary Flow.
 * Inventories notes in section 21:18642, cross-references the DB guidance rows,
 * and proposes associations (screen/interaction/decision/flow) by graph context,
 * spatial proximity, and text heuristics. Writes JSON to /tmp for follow-up.
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { extractGuidanceCandidates } from "../src/lib/figma/flow-parser";
import { getDb } from "../src/lib/db";
import {
  flowStepsTable,
  flowInteractionsTable,
  flowGuidanceTable,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { writeFile } from "node:fs/promises";

const QA_FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const SECTION = "21:18642";
const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";

type Box = { x: number; y: number; width: number; height: number };
const centerOf = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.round(Math.hypot(a.x - b.x, a.y - b.y));

async function main() {
  const db = getDb();

  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const interactions = await db.select().from(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));
  const dbGuidance = await db.select().from(flowGuidanceTable).where(eq(flowGuidanceTable.flowId, FLOW));

  const stepById = new Map(steps.map((s) => [s.id, s]));
  const stepCenter = (s: typeof steps[number]) =>
    s.figmaX != null && s.figmaY != null
      ? centerOf({ x: s.figmaX, y: s.figmaY, width: s.figmaWidth ?? 0, height: s.figmaHeight ?? 0 })
      : null;

  // Fetch the full Figma file and locate the section node recursively.
  const file = await getFile(QA_FILE_KEY);
  function findNode(node: FigmaNode, id: string): FigmaNode | null {
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }
  let section: FigmaNode | null = null;
  for (const page of file.document.children ?? []) {
    section = findNode(page, SECTION);
    if (section) break;
  }
  if (!section) throw new Error("Section not found in Figma");

  const candidates = extractGuidanceCandidates(section);

  console.log("=".repeat(72));
  console.log("BENEFICIARY NOTE AUDIT — section", SECTION);
  console.log("=".repeat(72));
  console.log(`DB steps: ${steps.length}  interactions: ${interactions.length}  guidance rows: ${dbGuidance.length}`);
  console.log(`Figma guidance candidates (direct children of section): ${candidates.length}`);
  console.log();

  const branchSourceStepIds = new Set(
    interactions.filter((i) => i.trigger === "branch").map((i) => i.sourceStepId),
  );

  const inventory = candidates.map((c) => {
    const box = c.boundingBox;
    const noteCenter = box ? centerOf(box) : null;

    // Nearest screen by centroid
    let nearestScreen: { id: string; name: string; node: string; d: number } | null = null;
    if (noteCenter) {
      for (const s of steps) {
        const sc = stepCenter(s);
        if (!sc) continue;
        const d = dist(noteCenter, sc);
        if (!nearestScreen || d < nearestScreen.d) {
          nearestScreen = { id: s.id, name: s.name, node: s.figmaNodeId, d };
        }
      }
    }

    // Nearest interaction (distance to source-center and to source→dest midpoint)
    let nearestInteraction: { id: string; label: string | null; trigger: string; d: number } | null = null;
    if (noteCenter) {
      for (const it of interactions) {
        const src = stepById.get(it.sourceStepId);
        const dst = stepById.get(it.destinationStepId);
        const sc = src ? stepCenter(src) : null;
        const dc = dst ? stepCenter(dst) : null;
        if (!sc) continue;
        const mid = dc ? { x: (sc.x + dc.x) / 2, y: (sc.y + dc.y) / 2 } : sc;
        const d = Math.min(dist(noteCenter, sc), dist(noteCenter, mid));
        if (!nearestInteraction || d < nearestInteraction.d) {
          nearestInteraction = { id: it.id, label: it.label, trigger: it.trigger, d };
        }
      }
    }

    // Text-heuristic association proposal
    const t = c.text.toLowerCase();
    let scope = "step";
    let confidence = "low";
    let proposed = nearestScreen ? `SCREEN: ${nearestScreen.name} (${nearestScreen.node})` : "UNASSOCIATED";

    if (c.type === "decision") {
      scope = "decision";
      const branchStep = steps.find((s) => branchSourceStepIds.has(s.id));
      proposed = branchStep ? `DECISION at ${branchStep.name} (${branchStep.figmaNodeId})` : "DECISION (unresolved)";
      confidence = branchStep ? "medium" : "low";
    } else if (c.type === "branch_label") {
      scope = "interaction";
      const wantSuccess = t.includes("success");
      const wantError = t.includes("error");
      const match = interactions.find(
        (i) => i.trigger === "branch" && (i.label ?? "").toLowerCase().includes(wantSuccess ? "success" : wantError ? "error" : "###"),
      );
      proposed = match ? `INTERACTION: ${match.label}` : nearestInteraction ? `INTERACTION: ${nearestInteraction.label} (nearest)` : "INTERACTION (unresolved)";
      confidence = match ? "high" : "low";
    } else if (c.type === "action") {
      scope = "interaction";
      proposed = nearestInteraction ? `INTERACTION: ${nearestInteraction.label ?? "[" + nearestInteraction.trigger + "]"} (d=${nearestInteraction.d})` : "INTERACTION (unresolved)";
      confidence = nearestInteraction && nearestInteraction.d < 1500 ? "medium" : "low";
    } else {
      scope = "step";
      confidence = nearestScreen && nearestScreen.d < 1500 ? "medium" : "low";
    }

    const review = confidence === "low" ? "NEEDS_REVIEW" : "PROPOSED";

    return {
      nodeId: c.nodeId,
      type: c.type,
      scope,
      text: c.text,
      box,
      nearestScreen,
      nearestInteraction,
      proposed,
      confidence,
      review,
    };
  });

  // Print inventory
  inventory.forEach((n, i) => {
    console.log(`${i + 1}. [${n.type}] node ${n.nodeId}  (${n.confidence} → ${n.review})`);
    console.log(`   text: ${JSON.stringify(n.text.slice(0, 160))}`);
    if (n.box) console.log(`   pos: (${Math.round(n.box.x)}, ${Math.round(n.box.y)})  ${Math.round(n.box.width)}x${Math.round(n.box.height)}`);
    if (n.nearestScreen) console.log(`   nearestScreen: ${n.nearestScreen.name} (${n.nearestScreen.node}) d=${n.nearestScreen.d}`);
    if (n.nearestInteraction) console.log(`   nearestInteraction: ${n.nearestInteraction.label ?? "[" + n.nearestInteraction.trigger + "]"} d=${n.nearestInteraction.d}`);
    console.log(`   PROPOSED: ${n.proposed}`);
    console.log();
  });

  // Category totals
  const byType: Record<string, number> = {};
  const byReview: Record<string, number> = {};
  for (const n of inventory) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
    byReview[n.review] = (byReview[n.review] ?? 0) + 1;
  }
  console.log("TOTALS by type:", JSON.stringify(byType));
  console.log("TOTALS by review:", JSON.stringify(byReview));
  console.log();

  // Cross-reference DB guidance rows
  console.log("-".repeat(72));
  console.log("DB GUIDANCE ROWS:", dbGuidance.length);
  const dbByType: Record<string, number> = {};
  let nullStep = 0;
  for (const g of dbGuidance) {
    dbByType[g.guidanceType] = (dbByType[g.guidanceType] ?? 0) + 1;
    if (!g.stepId) nullStep++;
  }
  console.log("DB by guidanceType:", JSON.stringify(dbByType));
  console.log("DB rows with NULL stepId (unassociated):", nullStep, "/", dbGuidance.length);
  const figmaNodeIds = new Set(candidates.map((c) => c.nodeId));
  const dbNodeIds = new Set(dbGuidance.map((g) => g.figmaNodeId));
  const inDbNotInFigma = [...dbNodeIds].filter((id) => !figmaNodeIds.has(id));
  const inFigmaNotInDb = [...figmaNodeIds].filter((id) => !dbNodeIds.has(id));
  console.log("DB node ids NOT among current Figma candidates (possibly stale):", inDbNotInFigma.length);
  console.log("Figma candidates NOT in DB (missing):", inFigmaNotInDb.length);

  await writeFile("/tmp/benef-notes-audit.json", JSON.stringify({ inventory, dbGuidance }, null, 2));
  console.log("\nWrote /tmp/benef-notes-audit.json");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
