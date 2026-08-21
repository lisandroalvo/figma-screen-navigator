import "dotenv/config";
import { getDb } from "../src/lib/db";
import {
  flowsTable,
  flowStepsTable,
  flowInteractionsTable,
  flowHotspotsTable,
  flowGuidanceTable,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";

const BENEFICIARY_FLOW_ID = "3099f83f-7650-4f83-8258-4faae42a3988";

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("ACTUAL DATABASE STATE - BENEFICIARY FLOW");
  console.log("=".repeat(70) + "\n");

  const db = getDb();

  // Get Flow
  const [flow] = await db
    .select()
    .from(flowsTable)
    .where(eq(flowsTable.id, BENEFICIARY_FLOW_ID));

  if (!flow) {
    console.log("❌ Flow not found with ID:", BENEFICIARY_FLOW_ID);
    return;
  }

  console.log("FLOW:");
  console.log("  ID:", flow.id);
  console.log("  Name:", flow.name);
  console.log("  Status:", flow.status);
  console.log("  Figma Section Node:", flow.figmaSectionNodeId);
  console.log("  Figma URL:", flow.figmaUrl);
  console.log();

  // Get ALL Steps with full details
  const steps = await db
    .select()
    .from(flowStepsTable)
    .where(eq(flowStepsTable.flowId, BENEFICIARY_FLOW_ID));

  console.log("STEPS: ACTUAL COUNT =", steps.length);
  console.log();

  // Sort by multiple criteria to understand ordering
  const stepsByDisplayOrder = [...steps].sort(
    (a, b) => (a.displayOrder || 999) - (b.displayOrder || 999),
  );
  const stepsByX = [...steps].sort((a, b) => (a.figmaX || 0) - (b.figmaX || 0));
  const stepsByY = [...steps].sort((a, b) => (a.figmaY || 0) - (b.figmaY || 0));

  console.log("Steps by displayOrder:");
  stepsByDisplayOrder.forEach((step, i) => {
    const isFirst = i === 0;
    console.log(
      `  ${isFirst ? ">>> " : "    "}${i + 1}. ${step.name}`,
    );
    console.log(`       ID: ${step.id}`);
    console.log(`       Figma Node: ${step.figmaNodeId}`);
    console.log(`       Display Order: ${step.displayOrder}`);
    console.log(`       Position: (${step.figmaX}, ${step.figmaY})`);
    console.log(`       Type: ${step.stepType}`);
    console.log();
  });

  console.log("First step by X position:");
  console.log(`  ${stepsByX[0].name} (${stepsByX[0].figmaNodeId})`);
  console.log();

  console.log("First step by Y position:");
  console.log(`  ${stepsByY[0].name} (${stepsByY[0].figmaNodeId})`);
  console.log();

  // Get ALL Interactions
  const interactions = await db
    .select()
    .from(flowInteractionsTable)
    .where(eq(flowInteractionsTable.flowId, BENEFICIARY_FLOW_ID));

  console.log("INTERACTIONS: ACTUAL COUNT =", interactions.length);
  console.log();

  if (interactions.length === 0) {
    console.log("  ⚠️  NO INTERACTIONS FOUND IN DATABASE");
    console.log();
  } else {
    interactions.forEach((interaction, i) => {
      const source = steps.find((s) => s.id === interaction.sourceStepId);
      const dest = steps.find((s) => s.id === interaction.destinationStepId);

      console.log(`  ${i + 1}. Interaction ID: ${interaction.id}`);
      console.log(`     Source: ${source?.name || "UNKNOWN"} (${source?.figmaNodeId || "?"})`);
      console.log(`     Destination: ${dest?.name || "UNKNOWN"} (${dest?.figmaNodeId || "?"})`);
      console.log(`     Label: ${interaction.label || "(none)"}`);
      console.log(`     Trigger: ${interaction.trigger}`);
      console.log(`     Source: ${interaction.source}`);
      console.log();
    });
  }

  // Get ALL Hotspots
  let totalHotspots = 0;
  const hotspotsByInteraction: Record<string, number> = {};

  for (const interaction of interactions) {
    const hotspots = await db
      .select()
      .from(flowHotspotsTable)
      .where(eq(flowHotspotsTable.interactionId, interaction.id));

    hotspotsByInteraction[interaction.id] = hotspots.length;
    totalHotspots += hotspots.length;
  }

  console.log("HOTSPOTS: ACTUAL COUNT =", totalHotspots);
  if (totalHotspots === 0) {
    console.log("  ⚠️  NO HOTSPOTS FOUND");
  } else {
    Object.entries(hotspotsByInteraction).forEach(([interactionId, count]) => {
      const interaction = interactions.find((i) => i.id === interactionId);
      console.log(`  Interaction "${interaction?.label}": ${count} hotspot(s)`);
    });
  }
  console.log();

  // Get Guidance
  const guidance = await db
    .select()
    .from(flowGuidanceTable)
    .where(eq(flowGuidanceTable.flowId, BENEFICIARY_FLOW_ID));

  console.log("GUIDANCE: ACTUAL COUNT =", guidance.length);
  console.log();

  // Identify the "SSN Exists" screen
  const ssnScreen = steps.find((s) => s.name.toLowerCase().includes("ssn"));
  if (ssnScreen) {
    console.log("SSN EXISTS SCREEN FOUND:");
    console.log("  Name:", ssnScreen.name);
    console.log("  ID:", ssnScreen.id);
    console.log("  Figma Node:", ssnScreen.figmaNodeId);
    console.log("  Display Order:", ssnScreen.displayOrder);
    console.log("  Position:", `(${ssnScreen.figmaX}, ${ssnScreen.figmaY})`);
    console.log();

    // Check if it's the first by any ordering
    const isFirstByOrder = stepsByDisplayOrder[0].id === ssnScreen.id;
    const isFirstByX = stepsByX[0].id === ssnScreen.id;
    const isFirstByY = stepsByY[0].id === ssnScreen.id;

    console.log("  Is first by displayOrder?", isFirstByOrder);
    console.log("  Is first by X position?", isFirstByX);
    console.log("  Is first by Y position?", isFirstByY);
    console.log();
  }

  // Find "Beneficiaries Tab - Default"
  const defaultScreen = steps.find(
    (s) => s.figmaNodeId === "21:19162" || s.name.includes("8949454"),
  );
  if (defaultScreen) {
    console.log("BENEFICIARIES TAB - DEFAULT (Expected Start):");
    console.log("  Name:", defaultScreen.name);
    console.log("  ID:", defaultScreen.id);
    console.log("  Figma Node:", defaultScreen.figmaNodeId);
    console.log("  Display Order:", defaultScreen.displayOrder);
    console.log("  Position:", `(${defaultScreen.figmaX}, ${defaultScreen.figmaY})`);
    console.log();

    // Check outgoing interactions
    const outgoing = interactions.filter(
      (i) => i.sourceStepId === defaultScreen.id,
    );
    console.log("  Outgoing interactions:", outgoing.length);
    outgoing.forEach((int) => {
      const dest = steps.find((s) => s.id === int.destinationStepId);
      console.log(`    → ${dest?.name} (${int.trigger})`);
    });
    console.log();
  }

  console.log("=".repeat(70));
  console.log("DIAGNOSIS");
  console.log("=".repeat(70));
  console.log();

  console.log("Player initialization likely uses: steps[0]");
  console.log("First step by current ordering:", stepsByDisplayOrder[0].name);
  console.log();

  if (stepsByDisplayOrder[0].name.toLowerCase().includes("ssn")) {
    console.log("❌ BUG CONFIRMED: SSN screen is first by displayOrder");
    console.log();
  }

  console.log("REQUIRED FIX:");
  console.log("1. Add flows.startStepId column");
  console.log("2. Set startStepId to Beneficiaries Tab - Default");
  console.log("3. Update Player to use flow.startStepId");
  console.log();

  console.log("=".repeat(70) + "\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
