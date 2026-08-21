/**
 * NBF-MODULES folder indexer: Folder -> Files(Modules) -> Pages -> Flow SECTIONs.
 *
 * SOURCE OF TRUTH (2026-08-20): the authoritative set of CURRENT Modules is the
 * set of Figma FILES found beneath the NBF-MODULES folder (id FIGMA_NBF_FOLDER_ID,
 * default 641708986; team 1200899653462570429). Files that live elsewhere in the
 * team / the legacy project 129256111 are NOT current and are archived (never
 * deleted) by reconcileModules. The old project id is retained only in env for
 * legacy tooling — it is NOT used for current Module discovery here.
 *
 * Discovery runs FIRST. If the folder fetch throws (401/403/404/network), main()
 * aborts before any upsert/reconcile, so an API failure can never archive the
 * whole Navigator.
 *
 * Idempotent (upserts by file-scoped identity). Never deletes; missing entities
 * are only reported. Does NOT touch interactive-flow data (steps/interactions/
 * hotspots/guidance) — upsertFlow preserves status/startStepId/previewUrl.
 *
 * Run: npx tsx --env-file=.env.local -r tsconfig-paths/register scripts/index-figma-project.ts
 */
import { collectFolderFiles, getFile, type FigmaNode } from "../src/lib/figma/client";
import { generateFigmaNodeUrl } from "../src/lib/figma/flow-parser";
import { listProducts } from "../src/lib/repositories/products";
import { upsertModule } from "../src/lib/repositories/modules";
import { upsertPage } from "../src/lib/repositories/figma-pages";
import { upsertFlow } from "../src/lib/repositories/flows";
import { reconcileModules } from "../src/lib/figma/reconcile";

// Authoritative Navigator scope: NBF-MODULES folder id(s). Comma-separated to
// allow explicitly listing subfolders (the REST API exposes no auto subfolder
// enumeration for this token).
const FOLDER_IDS = (process.env.FIGMA_NBF_FOLDER_ID || "641708986")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// A Flow is a SECTION whose normalized name ends with "- flow".
function isFlowSection(node: FigmaNode): boolean {
  return node.type === "SECTION" && node.name.trim().toLowerCase().endsWith("- flow");
}

function collectFlowSections(node: FigmaNode, out: FigmaNode[]) {
  if (isFlowSection(node)) out.push(node);
  for (const c of node.children ?? []) collectFlowSections(c, out);
}

async function main() {
  const products = await listProducts();
  if (products.length === 0) throw new Error("No product configured; cannot associate modules.");
  const product = products[0];
  console.log(`Product: ${product.name} (${product.id})`);
  console.log(`NBF-MODULES folder id(s): ${FOLDER_IDS.join(", ")}`);

  // DISCOVERY FIRST. If this throws, main() rejects before any DB write or
  // reconcile — folder-fetch failure must never archive existing Modules.
  const { names, files } = await collectFolderFiles(FOLDER_IDS);
  console.log(`Folder name(s): ${names.join(", ") || "(unnamed)"}`);
  console.log(`Files (modules) in NBF-MODULES: ${files.length}\n`);
  if (files.length === 0) {
    throw new Error(
      "NBF-MODULES folder discovery returned 0 files — aborting before reconcile " +
        "(refusing to archive the entire Navigator on an empty/failed result).",
    );
  }

  let totalPages = 0, totalFlows = 0, modulesWithZeroFlows = 0, pagesWithZeroFlows = 0;
  const failed: Array<{ key: string; name: string; error: string }> = [];

  for (const file of files) {
    const mod = await upsertModule({
      productId: product.id,
      figmaFileKey: file.key,
      name: file.name,
      figmaFileName: file.name,
    });

    let tree;
    try {
      // depth 4 covers page -> wrapper -> flow section nesting while bounding payload.
      tree = await getFile(file.key, { depth: 4 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push({ key: file.key, name: file.name, error: msg });
      console.log(`  [SKIP] ${file.name} (${file.key}): ${msg}`);
      continue;
    }

    const pages = (tree.document.children ?? []).filter((n) => n.type === "CANVAS");
    let fileFlows = 0;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const dbPage = await upsertPage({
        moduleId: mod.id,
        figmaNodeId: page.id,
        name: page.name,
        normalizedName: page.name.trim().toLowerCase(),
        orderIndex: i,
      });
      totalPages++;

      const sections: FigmaNode[] = [];
      collectFlowSections(page, sections);
      if (sections.length === 0) pagesWithZeroFlows++;

      for (const section of sections) {
        await upsertFlow({
          productId: product.id,
          moduleId: mod.id,
          figmaPageId: dbPage.id,
          name: section.name,
          normalizedName: section.name.trim().toLowerCase(),
          figmaFileKey: file.key,
          figmaSectionNodeId: section.id,
          figmaUrl: generateFigmaNodeUrl(file.key, section.id),
          status: "draft",
        });
        totalFlows++;
        fileFlows++;
      }
    }
    if (fileFlows === 0) modulesWithZeroFlows++;
    console.log(`  ${file.name}: ${pages.length} pages, ${fileFlows} flows`);
  }

  // Reconcile identity: archive stale/orphan modules (not in project) and let
  // real modules reclaim canonical slugs. Fixes stale seed records shadowing.
  const recon = await reconcileModules(new Set(files.map((f) => f.key)));
  console.log(`\nReconcile: archived ${recon.archived.length} stale module(s), reslugged ${recon.reslugged.length}.`);
  for (const a of recon.archived) console.log(`    archived: ${a.name} (${a.figmaFileKey})`);
  for (const r of recon.reslugged) console.log(`    reslug: ${r.name}: ${r.from} -> ${r.to}`);

  console.log("\n" + "=".repeat(60));
  console.log("INDEX COMPLETE");
  console.log(`  Modules (files): ${files.length}`);
  console.log(`  Pages: ${totalPages}`);
  console.log(`  Flow sections: ${totalFlows}`);
  console.log(`  Modules with zero flows: ${modulesWithZeroFlows}`);
  console.log(`  Pages with zero flows: ${pagesWithZeroFlows}`);
  console.log(`  Files failed to fetch: ${failed.length}`);
  for (const f of failed) console.log(`    - ${f.name} (${f.key}): ${f.error}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("ERROR:", e); process.exit(1); });
