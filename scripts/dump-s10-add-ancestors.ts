import { getFile, type FigmaNode } from "../src/lib/figma/client";

const QA = "kZjw4BrecmEnfFqcYri5Ya";
const SECTION = "21:18642";
const S10 = "21:19236";
interface Raw extends FigmaNode { characters?: string }

function find(node: FigmaNode, id: string): FigmaNode | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) { const f = find(c, id); if (f) return f; }
  return null;
}

async function main() {
  const file = await getFile(QA);
  let section: FigmaNode | null = null;
  for (const p of file.document.children ?? []) { section = find(p, SECTION); if (section) break; }
  const s10 = find(section!, S10) as Raw;
  const sb = s10.absoluteBoundingBox!;

  // Find the bottom-right "Add" text node and print its ancestor chain.
  let target: Raw | null = null;
  function walk(node: Raw, parents: Raw[]) {
    if (node.type === "TEXT" && (node.characters ?? "").trim().toLowerCase() === "add") {
      const b = node.absoluteBoundingBox;
      if (b && (!target || (target.absoluteBoundingBox && b.y > target.absoluteBoundingBox.y))) {
        target = node;
        (target as Raw & { _chain?: Raw[] })._chain = [...parents, node];
      }
    }
    for (const c of (node.children ?? []) as Raw[]) walk(c, [...parents, node]);
  }
  walk(s10, []);
  if (!target) { console.log("no Add text"); return; }
  const chain = (target as Raw & { _chain?: Raw[] })._chain!;
  console.log("S10 bbox:", JSON.stringify(sb));
  console.log("Ancestor chain of bottom-right 'Add' (outer -> inner):");
  for (const n of chain) {
    const b = n.absoluteBoundingBox;
    const rel = b ? ` rel=(${((b.x-sb.x)/sb.width).toFixed(3)},${((b.y-sb.y)/sb.height).toFixed(3)} ${(b.width/sb.width).toFixed(3)}x${(b.height/sb.height).toFixed(3)})` : "";
    console.log(`  [${n.type}] ${n.name} :: ${n.id.slice(-30)} bbox=${b ? Math.round(b.x)+","+Math.round(b.y)+" "+Math.round(b.width)+"x"+Math.round(b.height) : "?"}${rel}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
