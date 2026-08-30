/**
 * READ-ONLY audit: enumerate EVERY node.type === "SECTION" in the Annuity file,
 * recursively, per Page. Reports name/id/parent/depth + whether it's currently
 * in the `flows` table and whether it's searchable today. No writes.
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { getDb } from "../src/lib/db";
import { modulesTable, flowsTable, figmaPagesTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const ANNUITY_KEY = "ukMW6Flp8kc9sDTomkCPBs";
const isFlowName = (n: string) => n.trim().toLowerCase().endsWith("- flow");

interface Found { name: string; id: string; parent: string; parentId: string; page: string; depth: number; }

function walk(node: FigmaNode, page: string, depth: number, parentName: string, parentId: string, out: Found[]) {
  if (node.type === "SECTION") {
    out.push({ name: node.name, id: node.id, parent: parentName, parentId, page, depth });
  }
  for (const c of node.children ?? []) {
    walk(c, page, depth + 1, node.name, node.id, out);
  }
}

async function main() {
  const db = getDb();
  const mod = (await db.select().from(modulesTable).where(eq(modulesTable.figmaFileKey, ANNUITY_KEY)))[0];
  const dbFlows = await db.select().from(flowsTable).where(eq(flowsTable.moduleId, mod.id));
  const dbPages = await db.select().from(figmaPagesTable).where(eq(figmaPagesTable.moduleId, mod.id));
  const flowSectionIds = new Set(dbFlows.map((f) => f.figmaSectionNodeId));

  const file = await getFile(ANNUITY_KEY);
  const canvases = (file.document.children ?? []).filter((n) => n.type === "CANVAS");

  const all: Found[] = [];
  for (const canvas of canvases) {
    for (const c of canvas.children ?? []) walk(c, canvas.name, 1, canvas.name, canvas.id, all);
  }

  console.log(`Module: ${mod.name}  pages(DB)=${dbPages.length}  flows(DB)=${dbFlows.length}`);
  console.log(`Total SECTION nodes in Figma: ${all.length}\n`);
  for (const s of all) {
    const indexed = flowSectionIds.has(s.id);
    const flowNamed = isFlowName(s.name);
    console.log(`[SECTION] "${s.name}"`);
    console.log(`   id=${s.id} depth=${s.depth} page="${s.page}" parent="${s.parent}"(${s.parentId})`);
    console.log(`   endsWith("- flow")=${flowNamed}  inFlowsTable=${indexed}  searchableToday=${indexed}`);
  }

  const contains = (kw: string) => all.filter((s) => s.name.toLowerCase().includes(kw));
  for (const kw of ["modal", "tooltip", "default", "success", "error"]) {
    const hits = contains(kw);
    console.log(`\nSECTIONs containing "${kw}": ${hits.length}`);
    for (const h of hits) console.log(`   - "${h.name}" (${h.id}) inFlowsTable=${flowSectionIds.has(h.id)}`);
  }

  console.log(`\nSECTIONs NOT in flows table (would be missing from search):`);
  for (const s of all.filter((s) => !flowSectionIds.has(s.id))) {
    console.log(`   - "${s.name}" (${s.id})  endsWith("- flow")=${isFlowName(s.name)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
