/**
 * Reconcile module identity against the NBF-MODULES folder (authoritative
 * Navigator scope) WITHOUT re-fetching every file: archive stale/orphan modules
 * (not in the folder) and let real modules reclaim canonical slugs.
 * Non-destructive (archive + reslug only). Aborts before reconcile if discovery
 * returns 0 files, so an API failure can never archive the whole Navigator.
 */
import { collectFolderFiles } from "../src/lib/figma/client";
import { reconcileModules } from "../src/lib/figma/reconcile";

const FOLDER_IDS = (process.env.FIGMA_NBF_FOLDER_ID || "641708986")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const { names, files } = await collectFolderFiles(FOLDER_IDS);
  console.log(`NBF-MODULES folder ${FOLDER_IDS.join(", ")} (${names.join(", ") || "unnamed"}) files: ${files.length}`);
  if (files.length === 0) {
    throw new Error("Folder discovery returned 0 files — aborting reconcile (would archive everything).");
  }
  const recon = await reconcileModules(new Set(files.map((f) => f.key)));
  console.log(`Archived stale modules: ${recon.archived.length}`);
  for (const a of recon.archived) console.log(`  - ${a.name} (${a.figmaFileKey})`);
  console.log(`Reslugged modules: ${recon.reslugged.length}`);
  for (const r of recon.reslugged) console.log(`  - ${r.name}: ${r.from} -> ${r.to}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
