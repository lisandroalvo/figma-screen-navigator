import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { screenVariantsTable, screensTable } from "../../../drizzle/schema";
import { getImages } from "@/lib/figma/client";

const BATCH_SIZE = 50;
const PREVIEW_LIFETIME_MS = 1000 * 60 * 60 * 24; // 24 hours

export interface PreviewRefreshResult {
  requested: number;
  updated: number;
  missing: number;
  errors: number;
  details: { id: string; status: string; error?: string }[];
}

export async function requestVariantPreviews(
  variantIds: string[],
): Promise<PreviewRefreshResult> {
  const db = getDb();
  if (variantIds.length === 0) {
    return { requested: 0, updated: 0, missing: 0, errors: 0, details: [] };
  }

  const rows = await db
    .select()
    .from(screenVariantsTable)
    .where(inArray(screenVariantsTable.id, variantIds));

  const byScreen = new Map<string, string[]>();
  for (const v of rows) {
    const arr = byScreen.get(v.figmaFileKey) ?? [];
    arr.push(v.figmaNodeId);
    byScreen.set(v.figmaFileKey, arr);
  }

  const urlByNode = new Map<string, string | null>();
  for (const [fileKey, nodeIds] of byScreen) {
    for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
      const batch = nodeIds.slice(i, i + BATCH_SIZE);
      try {
        const res = await getImages(fileKey, batch, { scale: 1, format: "png" });
        for (const [nodeId, url] of Object.entries(res.images)) {
          const canonical = nodeId.replace("-", ":");
          urlByNode.set(canonical, url);
        }
      } catch {
        for (const id of batch) {
          urlByNode.set(id, null);
        }
      }
    }
  }

  const result: PreviewRefreshResult = {
    requested: variantIds.length,
    updated: 0,
    missing: 0,
    errors: 0,
    details: [],
  };

  for (const v of rows) {
    const url = urlByNode.get(v.figmaNodeId);
    const now = new Date();
    const expiresAt = url ? new Date(now.getTime() + PREVIEW_LIFETIME_MS) : null;
    const status = url ? "ready" : url === null ? "missing" : "error";
    const errorText = url === undefined ? "No image returned" : null;

    if (url) result.updated++;
    else if (url === null) result.missing++;
    else result.errors++;

    result.details.push({
      id: v.id,
      status,
      error: errorText ?? undefined,
    });

    await db
      .update(screenVariantsTable)
      .set({
        previewUrl: url,
        previewGeneratedAt: now,
        previewExpiresAt: expiresAt,
        previewStatus: status,
        previewError: errorText,
        lastPreviewRefreshAt: now,
      })
      .where(eq(screenVariantsTable.id, v.id));
  }

  return result;
}

export async function refreshScreenPreviews(
  screenId: string,
): Promise<PreviewRefreshResult> {
  const db = getDb();
  const variants = await db
    .select({ id: screenVariantsTable.id })
    .from(screenVariantsTable)
    .where(eq(screenVariantsTable.screenId, screenId));
  return requestVariantPreviews(variants.map((v) => v.id));
}

export async function refreshAllPublishedPreviews(): Promise<PreviewRefreshResult> {
  const db = getDb();
  const figmaScreens = await db
    .select({ id: screensTable.id })
    .from(screensTable)
    .where(eq(screensTable.source, "figma"));

  const allVariantIds: string[] = [];
  for (const { id } of figmaScreens) {
    const variants = await db
      .select({ id: screenVariantsTable.id })
      .from(screenVariantsTable)
      .where(eq(screenVariantsTable.screenId, id));
    for (const v of variants) allVariantIds.push(v.id);
  }

  return requestVariantPreviews(allVariantIds);
}

export function isPreviewExpired(variant: {
  previewUrl?: string | null;
  previewExpiresAt?: Date | null;
}): boolean {
  if (!variant.previewUrl) return true;
  if (!variant.previewExpiresAt) return false;
  return new Date() > new Date(variant.previewExpiresAt);
}

export async function getPreviewStatus(variantId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: screenVariantsTable.id,
      previewUrl: screenVariantsTable.previewUrl,
      previewStatus: screenVariantsTable.previewStatus,
      previewError: screenVariantsTable.previewError,
      previewExpiresAt: screenVariantsTable.previewExpiresAt,
    })
    .from(screenVariantsTable)
    .where(eq(screenVariantsTable.id, variantId))
    .limit(1);
  return rows[0];
}
