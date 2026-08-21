import "dotenv/config";
import { getFile } from "../src/lib/figma/client";
import {
  extractFlowCandidates,
  extractScreenCandidates,
  extractGuidanceCandidates,
  generateFigmaNodeUrl,
} from "../src/lib/figma/flow-parser";
import {
  upsertFlow,
  upsertFlowStep,
  upsertFlowGuidance,
  listFlows,
} from "../src/lib/repositories/flows";
import { listPagesByModule } from "../src/lib/repositories/figma-pages";
import { getModuleBySlug } from "../src/lib/repositories/modules";

const QA_MODULE_SLUG = "qa-module";
const QA_FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const FLOWS_CONTAINER_ID = "21:33589";

// Expected verified counts
const EXPECTED_COUNTS = {
  "Add Event Modal - Flow": 7,
  "Start Pay - Flow": 3,
  "Beneficiary Modal - Flow": 14,
};

async function main() {
  console.log("\n=== IMPORTING ALL THREE FLOWS ===\n");

  // 1. Get QA Module
  console.log("1. Looking up QA Module...");
  const module = await getModuleBySlug(QA_MODULE_SLUG);
  if (!module) {
    console.log("   ❌ QA Module not found");
    return;
  }
  console.log(`   ✅ Module: ${module.name} (${module.id})\n`);

  // 2. Fetch Figma file
  console.log("2. Fetching Figma file...");
  const file = await getFile(QA_FILE_KEY);
  console.log(`   File: ${file.name}\n`);

  // 3. Find Flows container
  console.log("3. Finding Flows container...");
  let flowsContainer: any = null;
  for (const page of file.document.children) {
    if (!page.children) continue;
    for (const child of page.children) {
      if (child.id === FLOWS_CONTAINER_ID) {
        flowsContainer = child;
        break;
      }
    }
    if (flowsContainer) break;
  }

  if (!flowsContainer || !flowsContainer.children) {
    console.log("   ❌ Flows container not found");
    return;
  }
  console.log(`   ✅ Found: ${flowsContainer.name} (${flowsContainer.id})`);
  console.log(`      Child Flows: ${flowsContainer.children.length}\n`);

  // 4. Get pages
  console.log("4. Looking up pages...");
  const pages = await listPagesByModule(module.id);
  console.log(`   ✅ Found ${pages.length} pages\n`);

  // 5. Check for stale Beneficiary Flow
  console.log("5. Checking for stale Beneficiary Flow...");
  const existingFlows = await listFlows({ moduleId: module.id });
  const staleBeneficiary = existingFlows.find(
    (f) => f.figmaSectionNodeId === "14:16311" && f.name.includes("Beneficiary"),
  );

  if (staleBeneficiary) {
    console.log(`   ⚠️  Found stale Beneficiary Flow:`);
    console.log(`      ID: ${staleBeneficiary.id}`);
    console.log(`      Old Section ID: 14:16311`);
    console.log(`      Status: ${staleBeneficiary.status}`);
    console.log(`      Note: Will be replaced by current section 21:18642\n`);
  } else {
    console.log(`   ✅ No stale records found\n`);
  }

  // 6. Import each Flow
  const importedFlows: Array<{
    name: string;
    id: string;
    sectionId: string;
    screenCount: number;
    guidanceCount: number;
  }> = [];

  for (const flowSection of flowsContainer.children) {
    if (flowSection.type !== "SECTION") continue;
    if (!flowSection.name.toLowerCase().endsWith("- flow")) continue;

    console.log("=".repeat(60));
    console.log(`IMPORTING: ${flowSection.name}`);
    console.log("=".repeat(60));

    // Find page that contains this flow section
    let pageNodeId: string | null = null;
    for (const p of file.document.children) {
      if (p.children) {
        // Check if this page contains the Flows container
        const hasFlowsContainer = p.children.some((c: any) => c.id === FLOWS_CONTAINER_ID);
        if (hasFlowsContainer) {
          pageNodeId = p.id;
          break;
        }
      }
    }

    const page = pages.find((p) => p.figmaNodeId === pageNodeId);

    if (!page) {
      console.log(`   ❌ Page not found for ${flowSection.name}\n`);
      continue;
    }

    // Create/update Flow
    const figmaUrl = generateFigmaNodeUrl(QA_FILE_KEY, flowSection.id);
    const flow = await upsertFlow({
      productId: module.productId,
      moduleId: module.id,
      figmaPageId: page.id,
      name: flowSection.name,
      normalizedName: flowSection.name.toLowerCase().trim(),
      figmaFileKey: QA_FILE_KEY,
      figmaSectionNodeId: flowSection.id,
      figmaUrl,
      status: "draft",
    });

    console.log(`   ✅ Flow: ${flow.id}`);
    console.log(`      Section: ${flowSection.id}`);
    console.log(`      URL: ${flow.figmaUrl}\n`);

    // Extract screens
    const screens = extractScreenCandidates(flowSection);
    console.log(`   Detected screens: ${screens.length}`);

    const expectedCount = EXPECTED_COUNTS[flowSection.name as keyof typeof EXPECTED_COUNTS];
    if (expectedCount && screens.length !== expectedCount) {
      console.log(`   ⚠️  WARNING: Expected ${expectedCount}, got ${screens.length}`);
    } else if (expectedCount) {
      console.log(`   ✅ Matches expected count: ${expectedCount}`);
    }
    console.log("");

    // Create FlowSteps
    for (let i = 0; i < screens.length; i++) {
      const screen = screens[i];
      await upsertFlowStep({
        flowId: flow.id,
        figmaNodeId: screen.nodeId,
        name: screen.name,
        normalizedName: screen.normalizedName,
        stepType: "screen",
        figmaX: screen.boundingBox?.x ? Math.round(screen.boundingBox.x) : undefined,
        figmaY: screen.boundingBox?.y ? Math.round(screen.boundingBox.y) : undefined,
        figmaWidth: screen.boundingBox?.width ? Math.round(screen.boundingBox.width) : undefined,
        figmaHeight: screen.boundingBox?.height ? Math.round(screen.boundingBox.height) : undefined,
        displayOrder: i,
      });
    }
    console.log(`   ✅ Created ${screens.length} FlowSteps\n`);

    // Extract guidance
    const guidanceCandidates = extractGuidanceCandidates(flowSection);
    console.log(`   Detected guidance: ${guidanceCandidates.length}`);

    const guidanceByType: Record<string, number> = {
      guidance: 0,
      action: 0,
      decision: 0,
      branch_label: 0,
    };

    for (const g of guidanceCandidates) {
      // Map to enum values
      let guidanceType: "guidance" | "action" | "qa_note" = "guidance";
      if (g.type === "action" || g.type === "branch_label" || g.type === "decision") {
        guidanceType = "action";
      }

      await upsertFlowGuidance({
        flowId: flow.id,
        figmaNodeId: g.nodeId,
        text: g.text,
        guidanceType,
      });
      guidanceByType[g.type]++;
    }

    console.log(`      Guidance: ${guidanceByType.guidance}`);
    console.log(`      Actions: ${guidanceByType.action}`);
    console.log(`      Decisions: ${guidanceByType.decision}`);
    console.log(`      Branch Labels: ${guidanceByType.branch_label}\n`);

    importedFlows.push({
      name: flowSection.name,
      id: flow.id,
      sectionId: flowSection.id,
      screenCount: screens.length,
      guidanceCount: guidanceCandidates.length,
    });
  }

  // Summary
  console.log("=".repeat(60));
  console.log("IMPORT COMPLETE");
  console.log("=".repeat(60) + "\n");

  for (const flow of importedFlows) {
    console.log(`${flow.name}`);
    console.log(`  Flow ID: ${flow.id}`);
    console.log(`  Section: ${flow.sectionId}`);
    console.log(`  Screens: ${flow.screenCount}`);
    console.log(`  Guidance: ${flow.guidanceCount}`);
    console.log("");
  }

  const totalScreens = importedFlows.reduce((sum, f) => sum + f.screenCount, 0);
  console.log(`TOTAL SCREENS: ${totalScreens}`);
  console.log(`Expected: 24`);
  console.log(`Match: ${totalScreens === 24 ? "YES ✅" : "NO ❌"}\n`);

  if (staleBeneficiary) {
    console.log("⚠️  STALE RECORD:");
    console.log(`   Old Beneficiary Flow (14:16311) still exists`);
    console.log(`   ID: ${staleBeneficiary.id}`);
    console.log(`   Recommend: Archive or delete if no interactions/hotspots\n`);
  }

  console.log("Next steps:");
  console.log("  1. Generate Flow overview previews (3)");
  console.log("  2. Generate screen step previews (24)");
  console.log("  3. Build admin review UI");
  console.log("  4. Map pilot interactions\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
