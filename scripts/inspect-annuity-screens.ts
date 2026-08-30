/**
 * READ-ONLY structural inspection of the Annuity Distribution Eligibility Figma
 * file. For each Flow SECTION, walk the descendant tree and print node metadata
 * so we can understand how screens are actually represented BEFORE writing any
 * detection rule. No DB writes, no Figma writes.
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { getDb } from "../src/lib/db";
import { flowsTable, modulesTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const ANNUITY_KEY = "ukMW6Flp8kc9sDTomkCPBs";

interface XNode extends FigmaNode {
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  characters?: string;
}

function findById(node: FigmaNode, id: string): FigmaNode | null {
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const f = findById(c, id);
    if (f) return f;
  }
  return null;
}

function dims(n: XNode): string {
  const b = n.absoluteBoundingBox;
  return b ? `${Math.round(b.width)}x${Math.round(b.height)}` : "—";
}

async function main() {
  const db = getDb();
  const mod = (await db.select().from(modulesTable).where(eq(modulesTable.figmaFileKey, ANNUITY_KEY)))[0];
  const flows = await db.select().from(flowsTable).where(eq(flowsTable.moduleId, mod.id));
  console.log(`Module: ${mod.name} (${mod.figmaFileKey})`);
  console.log(`Flows in DB: ${flows.length}`);
  for (const f of flows) console.log(`  - "${f.name}"  section=${f.figmaSectionNodeId}  page=${f.figmaPageId}`);

  console.log(`\nFetching full Annuity file tree…`);
  const file = await getFile(ANNUITY_KEY);
  console.log(`File: ${file.name}, lastModified ${file.lastModified}`);

  for (const flow of flows) {
    const section = findById(file.document, flow.figmaSectionNodeId);
    console.log(`\n${"=".repeat(70)}`);
    console.log(`FLOW: "${flow.name}"  (SECTION ${flow.figmaSectionNodeId})`);
    if (!section) { console.log("  !! section node not found in tree"); continue; }
    console.log(`  section type=${section.type} name="${section.name}" size=${dims(section as XNode)} directChildren=${(section.children ?? []).length}`);

    // Level-1 children of the SECTION (primary screen-root candidates)
    console.log(`  --- DIRECT CHILDREN (level 1) ---`);
    const typeCount: Record<string, number> = {};
    for (const c of section.children ?? []) {
      const x = c as XNode;
      typeCount[c.type] = (typeCount[c.type] ?? 0) + 1;
      const nKids = (c.children ?? []).length;
      const txt = x.characters ? ` chars="${x.characters.slice(0, 30)}"` : "";
      console.log(`    [${c.type}] "${c.name}"  ${dims(x)}  kids=${nKids}${txt}  id=${c.id}`);
    }
    console.log(`  child type histogram: ${JSON.stringify(typeCount)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
