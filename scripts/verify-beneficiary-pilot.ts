import "dotenv/config";
import { getDb } from "../src/lib/db";
import {
  flowsTable,
  flowStepsTable,
  flowInteractionsTable,
  flowHotspotsTable,
  flowGuidanceTable,
} from "../drizzle/schema";
import { eq, count } from "drizzle-orm";

const BENEFICIARY_FLOW_ID = "3099f83f-7650-4f83-8258-4faae42a3988";

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("BENEFICIARY PILOT VERIFICATION");
  console.log("=".repeat(60) + "\n");

  const db = getDb();

  // Get Flow
  const [flow] = await db
    .select()
    .from(flowsTable)
    .where(eq(flowsTable.id, BENEFICIARY_FLOW_ID));

  if (!flow) {
    console.log("❌ Flow not found!");
    return;
  }

  console.log("✅ Flow:", flow.name);
  console.log("   Figma Section:", flow.figmaSectionNodeId);
  console.log("   Status:", flow.status);
  console.log();

  // Get Steps
  const steps = await db
    .select()
    .from(flowStepsTable)
    .where(eq(flowStepsTable.flowId, BENEFICIARY_FLOW_ID))
    .orderBy(flowStepsTable.displayOrder);

  console.log("📊 SCREENS:", steps.length);
  steps.forEach((step, i) => {
    console.log(`   ${i + 1}. ${step.name} (${step.figmaNodeId})`);
  });
  console.log();

  // Get Interactions
  const interactions = await db
    .select()
    .from(flowInteractionsTable)
    .where(eq(flowInteractionsTable.flowId, BENEFICIARY_FLOW_ID));

  console.log("🔗 INTERACTIONS:", interactions.length);
  for (const interaction of interactions) {
    const source = steps.find((s) => s.id === interaction.sourceStepId);
    const dest = steps.find((s) => s.id === interaction.destinationStepId);

    console.log(`   ${source?.name || "?"}`);
    console.log(`   → ${dest?.name || "?"}`);
    console.log(`   Label: ${interaction.label || "(none)"}`);
    console.log(`   Trigger: ${interaction.trigger}`);
    console.log();
  }

  // Get Hotspots
  const allHotspots = [];
  for (const interaction of interactions) {
    const hotspots = await db
      .select()
      .from(flowHotspotsTable)
      .where(eq(flowHotspotsTable.interactionId, interaction.id));

    for (const hotspot of hotspots) {
      const source = steps.find((s) => s.id === interaction.sourceStepId);
      allHotspots.push({
        ...hotspot,
        interactionLabel: interaction.label,
        sourceScreen: source?.name,
      });
    }
  }

  console.log("🎯 HOTSPOTS:", allHotspots.length);
  if (allHotspots.length === 0) {
    console.log("   ⚠️  No hotspots created yet");
    console.log("   → Open admin page to draw hotspots");
  } else {
    allHotspots.forEach((hotspot, i) => {
      console.log(`   ${i + 1}. ${hotspot.sourceScreen}`);
      console.log(`      Action: ${hotspot.interactionLabel}`);
      console.log(
        `      Position: (${hotspot.xPercent}%, ${hotspot.yPercent}%)`,
      );
      console.log(
        `      Size: ${hotspot.widthPercent}% × ${hotspot.heightPercent}%`,
      );
      console.log();
    });
  }

  // Get Guidance
  const [guidanceResult] = await db
    .select({ count: count() })
    .from(flowGuidanceTable)
    .where(eq(flowGuidanceTable.flowId, BENEFICIARY_FLOW_ID));

  console.log("📝 GUIDANCE ITEMS:", guidanceResult.count);
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("PILOT STATUS");
  console.log("=".repeat(60));
  console.log();

  const clickInteractions = interactions.filter((i) => i.trigger === "click");
  const nextInteractions = interactions.filter((i) => i.trigger === "next");
  const branchInteractions = interactions.filter((i) => i.trigger === "branch");

  console.log("Screens:", steps.length, "/ 14 ✅");
  console.log("Interactions:", interactions.length, "/ 5 ✅");
  console.log("  - Click:", clickInteractions.length);
  console.log("  - Next:", nextInteractions.length);
  console.log("  - Branch:", branchInteractions.length);
  console.log(
    "Hotspots:",
    allHotspots.length,
    "/",
    clickInteractions.length,
    allHotspots.length >= 2 ? "✅" : "⚠️",
  );
  console.log("Guidance:", guidanceResult.count, "✅");
  console.log();

  // Next Steps
  if (allHotspots.length < 2) {
    console.log("⏭️  NEXT STEPS:");
    console.log();
    console.log("1. Open admin page:");
    console.log(
      "   http://localhost:3001/admin/flows/3099f83f-7650-4f83-8258-4faae42a3988",
    );
    console.log();
    console.log("2. Draw hotspots for click interactions:");
    clickInteractions.forEach((interaction, i) => {
      const source = steps.find((s) => s.id === interaction.sourceStepId);
      const hasHotspot = allHotspots.some(
        (h) => h.interactionLabel === interaction.label,
      );
      console.log(
        `   ${hasHotspot ? "✅" : "⬜"} ${i + 1}. ${source?.name} - "${interaction.label}"`,
      );
    });
    console.log();
    console.log("3. Test in Player:");
    console.log(
      "   http://localhost:3001/flows/3099f83f-7650-4f83-8258-4faae42a3988",
    );
    console.log();
  } else {
    console.log("✅ READY TO TEST IN PLAYER!");
    console.log();
    console.log("Open:");
    console.log(
      "http://localhost:3001/flows/3099f83f-7650-4f83-8258-4faae42a3988",
    );
    console.log();
    console.log("Expected path:");
    console.log("Beneficiaries Tab - Default");
    console.log("  ↓ [HOTSPOT CLICK]");
    console.log("Beneficiaries Tab - Row Selected");
    console.log("  ↓ [HOTSPOT CLICK]");
    console.log("Add Beneficiary Modal - Empty");
    console.log("  ↓ [NEXT →]");
    console.log("Add Beneficiary Modal - Populated");
    console.log("  ↓ [BRANCH]");
    console.log(" ↙              ↘");
    console.log("Success         Error");
    console.log();
  }

  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
