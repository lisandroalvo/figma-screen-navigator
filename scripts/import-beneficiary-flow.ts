import "dotenv/config";
import { getFile, getImages } from "../src/lib/figma/client";
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
  listFlowSteps,
  listFlowGuidance,
} from "../src/lib/repositories/flows";
import { listPagesByModule } from "../src/lib/repositories/figma-pages";
import { getModuleBySlug } from "../src/lib/repositories/modules";

const QA_MODULE_SLUG = "qa-module";
const QA_FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";

async function main() {
  console.log("\n=== IMPORTING BENEFICIARY MODAL FLOW ===\n");

  // 1. Get module from database
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

  // 3. Extract Flow candidates
  console.log("3. Extracting Flow candidates...");
  const flows = extractFlowCandidates(file, module.id, module.name, QA_FILE_KEY);
  console.log(`   Found ${flows.length} Flows\n`);

  // 4. Find Beneficiary Modal Flow
  const beneficiaryFlow = flows.find((f) =>
    f.sectionName.toLowerCase().includes("beneficiary modal"),
  );

  if (!beneficiaryFlow) {
    console.log("   ❌ Beneficiary Modal - Flow not found");
    return;
  }

  console.log(`   ✅ Found: ${beneficiaryFlow.sectionName}`);
  console.log(`      Section ID: ${beneficiaryFlow.sectionId}`);
  console.log(`      Page: ${beneficiaryFlow.pageName}\n`);

  // 5. Get page from database
  console.log("4. Looking up page in database...");
  const pages = await listPagesByModule(module.id);
  const page = pages.find((p) => p.figmaNodeId === beneficiaryFlow.pageId);

  if (!page) {
    console.log(`   ❌ Page not found in database: ${beneficiaryFlow.pageName}`);
    return;
  }

  console.log(`   ✅ Page ID: ${page.id}\n`);

  // 6. Create/update Flow record
  console.log("5. Creating Flow record...");
  const figmaUrl = generateFigmaNodeUrl(QA_FILE_KEY, beneficiaryFlow.sectionId);

  const flow = await upsertFlow({
    productId: module.productId,
    moduleId: module.id,
    figmaPageId: page.id,
    name: beneficiaryFlow.sectionName,
    normalizedName: beneficiaryFlow.normalizedName,
    figmaFileKey: QA_FILE_KEY,
    figmaSectionNodeId: beneficiaryFlow.sectionId,
    figmaUrl,
    status: "draft",
  });

  console.log(`   ✅ Flow created: ${flow.id}`);
  console.log(`      Figma URL: ${flow.figmaUrl}\n`);

  // 7. Find the Flow Section node in the file
  console.log("6. Extracting Flow Section node...");
  let sectionNode: any = null;
  for (const p of file.document.children) {
    if (p.id === beneficiaryFlow.pageId && p.children) {
      sectionNode = p.children.find((c: any) => c.id === beneficiaryFlow.sectionId);
      break;
    }
  }

  if (!sectionNode) {
    console.log("   ❌ Section node not found in file structure");
    return;
  }

  console.log(`   ✅ Section node found with ${sectionNode.children?.length || 0} children\n`);

  // 8. Extract screen candidates
  console.log("7. Extracting screen candidates...");
  const screens = extractScreenCandidates(sectionNode);
  console.log(`   Found ${screens.length} screen candidates\n`);

  // 9. Create FlowStep records
  console.log("8. Creating FlowStep records...");
  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    await upsertFlowStep({
      flowId: flow.id,
      figmaNodeId: screen.nodeId,
      name: screen.name,
      normalizedName: screen.normalizedName,
      stepType: "screen",
      figmaX: screen.boundingBox?.x,
      figmaY: screen.boundingBox?.y,
      figmaWidth: screen.boundingBox?.width,
      figmaHeight: screen.boundingBox?.height,
      displayOrder: i,
    });
    console.log(`   ✅ Step ${i + 1}: ${screen.name}`);
  }
  console.log("");

  // 10. Extract guidance
  console.log("9. Extracting guidance...");
  const guidanceCandidates = extractGuidanceCandidates(sectionNode);
  console.log(`   Found ${guidanceCandidates.length} guidance candidates\n`);

  // 11. Create guidance records
  console.log("10. Creating guidance records...");
  const guidanceByType: Record<string, number> = {
    guidance: 0,
    action: 0,
    decision: 0,
    branch_label: 0,
  };

  for (const g of guidanceCandidates) {
    // Map guidance types to enum values
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

  console.log(`   Guidance: ${guidanceByType.guidance}`);
  console.log(`   Actions: ${guidanceByType.action}`);
  console.log(`   Decisions: ${guidanceByType.decision}`);
  console.log(`   Branch Labels: ${guidanceByType.branch_label}\n`);

  // 12. Summary
  console.log("=== IMPORT COMPLETE ===\n");
  console.log(`Flow ID: ${flow.id}`);
  console.log(`Flow Name: ${flow.name}`);
  console.log(`Status: ${flow.status}`);
  console.log(`Figma URL: ${flow.figmaUrl}`);
  console.log(`\nSteps: ${screens.length}`);
  console.log(`Guidance Items: ${guidanceCandidates.length}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Generate Flow preview`);
  console.log(`  2. Generate step previews`);
  console.log(`  3. Map interactions in admin UI`);
  console.log(`  4. Test Flow Player\n`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
