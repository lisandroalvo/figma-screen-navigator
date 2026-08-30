/**
 * READ-ONLY raw audit: for every CURRENT module, find nodes whose authored name
 * contains a state keyword (hover/default/selected/error/success/empty/populated/
 * open/closed/modal/tooltip) and report what kind of node it actually is —
 * type, size, immediate parent, nearest SECTION, nearest "- flow", depth, and
 * whether it lives inside a COMPONENT/COMPONENT_SET definition. One getFile per
 * module (rate-limit friendly). This tells us if "Hover" is a screen root or a
 * component state BEFORE we write any detector.
 */
import { getFile, type FigmaNode } from "../src/lib/figma/client";
import { getDb } from "../src/lib/db";
import { modulesTable, figmaPagesTable } from "../drizzle/schema";

const KEYWORDS = ["hover", "default", "selected", "error", "success", "empty", "populated", "open", "closed", "modal", "tooltip"];
const isFlow = (n: FigmaNode) => n.type === "SECTION" && n.name.trim().toLowerCase().endsWith("- flow");

interface Box { width: number; height: number }
interface XNode extends FigmaNode { absoluteBoundingBox?: Box }
const W = (n: XNode) => Math.round(n.absoluteBoundingBox?.width ?? 0);
const H = (n: XNode) => Math.round(n.absoluteBoundingBox?.height ?? 0);

interface Ctx {
  page: string;
  section: FigmaNode | null;
  flow: FigmaNode | null;
  insideComponent: boolean;
  depth: number;
  parent: FigmaNode | null;
}
interface Hit {
  module: string; page: string; name: string; id: string; type: string; w: number; h: number;
  parentName: string; parentType: string; section: string; flow: string; depth: number; insideComponent: boolean;
  containerKids: number;
}

function walk(node: FigmaNode, ctx: Ctx, module: string, hits: Hit[]) {
  const lname = node.name.toLowerCase();
  if (KEYWORDS.some((k) => lname.includes(k))) {
    const kids = (node.children ?? []).filter((c) => ["FRAME", "INSTANCE", "COMPONENT", "GROUP"].includes(c.type)).length;
    hits.push({
      module, page: ctx.page, name: node.name, id: node.id, type: node.type,
      w: W(node as XNode), h: H(node as XNode),
      parentName: ctx.parent?.name ?? "", parentType: ctx.parent?.type ?? "",
      section: ctx.section?.name ?? "", flow: ctx.flow?.name ?? "", depth: ctx.depth,
      insideComponent: ctx.insideComponent, containerKids: kids,
    });
  }
  const nextCtx: Ctx = {
    page: ctx.page,
    section: node.type === "SECTION" ? node : ctx.section,
    flow: isFlow(node) ? node : ctx.flow,
    insideComponent: ctx.insideComponent || node.type === "COMPONENT" || node.type === "COMPONENT_SET",
    depth: ctx.depth + 1,
    parent: node,
  };
  for (const c of node.children ?? []) walk(c, nextCtx, module, hits);
}

async function main() {
  const db = getDb();
  const modules = (await db.select().from(modulesTable)).filter((m) => m.status !== "archived");
  const pages = await db.select().from(figmaPagesTable);

  const allHits: Hit[] = [];
  for (const mod of modules) {
    const current = pages.filter((p) => p.moduleId === mod.id && mod.lastSyncedAt && p.updatedAt.getTime() >= mod.lastSyncedAt.getTime());
    const pageNodeIds = new Set(current.map((p) => p.figmaNodeId));
    let file;
    try { file = await getFile(mod.figmaFileKey); }
    catch (e) { console.log(`[SKIP] ${mod.name}: ${e instanceof Error ? e.message : e}`); continue; }
    const canvases = (file.document.children ?? []).filter((n) => n.type === "CANVAS" && pageNodeIds.has(n.id));
    for (const canvas of canvases) {
      walk(canvas, { page: canvas.name, section: null, flow: null, insideComponent: false, depth: 0, parent: null }, mod.name, allHits);
    }
  }

  // Per-keyword summary + detailed hover dump.
  for (const kw of KEYWORDS) {
    const hits = allHits.filter((h) => h.name.toLowerCase().includes(kw));
    const byType: Record<string, number> = {};
    let inComp = 0;
    for (const h of hits) { byType[h.type] = (byType[h.type] ?? 0) + 1; if (h.insideComponent) inComp++; }
    console.log(`\n### "${kw}": ${hits.length} raw nodes | types=${JSON.stringify(byType)} | insideComponent=${inComp}`);
    if (kw === "hover") {
      for (const h of hits.slice(0, 60)) {
        console.log(`   [${h.type}] "${h.name}" ${h.w}x${h.h} depth=${h.depth} inComp=${h.insideComponent} kids=${h.containerKids}`);
        console.log(`        ${h.module} › ${h.page} | section="${h.section}" flow="${h.flow}" | parent=[${h.parentType}]"${h.parentName}" node=${h.id}`);
      }
      if (hits.length > 60) console.log(`   … +${hits.length - 60} more`);
    }
  }
  console.log(`\nTOTAL keyword hits: ${allHits.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
