/**
 * READ-ONLY Figma resolution for the Golden Spec. Dumps every TEXT node in the
 * Beneficiary section (id + text + bbox) and, for the screens we need hotspots
 * on, the descendant control candidates (name/type/bbox). Output -> /tmp JSON.
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { writeFile } from "node:fs/promises";

const QA_FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const SECTION = "21:18642";

interface Raw extends FigmaNode {
  characters?: string;
}

// Screens we need clickable controls on (for hotspots).
const CONTROL_SCREENS: Record<string, string> = {
  "21:19162": "S1 row",
  "21:19194": "S2 Add/Update/Delete",
  "21:19067": "S4 Add submit",
  "21:18735": "S8 file icon",
  "21:18730": "S9 dropdown",
  "21:19127": "S13 file icon",
};

function findNode(node: FigmaNode, id: string): FigmaNode | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}

function collectText(node: Raw, out: Array<{ id: string; text: string; bbox: FigmaNode["absoluteBoundingBox"] }>) {
  if (node.type === "TEXT" && node.characters && node.characters.trim()) {
    out.push({ id: node.id, text: node.characters.trim(), bbox: node.absoluteBoundingBox });
  }
  for (const c of (node.children ?? []) as Raw[]) collectText(c, out);
}

const CONTROL_RE = /add|update|delete|drop\s*down|dropdown|phone|file|upload|save|submit|plus|icon|row|cell|button|beneficiary/i;

function collectControls(node: Raw, out: Array<{ id: string; name: string; type: string; text?: string; bbox: FigmaNode["absoluteBoundingBox"] }>) {
  const text = node.type === "TEXT" ? node.characters?.trim() : undefined;
  if (
    (node.name && CONTROL_RE.test(node.name)) ||
    (text && CONTROL_RE.test(text))
  ) {
    out.push({ id: node.id, name: node.name, type: node.type, text, bbox: node.absoluteBoundingBox });
  }
  for (const c of (node.children ?? []) as Raw[]) collectControls(c, out);
}

async function main() {
  const file = await getFile(QA_FILE_KEY);
  let section: FigmaNode | null = null;
  for (const page of file.document.children ?? []) {
    section = findNode(page, SECTION);
    if (section) break;
  }
  if (!section) throw new Error("section not found");

  const textNodes: Array<{ id: string; text: string; bbox: FigmaNode["absoluteBoundingBox"] }> = [];
  collectText(section as Raw, textNodes);

  const controlsByScreen: Record<string, { screenBbox: FigmaNode["absoluteBoundingBox"]; controls: unknown[] }> = {};
  for (const [nodeId, tag] of Object.entries(CONTROL_SCREENS)) {
    const screen = findNode(section, nodeId);
    if (!screen) { console.log("!! screen not found", nodeId, tag); continue; }
    const controls: Array<{ id: string; name: string; type: string; text?: string; bbox: FigmaNode["absoluteBoundingBox"] }> = [];
    collectControls(screen as Raw, controls);
    controlsByScreen[nodeId] = { screenBbox: screen.absoluteBoundingBox, controls };
  }

  await writeFile("/tmp/figma-golden.json", JSON.stringify({ textNodes, controlsByScreen }, null, 2));

  // Print authored labels of interest for the graph
  const WANTED = [
    "start", "beneficiary tab", "check a row", "go to add beneficiary modal",
    "go to edit beneficiary modal", "ssn match", "matching ssn", "no match",
    "with qdro", "success", "yes", "no", "enter beneficiary details",
    "click on the dropdown", "clicking the file icon", "matches?", "plus icon", "dropdown menu", "qdro document",
  ];
  console.log("=== AUTHORED LABEL NODES ===");
  for (const t of textNodes) {
    const low = t.text.toLowerCase();
    if (WANTED.some((w) => low.includes(w))) {
      const b = t.bbox;
      console.log(`${t.id}  (${b ? Math.round(b.x) + "," + Math.round(b.y) : "?"})  ${JSON.stringify(t.text.slice(0, 80))}`);
    }
  }
  console.log(`\nTotal TEXT nodes: ${textNodes.length}`);
  console.log("Wrote /tmp/figma-golden.json");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
