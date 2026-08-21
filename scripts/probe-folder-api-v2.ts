/**
 * READ-ONLY probe of the official Figma v2 Folder API. Tests whether the
 * CURRENT credential can enumerate folders recursively. NO DB writes, NO
 * reconciliation, NO application-code changes, NO indexing. Reports only.
 *
 * If /v2/folders/:id/files and /v2/folders/:id/folders both work, it performs a
 * read-only recursive walk (collectFolder) and prints the full tree + a
 * deduped-by-file-key total. Never prints the token value.
 */
import { getServerEnv } from "../src/lib/env";

const TEAM = "1200899653462570429";
const FOLDER = "641708986";
const API = "https://api.figma.com";

function token() {
  const t = getServerEnv().FIGMA_ACCESS_TOKEN;
  if (!t) throw new Error("FIGMA_ACCESS_TOKEN missing");
  return t;
}
function headers() {
  return { "X-Figma-Token": token() };
}
function credShape() {
  const t = token();
  const kind = t.startsWith("figd_")
    ? "personal access token (figd_…)"
    : t.startsWith("figu_") || t.startsWith("figoa")
      ? "OAuth token"
      : "unknown prefix";
  return `X-Figma-Token, kind=${kind}, length=${t.length}`;
}

async function req(url: string): Promise<{ status: number; json: unknown; text: string }> {
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

function scopesFrom(text: string): string | null {
  // Figma's 403 body lists the token's granted scopes in the message.
  const m = text.match(/Invalid scope: \[([^\]]*)\]/);
  return m ? m[1].replace(/"/g, "") : null;
}

// Defensive extractors — the exact v2 shape is confirmed at runtime below.
function arr(json: unknown, ...keys: string[]): Record<string, unknown>[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  for (const k of keys) {
    if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
    const meta = o["meta"];
    if (meta && typeof meta === "object" && Array.isArray((meta as Record<string, unknown>)[k])) {
      return (meta as Record<string, unknown>)[k] as Record<string, unknown>[];
    }
  }
  return [];
}
const fileKey = (f: Record<string, unknown>) =>
  (f.key ?? f.file_key ?? f.fileKey ?? "") as string;
const folderId = (f: Record<string, unknown>) =>
  String(f.id ?? f.folder_id ?? f.folderId ?? "");
const nameOf = (f: Record<string, unknown>) => String(f.name ?? "(unnamed)");

async function endpointCheck(label: string, url: string) {
  const { status, text } = await req(url);
  const scopes = scopesFrom(text);
  console.log(`\n[${label}] ${url}`);
  console.log(`  status: ${status}`);
  if (scopes) console.log(`  token scopes (from 403): ${scopes}`);
  else console.log(`  body: ${text.slice(0, 300)}`);
  return status;
}

// Read-only recursive walk. Aborts (throws) if any node fails, so a partial
// tree is never reported as authoritative.
async function collectFolder(
  id: string,
  depth: number,
  filesByKey: Map<string, string>,
  seen: Set<string>,
): Promise<void> {
  if (seen.has(id)) return;
  seen.add(id);
  const pad = "  ".repeat(depth);

  const filesRes = await req(`${API}/v2/folders/${id}/files`);
  if (filesRes.status !== 200) throw new Error(`files ${id} → ${filesRes.status}: ${filesRes.text.slice(0, 200)}`);
  const foldersRes = await req(`${API}/v2/folders/${id}/folders`);
  if (foldersRes.status !== 200) throw new Error(`folders ${id} → ${foldersRes.status}: ${foldersRes.text.slice(0, 200)}`);

  const files = arr(filesRes.json, "files");
  const subfolders = arr(foldersRes.json, "folders");

  for (const f of files) {
    const k = fileKey(f);
    if (k) filesByKey.set(k, nameOf(f));
  }
  console.log(`${pad}📁 ${id}: ${files.length} files, ${subfolders.length} subfolders`);
  for (const f of files) console.log(`${pad}   • ${nameOf(f)} (${fileKey(f) || "?"})`);

  for (const sf of subfolders) {
    const sid = folderId(sf);
    console.log(`${pad}   └─ subfolder: ${nameOf(sf)} (${sid})`);
    await collectFolder(sid, depth + 1, filesByKey, seen);
  }
}

async function main() {
  console.log(`Credential: ${credShape()}`);

  const files = await endpointCheck("v2 folder files", `${API}/v2/folders/${FOLDER}/files`);
  const folders = await endpointCheck("v2 folder folders", `${API}/v2/folders/${FOLDER}/folders`);
  await endpointCheck("v2 folder meta", `${API}/v2/folders/${FOLDER}/meta`);
  await endpointCheck("v2 team folders", `${API}/v2/teams/${TEAM}/folders`);

  const critical = files === 200 && folders === 200;
  console.log(`\nCritical (/files + /folders) both 200: ${critical}`);
  if (!critical) {
    console.log("v2 recursive discovery NOT available with this credential — stopping (no tree).");
    return;
  }

  // Confirm the actual response shapes once, so the report is grounded.
  const rootFiles = await req(`${API}/v2/folders/${FOLDER}/files`);
  const rootFolders = await req(`${API}/v2/folders/${FOLDER}/folders`);
  console.log(`\nSchema — /files top-level keys: ${rootFiles.json && typeof rootFiles.json === "object" ? Object.keys(rootFiles.json as object).join(",") : "n/a"}`);
  console.log(`Schema — /folders top-level keys: ${rootFolders.json && typeof rootFolders.json === "object" ? Object.keys(rootFolders.json as object).join(",") : "n/a"}`);

  console.log(`\n=== RECURSIVE FOLDER TREE (root ${FOLDER}) ===`);
  const filesByKey = new Map<string, string>();
  await collectFolder(FOLDER, 0, filesByKey, new Set());

  console.log(`\n=== SUMMARY ===`);
  console.log(`Recursively discovered files (deduped by key): ${filesByKey.size}`);
  console.log(`Previous v1 direct-root count: 16`);
  console.log(`Differs from 16: ${filesByKey.size !== 16}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("PROBE ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
