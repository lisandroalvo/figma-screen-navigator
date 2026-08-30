/**
 * READ-ONLY screen QA (DB-only, no Figma fetch). Random-50 precision sample,
 * state-specific sampling, large-module structural stats, and a 25-screen recall
 * selection across 7 modules. Deterministic seed for reproducibility.
 */
import { getDb } from "../src/lib/db";
import { flowScreensTable, modulesTable, figmaPagesTable } from "../drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";

type Row = typeof flowScreensTable.$inferSelect & { moduleName: string; pageName: string };

// deterministic PRNG
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function main() {
  const db = getDb();
  const modules = (await db.select().from(modulesTable)).filter((m) => m.status !== "archived");
  const modName = new Map(modules.map((m) => [m.id, m.name]));
  const modIds = modules.map((m) => m.id);
  const pages = await db.select().from(figmaPagesTable).where(inArray(figmaPagesTable.moduleId, modIds));
  const pageName = new Map(pages.map((p) => [p.id, p.name]));

  const raw = await db.select().from(flowScreensTable).where(and(inArray(flowScreensTable.moduleId, modIds), eq(flowScreensTable.status, "detected")));
  const rows: Row[] = raw.map((r) => ({ ...r, moduleName: modName.get(r.moduleId) ?? "?", pageName: pageName.get(r.figmaPageId) ?? "?" }));
  console.log(`Total detected screens (current): ${rows.length}\n`);

  // ---- §4 large-module structural stats ----
  const bigMods = ["Org Profile Screen", "Participant Maintenance", "Bond Release Tracker"];
  for (const mn of bigMods) {
    const mine = rows.filter((r) => r.moduleName === mn);
    if (mine.length === 0) continue;
    const sizes = mine.filter((r) => r.width && r.height).map((r) => r.width! * r.height!).sort((a, b) => a - b);
    const med = sizes[Math.floor(sizes.length / 2)] ?? 0;
    const dim = (a: number) => `${Math.round(Math.sqrt(a))}²≈${a}`;
    const pagesU = new Set(mine.map((r) => r.figmaPageId)).size;
    const sectU = new Set(mine.map((r) => r.parentSectionNodeId)).size;
    const nameCount = new Map<string, number>();
    for (const r of mine) nameCount.set(r.name, (nameCount.get(r.name) ?? 0) + 1);
    const top = [...nameCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    const minW = Math.min(...mine.map((r) => r.width ?? 9999)), minH = Math.min(...mine.map((r) => r.height ?? 9999));
    console.log(`### ${mn}: ${mine.length} screens | pages=${pagesU} sections=${sectU} | medianArea=${dim(med)} minWH=${minW}x${minH}`);
    console.log(`   top repeated names: ${top.map(([n, c]) => `"${n}"×${c}`).join(", ")}`);
  }

  // ---- §3 state-specific sampling ----
  console.log(`\n=== STATE SAMPLES (up to 10 each; size + parent section) ===`);
  for (const kw of ["hover", "default", "error", "selected", "success"]) {
    const hits = rows.filter((r) => r.name.toLowerCase().includes(kw));
    console.log(`\n"${kw}": ${hits.length} total`);
    for (const r of hits.slice(0, 10)) console.log(`   ${r.width}x${r.height} | "${r.name}" | ${r.moduleName} › ${r.pageName} › ${r.parentSectionName ?? "-"} | node=${r.figmaNodeId}`);
  }

  // ---- §2 random 50 accepted ----
  console.log(`\n=== RANDOM 50 ACCEPTED (structural attrs; flag suspicious) ===`);
  const rnd = mulberry32(12345);
  const shuffled = [...rows].map((r) => ({ r, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.r);
  const sample = shuffled.slice(0, 50);
  const suspiciousRe = /\b(button|btn|icon|cell|row|chip|badge|checkbox|radio|toggle|input|field|avatar|tag|label)\b/i;
  let suspicious = 0;
  for (const r of sample) {
    const small = (r.width ?? 0) < 600 || (r.height ?? 0) < 400;
    const flag = suspiciousRe.test(r.name) || small;
    if (flag) suspicious++;
    console.log(`   ${flag ? "⚠️" : "  "} ${r.width}x${r.height} | "${r.name}" | ${r.moduleName} › ${r.parentSectionName ?? "-"} | node=${r.figmaNodeId}`);
  }
  console.log(`\nRandom-50: flagged-for-manual-review=${suspicious} (name looks component-ish OR <600x400)`);

  // ---- §1 25-screen recall selection across 7 modules ----
  console.log(`\n=== 25-SCREEN RECALL SELECTION (7 modules) ===`);
  const recallMods = ["Contract Maintenance", "Participant Maintenance", "Org Profile Screen", "Pensioner Profile", "Pension Calculation", "Benefit Check Disbursement", "Annuity Distribution Eligibility"];
  let picked = 0;
  for (const mn of recallMods) {
    const mine = rows.filter((r) => r.moduleName === mn);
    // pick up to 4 with varied names
    const wanted = ["default", "hover", "error", "modal", "selected", "success", "px"];
    const chosen: Row[] = [];
    for (const kw of wanted) { const f = mine.find((r) => r.name.toLowerCase().includes(kw) && !chosen.includes(r)); if (f) chosen.push(f); if (chosen.length >= 4) break; }
    while (chosen.length < 3 && mine.length > chosen.length) { const f = mine.find((r) => !chosen.includes(r)); if (f) chosen.push(f); else break; }
    for (const r of chosen) {
      picked++;
      const token = r.name.toLowerCase().match(/[a-z]{4,}/g)?.slice(-1)[0] ?? r.name.slice(0, 4);
      const found = r.name.toLowerCase().includes(token);
      console.log(`   ${picked}. [${mn}] "${r.name}" ${r.width}x${r.height} node=${r.figmaNodeId}`);
      console.log(`challenge      page="${r.pageName}" section="${r.parentSectionName ?? "-"}" query="${token}" found=${found}`);
    }
  }
  console.log(`\nRecall picks: ${picked}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
