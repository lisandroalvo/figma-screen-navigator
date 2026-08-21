/**
 * READ-ONLY: resolve the Add submit button (full button bbox) in S10 Edit
 * Populated (21:19236), and report current DB state of the two edges we may
 * touch: S10->D3 and S13->S7. Also surface the QDRO file-icon candidates in
 * S13 (21:19127).
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { getDb } from "../src/lib/db";
import { flowStepsTable, flowInteractionsTable, flowHotspotsTable } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const QA = "kZjw4BrecmEnfFqcYri5Ya";
const SECTION = "21:18642";
const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";
const S10 = "21:19236";
const S13 = "21:19127";

interface Raw extends FigmaNode { characters?: string }

function find(node: FigmaNode, id: string): FigmaNode | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
}

// Find the button node = the smallest FRAME/INSTANCE/COMPONENT ancestor whose
// subtree contains a TEXT "Add", closest to a bottom-right submit position.
function findAddButton(screen: Raw): { buttonId: string; buttonBox: FigmaNode["absoluteBoundingBox"]; textBox: FigmaNode["absoluteBoundingBox"] } | null {
  let best: { buttonId: string; buttonBox: FigmaNode["absoluteBoundingBox"]; textBox: FigmaNode["absoluteBoundingBox"] } | null = null;
  function walk(node: Raw, parents: Raw[]) {
    if (node.type === "TEXT" && (node.characters ?? "").trim().toLowerCase() === "add") {
      // nearest ancestor that looks like a button (INSTANCE/COMPONENT/FRAME with small size)
      let btn: Raw | null = null;
      for (let i = parents.length - 1; i >= 0; i--) {
        const p = parents[i];
        const b = p.absoluteBoundingBox;
        if (!b) continue;
        if ((p.type === "INSTANCE" || p.type === "COMPONENT" || p.type === "FRAME") && b.width < 200 && b.height < 90) { btn = p; break; }
      }
      const tb = node.absoluteBoundingBox;
      const bb = btn?.absoluteBoundingBox ?? tb;
      // Prefer the bottom-right-most "Add" (submit), not table Add buttons.
      if (!best || (bb && best.buttonBox && (bb.y > best.buttonBox.y || (bb.y === best.buttonBox.y && bb.x > best.buttonBox.x)))) {
        best = { buttonId: btn?.id ?? node.id, buttonBox: bb, textBox: tb };
      }
    }
    for (const c of (node.children ?? []) as Raw[]) walk(c, [...parents, node]);
  }
  walk(screen, []);
  return best;
}

async function main() {
  const file = await getFile(QA);
  let section: FigmaNode | null = null;
  for (const p of file.document.children ?? []) { section = find(p, SECTION); if (section) break; }
  if (!section) throw new Error("section not found");

  const s10 = find(section, S10) as Raw | null;
  if (!s10) throw new Error("S10 not found");
  const sb = s10.absoluteBoundingBox!;
  const add = findAddButton(s10);
  console.log("=== S10 (21:19236) Edit Populated ===");
  console.log("screen bbox:", JSON.stringify(sb));
  if (add && add.buttonBox) {
    const b = add.buttonBox;
    const rel = { x: (b.x - sb.x) / sb.width, y: (b.y - sb.y) / sb.height, w: b.width / sb.width, h: b.height / sb.height };
    console.log("Add button node:", add.buttonId);
    console.log("Add button bbox:", JSON.stringify(b));
    console.log("Add button REL:", JSON.stringify({ x: +rel.x.toFixed(4), y: +rel.y.toFixed(4), w: +rel.w.toFixed(4), h: +rel.h.toFixed(4) }));
  } else {
    console.log("!! Add button not resolved");
  }

  // DB state
  const db = getDb();
  const steps = await db.select().from(flowStepsTable).where(eq(flowStepsTable.flowId, FLOW));
  const idOf = new Map(steps.map((s) => [s.figmaNodeId, s.id]));
  const interactions = await db.select().from(flowInteractionsTable).where(eq(flowInteractionsTable.flowId, FLOW));
  const s10id = idOf.get(S10), d3id = idOf.get("21:18724"), s13id = idOf.get(S13), s7id = idOf.get("21:19062");

  const s10d3 = interactions.find((i) => i.sourceStepId === s10id && i.destinationStepId === d3id);
  const s13s7 = interactions.find((i) => i.sourceStepId === s13id && i.destinationStepId === s7id);
  console.log("\n=== DB EDGES ===");
  console.log("S10->D3:", s10d3 && { id: s10d3.id, label: s10d3.label, trigger: s10d3.trigger, review: s10d3.reviewStatus });
  console.log("S13->S7:", s13s7 && { id: s13s7.id, label: s13s7.label, trigger: s13s7.trigger, review: s13s7.reviewStatus });
  if (s13s7) {
    const hs = await db.select().from(flowHotspotsTable).where(eq(flowHotspotsTable.interactionId, s13s7.id));
    console.log("S13->S7 hotspots:", hs.map((h) => ({ x: h.xPercent, y: h.yPercent, w: h.widthPercent, h: h.heightPercent })));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
