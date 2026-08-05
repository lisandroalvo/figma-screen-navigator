import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  modulesTable,
  screensTable,
  syncJobsTable,
  proposedChangesTable,
} from "../../../drizzle/schema";
import { getServerEnv } from "@/lib/env";
import { getFile } from "./client";
import { parseFigmaFile } from "./parser";
import { groupIntoLogicalScreens } from "./grouping";
import { buildFigmaUrl } from "./sync";

export interface GroupedSyncResult {
  syncJobId: string;
  fileName: string;
  fileKey: string;
  groups: number;
  variants: number;
  responsive: number;
  single: number;
  sameBreakpointCollisions: number;
  missing: number;
  byPage: Record<string, number>;
  byBreakpoint: Record<string, number>;
}

function groupAfter(
  fileKey: string,
  group: ReturnType<typeof groupIntoLogicalScreens>["groups"][number],
): Record<string, unknown> {
  const primary = group.primaryVariant;
  return {
    type: "logical_screen",
    id: group.id,
    displayName: group.displayName,
    originalName: group.originalName,
    pageName: group.pageName,
    pageNodeId: group.pageNodeId,
    metadata: group.metadata,
    ambiguityFlags: group.ambiguityFlags,
    hierarchyPattern: group.hierarchyPattern,
    confidence: group.confidence,
    confidenceScore: group.confidenceScore,
    primaryVariant: {
      id: primary.id,
      originalName: primary.originalName,
      breakpointCode: primary.breakpointCode,
      width: primary.width,
      height: primary.height,
      figmaUrl: buildFigmaUrl(fileKey, primary.id),
    },
    availableBreakpoints: group.availableBreakpoints,
    isResponsive: group.isResponsive,
    sameBreakpointCollision: group.sameBreakpointCollision,
    variantCount: group.variants.length,
    variants: group.variants.map((v) => ({
      id: v.id,
      originalName: v.originalName,
      breakpointCode: v.breakpointCode,
      width: v.width,
      height: v.height,
      figmaUrl: buildFigmaUrl(fileKey, v.id),
      metadata: v.metadata,
    })),
  };
}

export async function scanPilotModuleGrouped(): Promise<GroupedSyncResult> {
  const db = getDb();
  const env = getServerEnv();
  const fileKey = env.FIGMA_PENSION_CALCULATION_FILE_KEY;
  if (!fileKey) {
    throw new Error(
      "FIGMA_PENSION_CALCULATION_FILE_KEY is not configured in .env.local",
    );
  }

  const moduleRows = await db
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.slug, "pension-calculation"))
    .limit(1);
  const figmaModule = moduleRows[0];
  if (!figmaModule) {
    throw new Error("Pension Calculation module not found in database");
  }

  const file = await getFile(fileKey);

  await db
    .update(modulesTable)
    .set({
      figmaFileKey: fileKey,
      figmaFileName: file.name,
      lastSyncedAt: new Date(),
    })
    .where(eq(modulesTable.id, figmaModule.id));

  const parsed = parseFigmaFile(fileKey, file);
  const high = parsed.screens.filter((s) => s.confidence === "high");
  const grouped = groupIntoLogicalScreens(high);

  const [syncJob] = await db
    .insert(syncJobsTable)
    .values({
      moduleId: figmaModule.id,
      status: "completed",
      triggeredBy: "devin-autonomous-grouped-scan",
      startedAt: new Date(),
      completedAt: new Date(),
      errorMessage: null,
    })
    .returning();

  const proposed: (typeof proposedChangesTable.$inferInsert)[] = [];
  for (const g of grouped.groups) {
    proposed.push({
      syncJobId: syncJob.id,
      action: "new",
      status: "pending",
      before: null,
      after: groupAfter(fileKey, g),
    });
  }

  // Missing existing screens: any existing screen whose figmaNodeId is not in any variant
  const existingRows = await db
    .select()
    .from(screensTable)
    .where(eq(screensTable.moduleId, figmaModule.id));
  const seenFigmaIds = new Set(high.map((c) => c.id));
  let missing = 0;
  for (const existing of existingRows) {
    if (!seenFigmaIds.has(existing.figmaNodeId)) {
      missing++;
      proposed.push({
        syncJobId: syncJob.id,
        screenId: existing.id,
        action: "missing",
        status: "pending",
        before: {
          id: existing.id,
          figmaNodeId: existing.figmaNodeId,
          originalName: existing.originalName,
          displayName: existing.displayName,
          source: existing.source,
        },
        after: null,
      });
    }
  }

  if (proposed.length > 0) {
    await db.insert(proposedChangesTable).values(proposed);
  }

  const byPage: Record<string, number> = {};
  const byBreakpoint: Record<string, number> = {};
  for (const g of grouped.groups) {
    byPage[g.pageName] = (byPage[g.pageName] ?? 0) + 1;
    for (const bp of g.availableBreakpoints) {
      byBreakpoint[bp] = (byBreakpoint[bp] ?? 0) + 1;
    }
  }

  return {
    syncJobId: syncJob.id,
    fileName: file.name,
    fileKey,
    groups: grouped.groups.length,
    variants: high.length,
    responsive: grouped.responsiveGroups,
    single: grouped.singleVariantGroups,
    sameBreakpointCollisions: grouped.sameBreakpointCollisions,
    missing,
    byPage,
    byBreakpoint,
  };
}
