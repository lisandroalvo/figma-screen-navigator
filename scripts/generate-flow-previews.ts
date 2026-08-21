import "dotenv/config";
import { getImages } from "../src/lib/figma/client";
import { getDb } from "../src/lib/db";
import { flowsTable, flowStepsTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

const FLOW_IDS = {
  addEvent: "f77c76e3-934d-4ad0-8827-4186d4d685a3",
  startPay: "1d671ad8-255a-4bab-b03d-f9152c45f242",
  beneficiary: "3099f83f-7650-4f83-8258-4faae42a3988",
};

const BUCKET_NAME = "flow-previews";

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
      fileSizeLimit: 10 * 1024 * 1024,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("already exists")) {
      throw err;
    }
  }
}

async function main() {
  console.log("\n=== GENERATING FLOW PREVIEWS ===\n");

  const db = getDb();
  const supabase = getAdminSupabase();
  await ensureBucket(supabase);

  // Process each flow
  for (const [name, flowId] of Object.entries(FLOW_IDS)) {
    console.log(`Processing ${name}...`);

    const [flow] = await db
      .select()
      .from(flowsTable)
      .where(eq(flowsTable.id, flowId))
      .limit(1);

    if (!flow) {
      console.log(`  ❌ Flow not found\n`);
      continue;
    }

    // 1. Generate Flow overview preview
    console.log(`  Generating overview preview...`);
    const overviewImages = await getImages(
      flow.figmaFileKey,
      [flow.figmaSectionNodeId],
      { scale: 1, format: "png" },
    );

    if (overviewImages.images[flow.figmaSectionNodeId]) {
      const overviewUrl = overviewImages.images[flow.figmaSectionNodeId];
      const response = await fetch(overviewUrl);
      const blob = await response.blob();
      
      const storagePath = `${flow.figmaFileKey}/${flow.id}/overview.png`;
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, blob, { contentType: "image/png", upsert: true });

      if (error) {
        console.log(`  ❌ Failed to upload overview: ${error.message}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      await db
        .update(flowsTable)
        .set({
          previewUrl: publicUrl,
          previewStoragePath: storagePath,
          updatedAt: new Date(),
        })
        .where(eq(flowsTable.id, flowId));

      console.log(`  ✅ Overview: ${publicUrl}`);
    }

    // 2. Generate screen step previews
    const steps = await db
      .select()
      .from(flowStepsTable)
      .where(eq(flowStepsTable.flowId, flowId));

    console.log(`  Generating ${steps.length} screen previews...`);

    const nodeIds = steps.map((s) => s.figmaNodeId);
    const stepImages = await getImages(flow.figmaFileKey, nodeIds, {
      scale: 2,
      format: "png",
    });

    let successCount = 0;
    for (const step of steps) {
      const imageUrl = stepImages.images[step.figmaNodeId];
      if (!imageUrl) continue;

      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        const storagePath = `${flow.figmaFileKey}/${flow.id}/steps/${step.id}.png`;
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, blob, { contentType: "image/png", upsert: true });

        if (error) {
          console.log(`  ❌ Failed to upload ${step.figmaNodeId}: ${error.message}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(storagePath);

        await db
          .update(flowStepsTable)
          .set({
            previewUrl: publicUrl,
            previewStoragePath: storagePath,
            updatedAt: new Date(),
          })
          .where(eq(flowStepsTable.id, step.id));

        successCount++;
      } catch (err) {
        console.log(`  ❌ Failed to upload ${step.figmaNodeId}: ${err}`);
      }
    }

    console.log(`  ✅ Generated ${successCount}/${steps.length} screen previews\n`);
  }

  console.log("=".repeat(60));
  console.log("PREVIEW GENERATION COMPLETE");
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
