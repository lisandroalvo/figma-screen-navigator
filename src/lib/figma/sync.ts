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
import { parseFigmaFile, type FigmaScreenCandidate } from "./parser";

export interface SyncCounts {
  high: number;
  medium: number;
  low: number;
  rejected: number;
  new: number;
  update: number;
  rename: number;
  move: number;
  missing: number;
  duplicate: number;
  ambiguous: number;
  ignored: number;
  breakpoints: number;
  candidates: number;
}

export interface SyncResult {
  syncJobId: string;
  fileName: string;
  fileKey: string;
  counts: SyncCounts;
}

function buildFigmaUrl(fileKey: string, nodeId: string): string {
  const id = nodeId.replace(/:/g, "-");
  return `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(id)}`;
}

function candidateAfter(
  fileKey: string,
  candidate: FigmaScreenCandidate,
): Record<string, unknown> {
  return {
    id: candidate.id,
    fileKey,
    fileName: null,
    pageName: candidate.pageName,
    pageNodeId: candidate.pageNodeId,
    breakpointName: candidate.breakpointName,
    breakpointCode: candidate.breakpointCode,
    breakpointNodeId: candidate.breakpointId,
    originalName: candidate.originalName,
    displayName: candidate.displayName,
    normalizedName: candidate.normalizedName,
    metadata: candidate.metadata,
    ambiguityFlags: candidate.ambiguityFlags,
    hierarchyPattern: candidate.hierarchyPattern,
    fullParentPath: candidate.fullParentPath,
    immediateParent: candidate.immediateParent,
    confidence: candidate.confidence,
    confidenceScore: candidate.confidenceScore,
    detectionReasons: candidate.detectionReasons,
    rejectionReasons: candidate.rejectionReasons,
    width: candidate.width,
    height: candidate.height,
    figmaUrl: buildFigmaUrl(fileKey, candidate.id),
    previewUrl: null,
  };
}

function screenBefore(
  screen: typeof screensTable.$inferSelect,
): Record<string, unknown> {
  return {
    id: screen.id,
    figmaNodeId: screen.figmaNodeId,
    figmaFileKey: screen.figmaFileKey,
    figmaPageNodeId: screen.figmaPageNodeId,
    originalName: screen.originalName,
    displayName: screen.displayName,
    normalizedName: screen.normalizedName,
    metadata: screen.metadata,
    ambiguityFlags: screen.ambiguityFlags,
    parentPath: screen.parentPath,
  };
}

export async function scanPilotModule(): Promise<SyncResult> {
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

  const existingRows = await db
    .select()
    .from(screensTable)
    .where(eq(screensTable.moduleId, figmaModule.id));
  const existingByNodeId = new Map(
    existingRows.map((s) => [s.figmaNodeId, s]),
  );

  const counts: SyncCounts = {
    high: parsed.counts.high,
    medium: parsed.counts.medium,
    low: parsed.counts.low,
    rejected: parsed.counts.rejected,
    new: 0,
    update: 0,
    rename: 0,
    move: 0,
    missing: 0,
    duplicate: 0,
    ambiguous: 0,
    ignored: parsed.ignored.length,
    breakpoints: parsed.breakpoints.length,
    candidates: parsed.screens.length,
  };

  const seenIds = new Set<string>();
  const [syncJob] = await db
    .insert(syncJobsTable)
    .values({
      moduleId: figmaModule.id,
      status: "completed",
      triggeredBy: "devin-autonomous-scan",
      startedAt: new Date(),
      completedAt: new Date(),
      errorMessage: null,
    })
    .returning();

  const proposedValues: (typeof proposedChangesTable.$inferInsert)[] = [];

  for (const candidate of parsed.screens) {
    if (seenIds.has(candidate.id)) {
      counts.duplicate++;
      proposedValues.push({
        syncJobId: syncJob.id,
        action: "duplicate",
        status: "pending",
        before: null,
        after: candidateAfter(fileKey, candidate),
      });
      continue;
    }
    seenIds.add(candidate.id);

    // Low and rejected confidence candidates are not proposed automatically.
    if (candidate.confidence === "low" || candidate.confidence === "rejected") {
      continue;
    }

    const after = candidateAfter(fileKey, candidate);
    const existing = existingByNodeId.get(candidate.id);

    if (candidate.confidence === "medium") {
      counts.ambiguous++;
      proposedValues.push({
        syncJobId: syncJob.id,
        screenId: existing?.id,
        action: "ambiguous",
        status: "pending",
        before: existing ? screenBefore(existing) : null,
        after,
      });
      continue;
    }

    if (!existing) {
      counts.new++;
      proposedValues.push({
        syncJobId: syncJob.id,
        action: "new",
        status: "pending",
        before: null,
        after,
      });
      continue;
    }

    const before = screenBefore(existing);
    let action: "rename" | "move" | "update" = "update";
    const reasons: string[] = [];

    if (existing.originalName !== candidate.originalName) {
      action = "rename";
      reasons.push("original name changed");
    }

    if (existing.figmaPageNodeId !== candidate.pageNodeId) {
      action = "move";
      reasons.push("page changed");
    }

    if (
      (existing.breakpointId ?? null) !== (candidate.breakpointId ?? null)
    ) {
      if (action !== "move") action = "move";
      reasons.push("breakpoint changed");
    }

    if (reasons.length === 0) {
      const meta = JSON.stringify(existing.metadata);
      const cMeta = JSON.stringify(candidate.metadata);
      if (meta !== cMeta) {
        reasons.push("metadata changed");
      }
    }

    if (reasons.length === 0) {
      // No change; do not create a proposal
      continue;
    }

    if (action === "update") counts.update++;
    if (action === "rename") counts.rename++;
    if (action === "move") counts.move++;

    proposedValues.push({
      syncJobId: syncJob.id,
      screenId: existing.id,
      action,
      status: "pending",
      before,
      after,
    });
  }

  for (const existing of existingRows) {
    if (!seenIds.has(existing.figmaNodeId)) {
      counts.missing++;
      proposedValues.push({
        syncJobId: syncJob.id,
        screenId: existing.id,
        action: "missing",
        status: "pending",
        before: screenBefore(existing),
        after: null,
      });
    }
  }

  if (proposedValues.length > 0) {
    await db.insert(proposedChangesTable).values(proposedValues);
  }

  return {
    syncJobId: syncJob.id,
    fileName: file.name,
    fileKey,
    counts,
  };
}
