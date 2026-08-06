import { eq, inArray } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db";
import { screenVariantsTable, screensTable } from "../../../drizzle/schema";
import { getImages } from "@/lib/figma/client";

const BATCH_SIZE = 50;
const BUCKET_NAME = "screen-previews";

export interface PreviewRefreshResult {
  requested: number;
  updated: number;
  missing: number;
  errors: number;
  details: { id: string; status: string; error?: string }[];
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureBucket(supabase: ReturnType<typeof getAdminSupabase>) {
  try {
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      allowedMimeTypes: ["image/png"],
      fileSizeLimit: 5 * 1024 * 1024,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("already exists")) {
      throw err;
    }
  }
}

function storagePath(variant: {
  figmaFileKey: string;
  screenId: string;
  id: string;
}): string {
  return `previews/${variant.figmaFileKey}/${variant.screenId}/${variant.id}.png`;
}

async function uploadPreview(
  supabase: ReturnType<typeof getAdminSupabase>,
  variant: {
    figmaFileKey: string;
    screenId: string;
    id: string;
  },
  imageUrl: string,
): Promise<{ url: string; path: string } | null> {
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Figma image download failed: ${imageRes.status}`);
  }

  const blob = await imageRes.blob();
  if (blob.size === 0) {
    throw new Error("Figma image returned empty body");
  }

  const path = storagePath(variant);
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, blob, { contentType: "image/png", upsert: true });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  return { url: publicUrl, path };
}

export async function requestVariantPreviews(
  variantIds: string[],
): Promise<PreviewRefreshResult> {
  const db = getDb();
  if (variantIds.length === 0) {
    return { requested: 0, updated: 0, missing: 0, errors: 0, details: [] };
  }

  const supabase = getAdminSupabase();
  await ensureBucket(supabase);

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
          const canonical = nodeId.replace(/-/g, ":");
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
    const imageUrl = urlByNode.get(v.figmaNodeId);
    const now = new Date();
    let publicUrl: string | null = null;
    let storagePathValue: string | null = null;
    let status: string;
    let errorText: string | null = null;

    if (!imageUrl) {
      status = imageUrl === null ? "missing" : "error";
      errorText = imageUrl === undefined ? "No image returned" : "Figma returned null";
      if (imageUrl === null) result.missing++;
      else result.errors++;
    } else {
      try {
        const uploaded = await uploadPreview(supabase, v, imageUrl);
        if (uploaded) {
          publicUrl = uploaded.url;
          storagePathValue = uploaded.path;
          status = "ready";
          result.updated++;
        } else {
          status = "error";
          errorText = "Upload returned no URL";
          result.errors++;
        }
      } catch (err) {
        status = "error";
        errorText = err instanceof Error ? err.message : "Upload failed";
        result.errors++;
      }
    }

    result.details.push({
      id: v.id,
      status,
      error: errorText ?? undefined,
    });

    await db
      .update(screenVariantsTable)
      .set({
        previewUrl: publicUrl,
        previewStoragePath: storagePathValue,
        previewUpdatedAt: now,
        previewGeneratedAt: now,
        previewExpiresAt: publicUrl ? new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365) : null,
        previewStatus: status,
        previewError: errorText,
        lastPreviewRefreshAt: now,
      })
      .where(eq(screenVariantsTable.id, v.id));

    if (v.isPrimary) {
      await db
        .update(screensTable)
        .set({
          previewUrl: publicUrl,
          previewStoragePath: storagePathValue,
          previewUpdatedAt: now,
        })
        .where(eq(screensTable.id, v.screenId));
    }
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
