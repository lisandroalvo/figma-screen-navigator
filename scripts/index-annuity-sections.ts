/**
 * PILOT searchable-SECTION indexer — Annuity Distribution Eligibility ONLY.
 *
 * Enumerates EVERY node.type === "SECTION" (recursively) per Page and upserts it
 * into flow_sections so any authored SECTION name is searchable by substring.
 * Additive + search-only: does NOT touch the interactive `flows` table, the
 * FlowPlayer, Golden Flow, Module/Page/Flow indexing, or reconciliation.
 * Idempotent (upsert by moduleId+figmaNodeId). Only node.type === "SECTION" is
 * recorded — no TEXT/FRAME/INSTANCE/VECTOR (false-positive protection).
 *
 * Run: npx tsx --env-file=.env.local -r tsconfig-paths/register scripts/index-annuity-sections.ts
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { generateFigmaNodeUrl } from "../src/lib/figma/flow-parser";
import { getDb } from "../src/lib/db";
import { modulesTable, figmaPagesTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { upsertFlowSection } from "../src/lib/repositories/flow-sections";

const ANNUITY_KEY = "ukMW6Flp8kc9sDTomkCPBs";
const isFlowContainer = (name: string) => name.trim().toLowerCase().endsWith("- flow");

interface Collected {
  figmaNodeId: string;
  name: string;
  parentNodeId: string;
  parentName: string;
  depth: number;
}

function collectSections(
  node: FigmaNode,
  depth: number,
  parentName: string,
  parentId: string,
  out: Collected[],
) {
  if (node.type === "SECTION") {
    out.push({ figmaNodeId: node.id, name: node.name, parentNodeId: parentId, parentName, depth });
  }
  for (const c of node.children ?? []) {
    collectSections(c, depth + 1, node.name, node.id, out);
  }
}

async function main() {
  const db = getDb();
  const mod = (await db.select().from(modulesTable).where(eq(modulesTable.figmaFileKey, ANNUITY_KEY)))[0];
  if (!mod) throw new Error("Annuity module not found");
  const pages = await db.select().from(figmaPagesTable).where(eq(figmaPagesTable.moduleId, mod.id));
  const pageByNodeId = new Map(pages.map((p) => [p.figmaNodeId, p]));

  const file = await getFile(ANNUITY_KEY);
  const canvases = (file.document.children ?? []).filter((n) => n.type === "CANVAS");

  let total = 0;
  for (const canvas of canvases) {
    const dbPage = pageByNodeId.get(canvas.id);
    if (!dbPage) continue; // only index sections under known DB pages
    const found: Collected[] = [];
    for (const c of canvas.children ?? []) collectSections(c, 1, canvas.name, canvas.id, found);

    console.log(`\nPAGE "${canvas.name}" (${canvas.id}): ${found.length} SECTION(s)`);
    for (const s of found) {
      await upsertFlowSection({
        productId: mod.productId,
        moduleId: mod.id,
        figmaPageId: dbPage.id,
        figmaFileKey: ANNUITY_KEY,
        figmaPageNodeId: canvas.id,
        figmaNodeId: s.figmaNodeId,
        parentNodeId: s.parentNodeId,
        parentName: s.parentName,
        parentFlowNodeId: null,
        parentFlowName: null,
        name: s.name,
        normalizedName: s.name.trim().toLowerCase().replace(/\s+/g, " "),
        figmaUrl: generateFigmaNodeUrl(ANNUITY_KEY, s.figmaNodeId),
        depth: s.depth,
        isFlowContainer: isFlowContainer(s.name),
        status: "detected",
      });
      console.log(`   [section] "${s.name}"  node=${s.figmaNodeId}  depth=${s.depth}  flowContainer=${isFlowContainer(s.name)}`);
      total++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("ANNUITY SECTION PILOT INDEX COMPLETE");
  console.log(`  Searchable SECTIONs indexed: ${total}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
