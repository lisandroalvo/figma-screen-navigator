/**
 * READ-ONLY probe: can the current Figma credential enumerate the NBF-MODULES
 * folder? Figma's public REST API historically only exposes project-level file
 * listing, so this tries several candidate endpoints and reports exactly what
 * comes back. NO DB writes, NO reconciliation.
 */
import { getServerEnv } from "../src/lib/env";

const TEAM = "1200899653462570429";
const FOLDER = "641708986";
const API = "https://api.figma.com/v1";

function headers() {
  const token = getServerEnv().FIGMA_ACCESS_TOKEN;
  if (!token) throw new Error("FIGMA_ACCESS_TOKEN missing");
  return { "X-Figma-Token": token };
}

async function tryUrl(label: string, url: string) {
  try {
    const res = await fetch(url, { headers: headers() });
    const text = await res.text();
    const snippet = text.slice(0, 400);
    console.log(`\n[${label}] ${url}`);
    console.log(`  status: ${res.status} ${res.statusText}`);
    console.log(`  body: ${snippet}`);
    return { status: res.status, text };
  } catch (e) {
    console.log(`\n[${label}] ${url}`);
    console.log(`  ERROR: ${e instanceof Error ? e.message : String(e)}`);
    return { status: 0, text: "" };
  }
}

async function main() {
  // Candidate 1: folder addressed as a project (older data model).
  await tryUrl("project-as-folder", `${API}/projects/${FOLDER}/files`);
  // Candidate 2: list projects in the team (understand structure / find the folder).
  await tryUrl("team-projects", `${API}/teams/${TEAM}/projects`);
  // Candidate 3: hypothetical folder endpoints.
  await tryUrl("folders-files", `${API}/folders/${FOLDER}/files`);
  await tryUrl("folder-singular", `${API}/folder/${FOLDER}`);
  // Candidate 4: sanity — the known-good old project still works.
  await tryUrl("known-project", `${API}/projects/129256111/files`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
