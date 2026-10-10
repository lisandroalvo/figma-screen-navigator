/**
 * Re-sync the Navigator DB from the NBF-MODULES Figma folder(s).
 *
 * Discovers every file in FIGMA_NBF_FOLDER_ID (comma-separated folder ids),
 * upserts Module rows, then per file fetches depth=3 and upserts
 * Pages (CANVAS nodes) and Flows (top-level SECTIONs named "*- Flow").
 * Non-destructive: upserts only; nothing is deleted. Modules missing from the
 * folder are archived via reconcileModules at the end.
 *
 * Run: npx tsx --env-file=.env.local -r tsconfig-paths/register scripts/resync-nbf-folder.ts
 */
import { collectFolderFiles, getFile } from "../src/lib/figma/client";
import { reconcileModules } from "../src/lib/figma/reconcile";
import { generateFigmaNodeUrl } from "../src/lib/figma/flow-parser";
import { upsertModule } from "../src/lib/repositories/modules";
import { upsertPage } from "../src/lib/repositories/figma-pages";
import { upsertFlow } from "../src/lib/repositories/flows";
import { getDb } from "../src/lib/db";
import { figmaPagesTable } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { withFigmaRetry } from "../src/lib/db/retry";

const PRODUCT_ID = "857f266e-d40c-46e3-9e30-b5475876d1f0"; // NBF
const FOLDER_IDS = (process.env.FIGMA_NBF_FOLDER_ID || "641708986")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const isFlowSection = (name: string) => norm(name).endsWith("- flow");

async function main() {
  const db = getDb();
  const { names, files } = await collectFolderFiles(FOLDER_IDS);
  console.log(
    `Folder(s) ${FOLDER_IDS.join(", ")} [${names.join(", ")}] → ${files.length} files`,
  );
  if (files.length === 0) {
    throw new Error("0 files discovered — aborting (safety).");
  }

  let pages = 0;
  let flows = 0;
  const failed: string[] = [];

  for (const file of files) {
    const mod = await upsertModule({
      productId: PRODUCT_ID,
      figmaFileKey: file.key,
      name: file.name,
      figmaFileName: file.name,
    });
    console.log(`\n== ${file.name} (${file.key})`);

    let doc;
    try {
      doc = await withFigmaRetry(() => getFile(file.key), {
        module: file.name,
        op: "getFile",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push(`${file.name}: ${msg}`);
      console.log(`   [SKIP] ${msg}`);
      continue;
    }

    const canvases = (doc.document.children ?? []).filter(
      (n) => n.type === "CANVAS",
    );
    for (const [orderIndex, canvas] of canvases.entries()) {
      const page = await upsertPage({
        moduleId: mod.id,
        figmaNodeId: canvas.id,
        name: canvas.name,
        normalizedName: norm(canvas.name),
        orderIndex,
      });
      pages++;

      // Find "- Flow" SECTIONs at any depth within the canvas
      const stack = [...(canvas.children ?? [])];
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (node.type === "SECTION" && isFlowSection(node.name)) {
          await upsertFlow({
            productId: PRODUCT_ID,
            moduleId: mod.id,
            figmaPageId: page.id,
            name: node.name,
            normalizedName: norm(node.name),
            figmaFileKey: file.key,
            figmaSectionNodeId: node.id,
            figmaUrl: generateFigmaNodeUrl(file.key, node.id),
            status: "draft",
          });
          flows++;
          console.log(`   flow: ${node.name} (${node.id})`);
          // Don't descend into flow sections (nested flows not supported)
          continue;
        }
        if (node.children) stack.push(...node.children);
      }
    }
    console.log(`   → ${canvases.length} pages`);
  }

  // Reconcile: archive modules whose fileKey is no longer in the folder.
  const recon = await reconcileModules(new Set(files.map((f) => f.key)));
  console.log(`\nArchived stale modules: ${recon.archived.length}`);
  for (const a of recon.archived) console.log(`  - ${a.name}`);

  console.log(`\nDONE — files: ${files.length}, pages upserted: ${pages}, flows upserted: ${flows}, failed: ${failed.length}`);
  for (const f of failed) console.log(`  ! ${f}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
