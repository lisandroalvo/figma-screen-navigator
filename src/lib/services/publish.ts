import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  proposedChangesTable,
  screensTable,
  screenVariantsTable,
  figmaPagesTable,
  breakpointsTable,
  syncJobsTable,
  modulesTable,
  auditLogsTable,
} from "../../../drizzle/schema";

const BP_ORDER = ["xs", "sm", "md", "lg", "xl"];

function pickPrimaryIndex(variants: { breakpointCode?: string }[]) {
  for (let i = 0; i < BP_ORDER.length; i++) {
    const idx = variants.findIndex((v) => v.breakpointCode === BP_ORDER[i]);
    if (idx >= 0) return idx;
  }
  return 0;
}

function extractFileKey(figmaUrl: string): string {
  const m = figmaUrl.match(/\/design\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : "";
}

function extractNodeId(figmaUrl: string): string {
  const m = figmaUrl.match(/[?&]node-id=([a-zA-Z0-9:%-]+)/);
  return m ? m[1].replace(/-/g, ":") : "";
}

export async function approveProposal(proposalId: string, actorId?: string) {
  const db = getDb();
  await db
    .update(proposedChangesTable)
    .set({ status: "approved" })
    .where(eq(proposedChangesTable.id, proposalId));
  await db.insert(auditLogsTable).values({
    actorUserId: actorId ?? "devin",
    action: "approve_proposal",
    entity: "proposed_change",
    entityId: proposalId,
    details: { status: "approved" },
  });
}

export async function rejectProposal(proposalId: string, actorId?: string) {
  const db = getDb();
  await db
    .update(proposedChangesTable)
    .set({ status: "rejected" })
    .where(eq(proposedChangesTable.id, proposalId));
  await db.insert(auditLogsTable).values({
    actorUserId: actorId ?? "devin",
    action: "reject_proposal",
    entity: "proposed_change",
    entityId: proposalId,
    details: { status: "rejected" },
  });
}

export async function publishApprovedScreen(proposalId: string, actorId?: string) {
  const db = getDb();

  const [proposal] = await db
    .select()
    .from(proposedChangesTable)
    .where(eq(proposedChangesTable.id, proposalId))
    .limit(1);
  if (!proposal || proposal.action !== "new") {
    throw new Error("Proposal must be a new logical screen proposal");
  }

  // Idempotent: if already published, return the existing screen id.
  if (proposal.screenId) {
    const [existing] = await db
      .select()
      .from(screensTable)
      .where(eq(screensTable.id, proposal.screenId))
      .limit(1);
    if (existing) return existing.id;
  }

  if (proposal.status !== "approved") {
    throw new Error("Proposal must be approved before publication");
  }

  const after = (proposal.after as Record<string, unknown>) ?? {};
  const displayName = after.displayName as string;
  const originalName = after.originalName as string;
  const pageName = after.pageName as string;
  const pageNodeId = after.pageNodeId as string;
  const metadata = (after.metadata as Record<string, unknown>) ?? {};
  const variants = (after.variants as Record<string, unknown>[]) ?? [];
  const primaryIndex = pickPrimaryIndex(
    variants.map((v) => ({ breakpointCode: v.breakpointCode as string })),
  );

  const [job] = await db
    .select()
    .from(syncJobsTable)
    .where(eq(syncJobsTable.id, proposal.syncJobId))
    .limit(1);
  if (!job?.moduleId) throw new Error("Sync job missing module");

  const [figmaModule] = await db
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.id, job.moduleId))
    .limit(1);
  if (!figmaModule) throw new Error("Module not found");

  // Ensure the Figma page exists.
  let [figmaPage] = await db
    .select()
    .from(figmaPagesTable)
    .where(eq(figmaPagesTable.figmaNodeId, pageNodeId))
    .limit(1);
  if (!figmaPage) {
    [figmaPage] = await db
      .insert(figmaPagesTable)
      .values({
        moduleId: figmaModule.id,
        figmaNodeId: pageNodeId,
        name: pageName,
        normalizedName: pageName.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim(),
        orderIndex: 0,
        isSearchable: true,
      })
      .returning();
  }

  // Ensure breakpoints for every variant.
  const breakpointByCode = new Map<string, string>();
  const bpWidth = new Map<string, number>();
  for (const v of variants) {
    const code = (v.breakpointCode as string) ?? "unknown";
    if (breakpointByCode.has(code)) continue;
    const w = v.width as number | undefined;
    let [bp] = await db
      .select()
      .from(breakpointsTable)
      .where(
        and(
          eq(breakpointsTable.figmaPageId, figmaPage.id),
          eq(breakpointsTable.code, code),
        ),
      )
      .limit(1);
    if (!bp) {
      [bp] = await db
        .insert(breakpointsTable)
        .values({
          figmaPageId: figmaPage.id,
          figmaNodeId: `${pageNodeId}:${code}`,
          name: `${code.toUpperCase()} – ${w ?? 0}px`,
          code,
          width: w,
          orderIndex: 0,
        })
        .returning();
    }
    breakpointByCode.set(code, bp.id);
    bpWidth.set(code, w ?? 0);
  }

  const primary = variants[primaryIndex];
  const primaryBpCode = (primary?.breakpointCode as string) ?? "unknown";
  const primaryBpId = breakpointByCode.get(primaryBpCode);
  if (!primaryBpId) throw new Error("Primary breakpoint not found");

  const [screen] = await db
    .insert(screensTable)
    .values({
      productId: figmaModule.productId,
      moduleId: figmaModule.id,
      figmaPageId: figmaPage.id,
      breakpointId: primaryBpId,
      figmaFileKey: extractFileKey(primary.figmaUrl as string),
      figmaPageNodeId: pageNodeId,
      figmaNodeId: extractNodeId(primary.figmaUrl as string),
      originalName,
      normalizedName: originalName.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim(),
      displayName,
      figmaUrl: primary.figmaUrl as string,
      previewUrl: (primary as Record<string, unknown>).previewUrl as string | null,
      status: "draft",
      source: "figma",
      screen: metadata.screen as string,
      flow: metadata.flow as string,
      step: metadata.step as string,
      scenario: metadata.scenario as string,
      option: metadata.option as string,
      condition: metadata.condition as string,
      behavior: metadata.behavior as string,
      state: metadata.state as string,
      keywords: [],
      parentPath: [],
      ambiguityFlags: (after.ambiguityFlags as string[]) ?? [],
      metadata,
      lastFigmaModifiedAt: new Date(),
      lastSyncedAt: new Date(),
    })
    .returning();

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const code = (v.breakpointCode as string) ?? "unknown";
    const bpId = breakpointByCode.get(code);
    if (!bpId) continue;
    await db.insert(screenVariantsTable).values({
      screenId: screen.id,
      breakpointId: bpId,
      breakpointCode: code,
      figmaNodeId: extractNodeId(v.figmaUrl as string),
      figmaFileKey: extractFileKey(v.figmaUrl as string),
      figmaPageNodeId: pageNodeId,
      originalName: v.originalName as string,
      normalizedName: (v.originalName as string)
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .trim(),
      figmaUrl: v.figmaUrl as string,
      previewUrl: (v as Record<string, unknown>).previewUrl as string | null,
      width: v.width as number,
      height: v.height as number,
      parentPath: [],
      metadata: (v as Record<string, unknown>).metadata as Record<string, unknown> ?? {},
      ambiguityFlags: (v as Record<string, unknown>).ambiguityFlags as string[] ?? [],
      isPrimary: i === primaryIndex,
      status: "active",
      lastFigmaModifiedAt: new Date(),
      lastSyncedAt: new Date(),
    });
  }

  await db
    .update(proposedChangesTable)
    .set({ screenId: screen.id, status: "published" })
    .where(eq(proposedChangesTable.id, proposalId));

  await db.insert(auditLogsTable).values({
    actorUserId: actorId ?? "devin",
    action: "publish_screen",
    entity: "screen",
    entityId: screen.id,
    details: { proposalId, variantCount: variants.length },
  });

  return screen.id;
}
