import { getServerEnv } from "../src/lib/env";

const FOLDER = "641708986";
const API = "https://api.figma.com/v1";

async function main() {
  const token = getServerEnv().FIGMA_ACCESS_TOKEN!;
  const res = await fetch(`${API}/projects/${FOLDER}/files`, { headers: { "X-Figma-Token": token } });
  const data = (await res.json()) as { name: string; files: { key: string; name: string }[] };
  console.log("Folder name:", data.name);
  console.log("Files count:", data.files.length);
  for (const f of data.files) console.log(`  ${f.key}  ${JSON.stringify(f.name)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
