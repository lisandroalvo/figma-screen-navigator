import "dotenv/config";
import { getDb } from "../src/lib/db";
import { flowStepsTable, flowInteractionsTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const BENEFICIARY_FLOW_ID = "3099f83f-7650-4f83-8258-4faae42a3988";

// Map Figma node IDs to step IDs
const STEP_MAP: Record<string, string> = {
  "21:19162": "Beneficiaries Tab - Default",
  "21:19194": "Beneficiaries Tab - Row Selected",
  "21:18725": "Add Beneficiary Modal - Empty",
  "21:19067": "Add Beneficiary Modal - Populated",
  "21:19094": "Add Beneficiary Modal - With QDRO",
  "21:18761": "Add Beneficiary Modal - Success",
  "21:19062": "Add Beneficiary Modal - Error",
};

async function main() {
  console.log("\n=== MAPPING BENEFICIARY PILOT INTERACTIONS ===\n");

  const db = getDb();

  // Get all steps
  const steps = await db
    .select()
    .from(flowStepsTable)
    .where(eq(flowStepsTable.flowId, BENEFICIARY_FLOW_ID));

  console.log(`Found ${steps.length} steps\n`);

  // Find step IDs by Figma node ID
  const getStepId = (figmaNodeId: string) => {
    const step = steps.find((s) => s.figmaNodeId === figmaNodeId);
    return step?.id;
  };

  // Define real interactions based on Figma Flow
  const interactions = [
    {
      source: "21:19162", // Beneficiaries Tab - Default
      dest: "21:19194", // Beneficiaries Tab - Row Selected
      label: "Select beneficiary row",
      trigger: "click" as const,
    },
    {
      source: "21:19194", // Beneficiaries Tab - Row Selected
      dest: "21:18725", // Add Beneficiary Modal - Empty
      label: "Add Beneficiary",
      trigger: "click" as const,
    },
    {
      source: "21:18725", // Add Beneficiary Modal - Empty
      dest: "21:19067", // Add Beneficiary Modal - Populated
      label: "Fill form",
      trigger: "next" as const,
    },
    {
      source: "21:19067", // Add Beneficiary Modal - Populated
      dest: "21:18761", // Add Beneficiary Modal - Success
      label: "Save (Success)",
      trigger: "branch" as const,
    },
    {
      source: "21:19067", // Add Beneficiary Modal - Populated
      dest: "21:19062", // Add Beneficiary Modal - Error
      label: "Save (Error)",
      trigger: "branch" as const,
    },
  ];

  console.log("Creating interactions...\n");

  for (const interaction of interactions) {
    const sourceId = getStepId(interaction.source);
    const destId = getStepId(interaction.dest);

    if (!sourceId || !destId) {
      console.log(`⚠️  Skipping: ${interaction.label} (missing step)`);
      continue;
    }

    await db.insert(flowInteractionsTable).values({
      flowId: BENEFICIARY_FLOW_ID,
      sourceStepId: sourceId,
      destinationStepId: destId,
      label: interaction.label,
      trigger: interaction.trigger,
      source: "manual",
    });

    console.log(`✅ ${STEP_MAP[interaction.source]} → ${STEP_MAP[interaction.dest]}`);
    console.log(`   Label: ${interaction.label}`);
    console.log(`   Trigger: ${interaction.trigger}\n`);
  }

  console.log("=".repeat(60));
  console.log("PILOT INTERACTIONS MAPPED");
  console.log("=".repeat(60) + "\n");

  console.log("Next steps:");
  console.log("1. Open http://localhost:3000/admin/flows/3099f83f-7650-4f83-8258-4faae42a3988");
  console.log("2. Draw hotspots for click interactions");
  console.log("3. Test in Flow Player\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
