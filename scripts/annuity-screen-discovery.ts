/**
 * READ-ONLY Annuity screen DISCOVERY REPORT (no DB writes). Applies structural
 * screen-root detection to each Flow SECTION and prints accepted / needs-review
 * / rejected candidates with reasons. This is the accuracy gate BEFORE any
 * persistence. The detection here is the reference implementation that the
 * indexer will reuse.
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { getDb } from "../src/lib/db";
import { flowsTable, modulesTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const ANNUITY_KEY = "ukMW6Flp8kc9sDTomkCPBs";
interface XNode extends FigmaNode {
  absoluteBoundingBox?: { width: number; height: number };
  characters?: string;
}
const W = (n: XNode) => Math.round(n.absoluteBoundingBox?.width ?? 0);
const H = (n: XNode) => Math.round(n.absoluteBoundingBox?.height ?? 0);

function findById(node: FigmaNode, id: string): FigmaNode | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) { const f = findById(c, id); if (f) return f; }
  return null;
}

// A wireframe layout instance = the actual UI content of a screen.
function hasLayoutInstance(frame: FigmaNode): XNode | null {
  for (const c of frame.children ?? []) {
    const x = c as XNode;
    if ((c.type === "INSTANCE" || c.type === "FRAME" || c.type === "COMPONENT") &&
        /layout/i.test(c.name) && W(x) >= 400 && H(x) >= 400) {
      return x;
    }
  }
  return null;
}
// The screen's authored name is its first TEXT title child; fallback frame name.
function titleOf(frame: FigmaNode): { name: string; fromText: boolean } {
  for (const c of frame.children ?? []) {
    const x = c as XNode;
    if (c.type === "TEXT" && x.characters && x.characters.trim()) {
      return { name: x.characters.trim(), fromText: true };
    }
  }
  return { name: frame.name, fromText: false };
}
const isAnnotation = (n: FigmaNode) => /^note$/i.test(n.name.trim());

interface Candidate { id: string; frameName: string; type: string; w: number; h: number; }
interface Decision extends Candidate { name: string; verdict: "ACCEPT" | "NEEDS_REVIEW" | "REJECT"; confidence: string; reason: string; }

// Screen container = the node whose direct children are the screen roots. If the
// SECTION wraps a single nested SECTION (main flow), descend into it.
function screenContainer(section: FigmaNode): FigmaNode {
  const kids = section.children ?? [];
  const sectionKids = kids.filter((c) => c.type === "SECTION");
  if (kids.length === 1 && sectionKids.length === 1) return sectionKids[0];
  return section;
}

function classify(child: FigmaNode): Decision {
  const x = child as XNode;
  const base = { id: child.id, frameName: child.name, type: child.type, w: W(x), h: H(x) };
  // Structural rejects first (evidence order: hierarchy/type/name before size).
  if (["VECTOR", "TEXT", "RECTANGLE", "ELLIPSE", "LINE", "GROUP"].includes(child.type))
    return { ...base, name: child.name, verdict: "REJECT", confidence: "n/a",
      reason: `${child.type.toLowerCase()} (connector/label/divider/decoration)` };
  if (isAnnotation(child))
    return { ...base, name: child.name, verdict: "REJECT", confidence: "n/a", reason: "annotation note" };

  const isContainerType = child.type === "FRAME" || child.type === "INSTANCE" || child.type === "COMPONENT";
  if (!isContainerType)
    return { ...base, name: child.name, verdict: "REJECT", confidence: "n/a", reason: `unhandled type ${child.type}` };

  const layout = hasLayoutInstance(child);
  const title = titleOf(child);
  // HIGH confidence: has a wireframe layout instance AND a viewport-like frame.
  if (layout && W(x) >= 500 && H(x) >= 500) {
    return { ...base, name: title.name, verdict: "ACCEPT",
      confidence: "high",
      reason: `frame with '${layout.name}' ${layout.absoluteBoundingBox?.width}x${layout.absoluteBoundingBox?.height} wireframe + ${title.fromText ? "title text" : "frame name"}` };
  }
  // Viewport-ish but no clear wireframe instance → needs review, never auto-index.
  if (W(x) >= 500 && H(x) >= 500) {
    return { ...base, name: title.name, verdict: "NEEDS_REVIEW", confidence: "medium",
      reason: "viewport-sized frame but no recognizable layout instance" };
  }
  return { ...base, name: title.name, verdict: "REJECT", confidence: "low",
    reason: `too small / supporting UI (${W(x)}x${H(x)})` };
}

async function main() {
  const db = getDb();
  const mod = (await db.select().from(modulesTable).where(eq(modulesTable.figmaFileKey, ANNUITY_KEY)))[0];
  const flows = await db.select().from(flowsTable).where(eq(flowsTable.moduleId, mod.id));
  const file = await getFile(ANNUITY_KEY);

  // Stable flow order: main flow first, then Lg, MD, Sm.
  const order = ["Annuity Distribution Eligibility- Flow", "Lg - 1024 px - Flow", "MD- 768 px- Flow", "Sm- 640 px - Flow"];
  flows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  let accepted = 0, review = 0, rejected = 0, candidates = 0;
  console.log(`MODULE: ${mod.name}  (${mod.figmaFileKey})\n`);

  for (const flow of flows) {
    const section = findById(file.document, flow.figmaSectionNodeId)!;
    const container = screenContainer(section);
    const kids = container.children ?? [];
    console.log("=".repeat(72));
    console.log(`FLOW: "${flow.name}"  section=${flow.figmaSectionNodeId}  container=${container.id} (${kids.length} children)`);
    const decisions = kids.map(classify);
    const acc = decisions.filter((d) => d.verdict === "ACCEPT");
    const rev = decisions.filter((d) => d.verdict === "NEEDS_REVIEW");
    const rej = decisions.filter((d) => d.verdict === "REJECT");
    candidates += acc.length + rev.length;
    accepted += acc.length; review += rev.length; rejected += rej.length;

    console.log(`  ACCEPTED (${acc.length}):`);
    acc.forEach((d, i) => console.log(`    ${i + 1}. "${d.name}"\n         node=${d.id} type=${d.type} size=${d.w}x${d.h} conf=${d.confidence}\n         reason: ${d.reason}`));
    if (rev.length) { console.log(`  NEEDS REVIEW (${rev.length}):`); rev.forEach((d) => console.log(`    - "${d.name}" node=${d.id} size=${d.w}x${d.h} — ${d.reason}`)); }
    console.log(`  REJECTED (${rej.length}): ` + rej.map((d) => `${d.type}:"${d.frameName}"`).join(", "));
  }

  console.log("\n" + "#".repeat(72));
  console.log(`TOTAL candidate roots (accept+review): ${candidates}`);
  console.log(`  Accepted (high conf): ${accepted}`);
  console.log(`  Needs review: ${review}`);
  console.log(`  Rejected: ${rejected}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
