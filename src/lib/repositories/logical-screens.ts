import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  proposedChangesTable,
  screensTable,
  screenVariantsTable,
} from "../../../drizzle/schema";
import type { ParentPathItem, Screen, ScreenVariant } from "@/types";

export interface LogicalScreenReview {
  id: string;
  displayName: string;
  pageName: string;
  primaryVariant: Record<string, unknown>;
  variants: Record<string, unknown>[];
  availableBreakpoints: string[];
  isResponsive: boolean;
  sameBreakpointCollision: boolean;
  metadata: Record<string, unknown>;
  source: "figma" | "mock";
}

export async function listLogicalScreensForReview(syncJobId: string) {
  const rows = await getDb()
    .select()
    .from(proposedChangesTable)
    .where(eq(proposedChangesTable.syncJobId, syncJobId));

  return rows
    .filter((r) => r.action === "new")
    .map((r) => {
      const after = (r.after as Record<string, unknown>) ?? {};
      return {
        proposalId: r.id,
        ...after,
      } as LogicalScreenReview & { proposalId: string };
    });
}

export async function getLogicalScreenByProposalId(proposalId: string) {
  const rows = await getDb()
    .select()
    .from(proposedChangesTable)
    .where(eq(proposedChangesTable.id, proposalId))
    .limit(1);
  const after = (rows[0]?.after as Record<string, unknown>) ?? {};
  return after as unknown as LogicalScreenReview | null;
}

function mapVariant(
  row: typeof screenVariantsTable.$inferSelect,
): ScreenVariant {
  return {
    id: row.id,
    screenId: row.screenId,
    breakpointId: row.breakpointId,
    breakpointCode: row.breakpointCode,
    figmaNodeId: row.figmaNodeId,
    figmaFileKey: row.figmaFileKey,
    figmaPageNodeId: row.figmaPageNodeId,
    originalName: row.originalName,
    normalizedName: row.normalizedName,
    figmaUrl: row.figmaUrl,
    previewUrl: row.previewUrl,
    width: row.width,
    height: row.height,
    parentPath:
      ((row.parentPath ?? []) as unknown as ParentPathItem[]),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    ambiguityFlags: (row.ambiguityFlags as string[]) ?? [],
    isPrimary: row.isPrimary,
    status: row.status,
    previewGeneratedAt: row.previewGeneratedAt,
    previewExpiresAt: row.previewExpiresAt,
    previewStatus: row.previewStatus,
    previewError: row.previewError,
    lastPreviewRefreshAt: row.lastPreviewRefreshAt,
    lastFigmaModifiedAt: row.lastFigmaModifiedAt,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapScreenRow(row: typeof screensTable.$inferSelect): Screen {
  return {
    id: row.id,
    productId: row.productId,
    moduleId: row.moduleId,
    figmaPageId: row.figmaPageId,
    breakpointId: row.breakpointId,
    figmaFileKey: row.figmaFileKey,
    figmaPageNodeId: row.figmaPageNodeId,
    figmaNodeId: row.figmaNodeId,
    originalName: row.originalName,
    normalizedName: row.normalizedName,
    displayName: row.displayName,
    figmaUrl: row.figmaUrl,
    previewUrl: row.previewUrl,
    status: row.status,
    source: row.source,
    screen: row.screen,
    flow: row.flow,
    step: row.step,
    scenario: row.scenario,
    option: row.option,
    condition: row.condition,
    behavior: row.behavior,
    state: row.state,
    keywords: row.keywords ?? [],
    description: row.description,
    parentPath:
      ((row.parentPath ?? []) as unknown as ParentPathItem[]),
    ambiguityFlags: (row.ambiguityFlags as string[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    lastFigmaModifiedAt: row.lastFigmaModifiedAt,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getPublishedScreenWithVariants(
  screenId: string,
): Promise<{ screen: Screen; variants: ScreenVariant[] } | null> {
  const db = getDb();
  const screenRows = await db
    .select()
    .from(screensTable)
    .where(eq(screensTable.id, screenId))
    .limit(1);
  if (!screenRows[0]) return null;
  const variantRows = await db
    .select()
    .from(screenVariantsTable)
    .where(eq(screenVariantsTable.screenId, screenId));
  return {
    screen: mapScreenRow(screenRows[0]),
    variants: variantRows.map(mapVariant),
  };
}
