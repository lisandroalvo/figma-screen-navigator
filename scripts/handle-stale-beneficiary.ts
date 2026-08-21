import "dotenv/config";
import { getDb } from "../src/lib/db";
import { flowsTable, flowStepsTable, flowInteractionsTable, flowHotspotsTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const STALE_FLOW_ID = "61d04cc5-0a3d-4a90-8e15-26e72c425047";

async function main() {
  console.log("\n=== HANDLING STALE BENEFICIARY FLOW ===\n");

  const db = getDb();

  // 1. Check the stale flow
  const [staleFlow] = await db
    .select()
    .from(flowsTable)
    .where(eq(flowsTable.id, STALE_FLOW_ID))
    .limit(1);

  if (!staleFlow) {
    console.log("✅ Stale flow not found (already cleaned up)\n");
    return;
  }

  console.log("Found stale flow:");
  console.log(`  ID: ${staleFlow.id}`);
  console.log(`  Name: ${staleFlow.name}`);
  console.log(`  Section: ${staleFlow.figmaSectionNodeId}`);
  console.log(`  Status: ${staleFlow.status}\n`);

  // 2. Check for interactions
  const interactions = await db
    .select()
    .from(flowInteractionsTable)
    .where(eq(flowInteractionsTable.flowId, STALE_FLOW_ID));

  console.log(`Interactions: ${interactions.length}`);

  // 3. Check for hotspots
  let hotspotCount = 0;
  for (const interaction of interactions) {
    const hotspots = await db
      .select()
      .from(flowHotspotsTable)
      .where(eq(flowHotspotsTable.interactionId, interaction.id));
    hotspotCount += hotspots.length;
  }

  console.log(`Hotspots: ${hotspotCount}`);

  // 4. Check for steps
  const steps = await db
    .select()
    .from(flowStepsTable)
    .where(eq(flowStepsTable.flowId, STALE_FLOW_ID));

  console.log(`Steps: ${steps.length}\n`);

  // 5. Decision
  if (interactions.length === 0 && hotspotCount === 0) {
    console.log("✅ No interactions or hotspots - safe to archive\n");
    
    // Archive by updating status
    await db
      .update(flowsTable)
      .set({ 
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(flowsTable.id, STALE_FLOW_ID));

    console.log("✅ Archived stale Beneficiary Flow");
    console.log("   Status changed to: archived");
    console.log("   Old section ID: 14:16311");
    console.log("   New current section: 21:18642\n");
  } else {
    console.log("⚠️  WARNING: Flow has interactions or hotspots");
    console.log("   Manual review required before archiving\n");
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
