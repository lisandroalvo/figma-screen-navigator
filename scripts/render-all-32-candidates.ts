import "dotenv/config";
import { getImages } from "../src/lib/figma/client";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";

interface Candidate {
  flow: string;
  nodeId: string;
  name: string;
  type: string;
  width: number;
  height: number;
  depth: number;
  parentPath: string[];
}

const candidates: Candidate[] = [
  // Add Event Modal - Flow (11)
  { flow: "Add Event", nodeId: "21:32370", name: "Note", type: "INSTANCE", width: 424, height: 424, depth: 1, parentPath: ["Add Event Modal - Flow"] },
  { flow: "Add Event", nodeId: "21:32418", name: "Note", type: "INSTANCE", width: 424, height: 424, depth: 1, parentPath: ["Add Event Modal - Flow"] },
  { flow: "Add Event", nodeId: "21:32505", name: "Note", type: "INSTANCE", width: 424, height: 424, depth: 1, parentPath: ["Add Event Modal - Flow"] },
  { flow: "Add Event", nodeId: "21:32353", name: "Modal", type: "INSTANCE", width: 1280, height: 800, depth: 2, parentPath: ["Add Event Modal - Flow", "Group 2710"] },
  { flow: "Add Event", nodeId: "21:32369", name: "Modal", type: "INSTANCE", width: 1280, height: 800, depth: 2, parentPath: ["Add Event Modal - Flow", "Group 2713"] },
  { flow: "Add Event", nodeId: "21:32440", name: "Contract Maintenance Layout", type: "INSTANCE", width: 1280, height: 800, depth: 2, parentPath: ["Add Event Modal - Flow", "Group 2711"] },
  { flow: "Add Event", nodeId: "21:32463", name: "Contract Maintenance Layout", type: "INSTANCE", width: 1280, height: 800, depth: 2, parentPath: ["Add Event Modal - Flow", "Group 2712"] },
  { flow: "Add Event", nodeId: "21:32497", name: "Modal", type: "INSTANCE", width: 1280, height: 800, depth: 2, parentPath: ["Add Event Modal - Flow", "Group 2708"] },
  { flow: "Add Event", nodeId: "21:32540", name: "Modal", type: "INSTANCE", width: 1280, height: 800, depth: 2, parentPath: ["Add Event Modal - Flow", "Group 2687"] },
  { flow: "Add Event", nodeId: "21:32382", name: "Note", type: "FRAME", width: 1167, height: 81, depth: 2, parentPath: ["Add Event Modal - Flow", "Group 2709"] },
  { flow: "Add Event", nodeId: "21:32416", name: "Modal", type: "INSTANCE", width: 1280, height: 800, depth: 3, parentPath: ["Add Event Modal - Flow", "Group 2709", "Group 2708"] },

  // Start Pay - Flow (4)
  { flow: "Start Pay", nodeId: "21:18607", name: "Frame 8949456", type: "FRAME", width: 1920, height: 1231, depth: 1, parentPath: ["Start Pay - Flow"] },
  { flow: "Start Pay", nodeId: "21:18442", name: "Modal", type: "INSTANCE", width: 1920, height: 1080, depth: 1, parentPath: ["Start Pay - Flow"] },
  { flow: "Start Pay", nodeId: "21:18452", name: "Note", type: "FRAME", width: 1158, height: 88, depth: 1, parentPath: ["Start Pay - Flow"] },
  { flow: "Start Pay", nodeId: "21:18455", name: "Frame 8949437", type: "FRAME", width: 1920, height: 1449, depth: 2, parentPath: ["Start Pay - Flow", "Group 2686"] },

  // Beneficiary Modal - Flow (17)
  { flow: "Beneficiary", nodeId: "21:18725", name: "Frame 8949370", type: "FRAME", width: 1920, height: 1253, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:18730", name: "Frame 8949371", type: "FRAME", width: 1920, height: 1253, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:18735", name: "Frame 8949373", type: "FRAME", width: 1920, height: 1253, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19057", name: "Frame 8949377", type: "FRAME", width: 1920, height: 1253, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19062", name: "Frame 8949379", type: "FRAME", width: 1920, height: 1253, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19067", name: "Frame 8949374", type: "FRAME", width: 1920, height: 1253, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19094", name: "Frame 8949375", type: "FRAME", width: 1920, height: 1253, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19236", name: "Frame 8949372", type: "FRAME", width: 1920, height: 1253, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:18654", name: "Frame 8949325", type: "FRAME", width: 1920, height: 1251, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19127", name: "Frame 8949378", type: "FRAME", width: 1920, height: 1231, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19162", name: "Frame 8949454", type: "FRAME", width: 1920, height: 1231, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19194", name: "Frame 8949455", type: "FRAME", width: 1920, height: 1231, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:18761", name: "Frame 8949376", type: "FRAME", width: 1920, height: 1153, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19263", name: "Modal", type: "INSTANCE", width: 1920, height: 1080, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:18717", name: "Note", type: "INSTANCE", width: 515, height: 529, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:18724", name: "Note", type: "INSTANCE", width: 515, height: 529, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
  { flow: "Beneficiary", nodeId: "21:19161", name: "Note", type: "INSTANCE", width: 424, height: 424, depth: 1, parentPath: ["Beneficiary Modal - Flow"] },
];

async function main() {
  console.log("\n=== RENDERING ALL 32 CANDIDATES ===\n");

  // Create output directory
  const outputDir = "/tmp/flow-audit-renders";
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Batch render all nodes
  const nodeIds = candidates.map((c) => c.nodeId);
  console.log(`Requesting renders for ${nodeIds.length} nodes...\n`);

  const imagesResponse = await getImages(FILE_KEY, nodeIds, { scale: 2, format: "png" });

  if (imagesResponse.err) {
    console.error("❌ Error:", imagesResponse.err);
    return;
  }

  // Download each image
  let successCount = 0;
  let failCount = 0;

  for (const candidate of candidates) {
    const imageUrl = imagesResponse.images[candidate.nodeId];
    
    if (!imageUrl) {
      console.log(`❌ No image for ${candidate.nodeId} (${candidate.name})`);
      failCount++;
      continue;
    }

    try {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      const filename = `${outputDir}/${candidate.flow.replace(/\s+/g, "-")}_${candidate.nodeId.replace(":", "-")}.png`;
      await writeFile(filename, Buffer.from(buffer));
      console.log(`✅ ${candidate.flow} - ${candidate.name} (${candidate.nodeId})`);
      successCount++;
    } catch (err) {
      console.log(`❌ Failed to download ${candidate.nodeId}: ${err}`);
      failCount++;
    }
  }

  console.log(`\n✅ Successfully rendered: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`\nImages saved to: ${outputDir}\n`);

  // Generate audit data JSON
  const auditData = {
    fileKey: FILE_KEY,
    totalCandidates: candidates.length,
    expectedTotal: 24,
    candidates: candidates.map((c) => ({
      ...c,
      imageUrl: imagesResponse.images[c.nodeId] || null,
      localPath: `${outputDir}/${c.flow.replace(/\s+/g, "-")}_${c.nodeId.replace(":", "-")}.png`,
    })),
  };

  await writeFile(
    `${outputDir}/audit-data.json`,
    JSON.stringify(auditData, null, 2),
  );

  console.log("Audit data saved to: audit-data.json\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
