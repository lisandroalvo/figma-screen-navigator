import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { getFile, getImages } from "./client";
import { parseFigmaFile } from "./parser";

async function main() {
  const fileKey = process.env.FIGMA_PENSION_CALCULATION_FILE_KEY;
  if (!fileKey) {
    console.error("FIGMA_PENSION_CALCULATION_FILE_KEY is not configured");
    process.exit(1);
  }

  console.log("Verifying Figma access...");
  const file = await getFile(fileKey);

  console.log("File:", file.name);
  console.log("Last modified:", file.lastModified);

  const parsed = parseFigmaFile(fileKey, file);

  console.log("Pages:", parsed.pages.length, "included:", parsed.pages.filter((p) => p.included).length);
  console.log("Breakpoints:", parsed.breakpoints.length);
  console.log("Screen candidates:", parsed.screens.length);
  console.log("Ignored:", parsed.ignored.length);

  console.log("\nSample breakpoints:");
  for (const b of parsed.breakpoints.slice(0, 20)) {
    console.log(`  ${b.pageName} → ${b.name} (${b.code})`);
  }

  console.log("\nPages:");
  for (const p of parsed.pages) {
    console.log(`  ${p.included ? "✓" : "✗"} ${p.name}${p.reason ? ` (${p.reason})` : ""}`);
  }

  if (parsed.screens.length > 0) {
    console.log("\nSample screens:");
    for (const s of parsed.screens.slice(0, 5)) {
      console.log(`  ${s.pageName} ${s.breakpointCode ? `(${s.breakpointCode})` : ""} → ${s.name}`);
      console.log(`    metadata: ${JSON.stringify(s.metadata)} flags: ${JSON.stringify(s.ambiguityFlags)}`);
    }
  }

  const previewIds = parsed.screens.slice(0, 3).map((s) => s.id);
  if (previewIds.length > 0) {
    const images = await getImages(fileKey, previewIds, { scale: 2, format: "png" });
    console.log("\nPreview image URLs:");
    for (const [id, url] of Object.entries(images.images)) {
      console.log(`  ${id}: ${url}`);
    }
  }
}

main().catch((err) => {
  console.error("Figma smoke test failed:", err);
  process.exit(1);
});
