/**
 * Independent coverage verifier: fetches CURRENT Figma truth for every file in
 * the NBF-MODULES folder (the authoritative Navigator scope) and compares Page +
 * Flow inventories against the DB. This does NOT trust the indexer's own records
 * — it re-derives truth from the Figma API, and its source of truth is the same
 * folder tree the indexer uses (NOT the legacy project 129256111).
 *
 * For each supported design file:
 *   FIGMA pages (CANVAS children)  vs  DB pages (active module)
 *   FIGMA flow sections (name ends "- flow", recursive)  vs  DB flows
 * Reports missing / extra(stale) / fetch failures / unsupported.
 */
import { collectFolderFiles, getFile, type FigmaNode } from "../src/lib/figma/client";
import { listModules } from "../src/lib/repositories/modules";
import { listPages } from "../src/lib/repositories/figma-pages";
import { listFlows } from "../src/lib/repositories/flows";

const FOLDER_IDS = (process.env.FIGMA_NBF_FOLDER_ID || "641708986")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isFlowSection = (n: FigmaNode) =>
  n.type === "SECTION" && n.name.trim().toLowerCase().endsWith("- flow");
function collectFlows(n: FigmaNode, out: FigmaNode[]) {
  if (isFlowSection(n)) out.push(n);
  for (const c of n.children ?? []) collectFlows(c, out);
}

async function main() {
  const { names, files } = await collectFolderFiles(FOLDER_IDS);
  console.log(`Source of truth: NBF-MODULES folder ${FOLDER_IDS.join(", ")} (${names.join(", ") || "unnamed"}) — ${files.length} files\n`);
  const modules = await listModules();
  const pages = await listPages();
  const flows = await listFlows();
  const moduleByKey = new Map(modules.filter((m) => m.status !== "archived").map((m) => [m.figmaFileKey, m]));
  const pagesByModule = new Map<string, Set<string>>();
  for (const p of pages) {
    if (!pagesByModule.has(p.moduleId)) pagesByModule.set(p.moduleId, new Set());
    pagesByModule.get(p.moduleId)!.add(p.figmaNodeId);
  }
  const flowsByModule = new Map<string, Set<string>>();
  for (const f of flows) {
    if (!flowsByModule.has(f.moduleId)) flowsByModule.set(f.moduleId, new Set());
    flowsByModule.get(f.moduleId)!.add(f.figmaSectionNodeId);
  }

  let supported = 0, unsupported = 0, failed = 0;
  let pageVerified = 0;
  let figmaPagesTotal = 0, matchedPages = 0, missingPagesTotal = 0, stalePagesTotal = 0;
  let figmaFlowsTotal = 0, matchedFlows = 0, missingFlowsTotal = 0, staleFlowsTotal = 0;
  const problems: string[] = [];

  for (const file of files) {
    let tree;
    try {
      tree = await getFile(file.key, { depth: 4 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not supported/i.test(msg)) { unsupported++; console.log(`[UNSUPPORTED] ${file.name}`); }
      else { failed++; console.log(`[FETCH FAILED] ${file.name}: ${msg}`); }
      continue;
    }
    supported++;

    const figmaPages = (tree.document.children ?? []).filter((n) => n.type === "CANVAS");
    const figmaPageIds = new Set(figmaPages.map((p) => p.id));
    const figmaFlowIds = new Set<string>();
    for (const p of figmaPages) { const s: FigmaNode[] = []; collectFlows(p, s); s.forEach((x) => figmaFlowIds.add(x.id)); }

    const mod = moduleByKey.get(file.key);
    const dbPages = mod ? (pagesByModule.get(mod.id) ?? new Set()) : new Set<string>();
    const dbFlows = mod ? (flowsByModule.get(mod.id) ?? new Set()) : new Set<string>();

    const missingPages = [...figmaPageIds].filter((id) => !dbPages.has(id));
    const stalePages = [...dbPages].filter((id) => !figmaPageIds.has(id));
    const missingFlows = [...figmaFlowIds].filter((id) => !dbFlows.has(id));
    const staleFlows = [...dbFlows].filter((id) => !figmaFlowIds.has(id));

    figmaPagesTotal += figmaPageIds.size;
    matchedPages += [...figmaPageIds].filter((id) => dbPages.has(id)).length;
    missingPagesTotal += missingPages.length;
    stalePagesTotal += stalePages.length;
    figmaFlowsTotal += figmaFlowIds.size;
    matchedFlows += [...figmaFlowIds].filter((id) => dbFlows.has(id)).length;
    missingFlowsTotal += missingFlows.length;
    staleFlowsTotal += staleFlows.length;

    const pass = missingPages.length === 0 && missingFlows.length === 0;
    if (pass) pageVerified++;
    const status = pass ? "PASS" : "FAIL";
    console.log(`${status}  ${file.name}: figmaPages=${figmaPageIds.size} dbPages=${dbPages.size} missing=${missingPages.length} stale=${stalePages.length} | figmaFlows=${figmaFlowIds.size} dbFlows=${dbFlows.size} missingFlows=${missingFlows.length} staleFlows=${staleFlows.length}`);
    if (!pass) {
      if (!mod) problems.push(`  ${file.name}: NO ACTIVE DB MODULE for key ${file.key}`);
      const nameOf = (id: string) => figmaPages.find((p) => p.id === id)?.name ?? id;
      for (const id of missingPages) problems.push(`  ${file.name}: MISSING PAGE ${id} "${nameOf(id)}"`);
      for (const id of missingFlows) problems.push(`  ${file.name}: MISSING FLOW ${id}`);
    }
  }

  console.log("\n" + "=".repeat(64));
  console.log("COVERAGE SUMMARY");
  console.log(`  Supported design files: ${supported}`);
  console.log(`  Unsupported files: ${unsupported}`);
  console.log(`  Fetch failed: ${failed}`);
  console.log(`  Modules page+flow verified (0 missing): ${pageVerified} / ${supported}`);
  console.log(`  Figma pages: ${figmaPagesTotal}  matched DB: ${matchedPages}  MISSING: ${missingPagesTotal}  stale DB: ${stalePagesTotal}`);
  console.log(`  Figma flow sections: ${figmaFlowsTotal}  matched DB: ${matchedFlows}  MISSING: ${missingFlowsTotal}  stale DB: ${staleFlowsTotal}`);
  console.log(`  100% CURRENT COVERAGE: ${missingPagesTotal === 0 && missingFlowsTotal === 0}`);
  if (problems.length) { console.log("\nPROBLEMS:"); problems.forEach((p) => console.log(p)); }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
