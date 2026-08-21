import { getProjectFiles } from "../src/lib/figma/client";

const PROJECT = process.env.FIGMA_NBF_PROJECT_ID || "129256111";

async function main() {
  console.log("Project:", PROJECT);
  const files = await getProjectFiles(PROJECT);
  console.log("Files (modules) found:", files.length);
  for (const f of files) {
    console.log(`  ${f.key}  ${JSON.stringify(f.name)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("ERROR:", e.message || e); process.exit(1); });
