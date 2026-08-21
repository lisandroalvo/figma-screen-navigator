import { getDb } from "../src/lib/db";
import { flowsTable, flowStepsTable } from "../drizzle/schema";
import { setFlowStartStep } from "../src/lib/repositories/flows";
import { eq, and } from "drizzle-orm";

const BENEFICIARY_FLOW_ID = "3099f83f-7650-4f83-8258-4faae42a3988";
const START_FIGMA_NODE = "21:19162"; // Beneficiaries Tab - Default

async function main() {
  const db = getDb();

  const [flow] = await db
    .select()
    .from(flowsTable)
    .where(eq(flowsTable.id, BENEFICIARY_FLOW_ID));
  if (!flow) throw new Error("Beneficiary flow not found");
  if (flow.status !== "draft") {
    throw new Error(`Refusing: flow status is "${flow.status}", expected draft`);
  }

  const [step] = await db
    .select()
    .from(flowStepsTable)
    .where(
      and(
        eq(flowStepsTable.flowId, BENEFICIARY_FLOW_ID),
        eq(flowStepsTable.figmaNodeId, START_FIGMA_NODE),
      ),
    );
  if (!step) throw new Error(`Start step ${START_FIGMA_NODE} not found`);

  await setFlowStartStep(BENEFICIARY_FLOW_ID, step.id);

  const [updated] = await db
    .select({ startStepId: flowsTable.startStepId })
    .from(flowsTable)
    .where(eq(flowsTable.id, BENEFICIARY_FLOW_ID));

  console.log("Start step set.");
  console.log("  flow:", flow.name);
  console.log("  startStepId:", updated.startStepId);
  console.log("  step name:", step.name, `(${step.figmaNodeId})`);
  console.log("  matches expected step id:", updated.startStepId === step.id);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
