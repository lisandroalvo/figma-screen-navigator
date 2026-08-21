import { getDb } from "../src/lib/db";
import { flowsTable, flowHotspotsTable } from "../drizzle/schema";
import { createHotspot } from "../src/lib/repositories/flows";
import { eq } from "drizzle-orm";

const BENEFICIARY_FLOW_ID = "3099f83f-7650-4f83-8258-4faae42a3988";

// Interaction IDs (verified from DB diagnostic). Coordinates are 0-1 fractions
// of the screen frame, matching what the HotspotEditor produces.
const HOTSPOTS = [
  {
    // "Select beneficiary row" — Beneficiaries Tab Default -> Row Selected.
    // First beneficiary row in the top table.
    interactionId: "1d278ff7-26f2-426d-b84f-23ec1514ba5b",
    xPercent: 0.059,
    yPercent: 0.272,
    widthPercent: 0.921,
    heightPercent: 0.03,
  },
  {
    // "Add Beneficiary" — Row Selected -> Add Beneficiary Modal Empty.
    // The "Add" button above the beneficiaries table (top-right).
    interactionId: "4faf43c5-c0fa-4ded-9076-6bee438d8840",
    xPercent: 0.9565,
    yPercent: 0.4178,
    widthPercent: 0.031,
    heightPercent: 0.028,
  },
];

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

  for (const h of HOTSPOTS) {
    const existing = await db
      .select()
      .from(flowHotspotsTable)
      .where(eq(flowHotspotsTable.interactionId, h.interactionId));

    if (existing.length > 0) {
      console.log(`Interaction ${h.interactionId}: already has ${existing.length} hotspot(s), skipping.`);
      continue;
    }

    const created = await createHotspot({
      interactionId: h.interactionId,
      xPercent: h.xPercent,
      yPercent: h.yPercent,
      widthPercent: h.widthPercent,
      heightPercent: h.heightPercent,
    });
    console.log(`Created hotspot ${created.id} for interaction ${h.interactionId}`);
    console.log(`  stored-as-fraction: x=${created.xPercent} y=${created.yPercent} w=${created.widthPercent} h=${created.heightPercent}`);
  }

  // Report final total
  let total = 0;
  for (const h of HOTSPOTS) {
    const rows = await db
      .select()
      .from(flowHotspotsTable)
      .where(eq(flowHotspotsTable.interactionId, h.interactionId));
    total += rows.length;
  }
  console.log("Total pilot hotspots now:", total);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
