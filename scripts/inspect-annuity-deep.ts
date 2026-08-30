/** READ-ONLY deeper inspection: level-2 children of screen-root candidates. */
import { getFile, type FigmaNode } from "../src/lib/figma/client";

const ANNUITY_KEY = "ukMW6Flp8kc9sDTomkCPBs";
interface XNode extends FigmaNode { absoluteBoundingBox?: { width: number; height: number }; characters?: string }
const dims = (n: XNode) => n.absoluteBoundingBox ? `${Math.round(n.absoluteBoundingBox.width)}x${Math.round(n.absoluteBoundingBox.height)}` : "—";

function findById(node: FigmaNode, id: string): FigmaNode | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) { const f = findById(c, id); if (f) return f; }
  return null;
}
function walk(n: FigmaNode, depth: number, maxDepth: number) {
  const x = n as XNode;
  const txt = x.characters ? ` chars="${x.characters.slice(0, 40)}"` : "";
  console.log(`${"  ".repeat(depth)}[${n.type}] "${n.name}" ${dims(x)} kids=${(n.children ?? []).length}${txt} id=${n.id}`);
  if (depth < maxDepth) for (const c of n.children ?? []) walk(c, depth + 1, maxDepth);
}

async function main() {
  const file = await getFile(ANNUITY_KEY);

  console.log("### Lg frame 27359:12417 — 2 levels deep ###");
  walk(findById(file.document, "27359:12417")!, 0, 2);

  console.log("\n### Lg frame 27360:13338 — 2 levels deep ###");
  walk(findById(file.document, "27360:13338")!, 0, 2);

  console.log("\n### MAIN flow nested SECTION 27313:4384 — direct children (level 1) ###");
  const mainSec = findById(file.document, "27313:4384")!;
  for (const c of mainSec.children ?? []) {
    const x = c as XNode;
    console.log(`  [${c.type}] "${c.name}" ${dims(x)} kids=${(c.children ?? []).length}${x.characters ? ` chars="${x.characters.slice(0,30)}"` : ""} id=${c.id}`);
  }

  console.log("\n### MAIN flow: first FRAME child — 2 levels deep ###");
  const firstFrame = (mainSec.children ?? []).find((c) => c.type === "FRAME");
  if (firstFrame) walk(firstFrame, 0, 2);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
