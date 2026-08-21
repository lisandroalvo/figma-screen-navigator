import "dotenv/config";
import { getFile } from "../src/lib/figma/client";

const FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const FLOWS_CONTAINER_ID = "21:33589";

async function main() {
  console.log("\n=== INSPECTING FLOWS CONTAINER ===\n");

  console.log("1. Fetching full file...");
  const file = await getFile(FILE_KEY);
  console.log(`   File: ${file.name}\n`);

  console.log("2. Finding Flows container...");
  
  let flowsContainer: any = null;
  let parentPage: any = null;

  for (const page of file.document.children) {
    if (!page.children) continue;
    
    for (const child of page.children) {
      if (child.id === FLOWS_CONTAINER_ID) {
        flowsContainer = child;
        parentPage = page;
        break;
      }
    }
    if (flowsContainer) break;
  }

  if (!flowsContainer) {
    console.log("   ❌ Flows container not found");
    return;
  }

  console.log(`   ✅ Found: ${flowsContainer.name}`);
  console.log(`      ID: ${flowsContainer.id}`);
  console.log(`      Type: ${flowsContainer.type}`);
  console.log(`      Page: ${parentPage.name}`);
  console.log(`      Children: ${flowsContainer.children?.length || 0}\n`);

  if (!flowsContainer.children) {
    console.log("No children found\n");
    return;
  }

  console.log("3. Inspecting child Flow Sections...\n");

  for (let i = 0; i < flowsContainer.children.length; i++) {
    const child = flowsContainer.children[i];
    console.log(`[${i + 1}] ${child.name}`);
    console.log(`    ID: ${child.id}`);
    console.log(`    Type: ${child.type}`);
    
    if (child.type === "SECTION" && child.name.toLowerCase().includes("beneficiary")) {
      console.log(`    ⭐ THIS IS THE BENEFICIARY FLOW\n`);
      await inspectBeneficiaryFlow(child, parentPage);
    } else {
      console.log("");
    }
  }
}

async function inspectBeneficiaryFlow(section: any, page: any) {
  console.log("=".repeat(60));
  console.log("BENEFICIARY FLOW SECTION ANALYSIS");
  console.log("=".repeat(60) + "\n");

  console.log(`Section: ${section.name}`);
  console.log(`ID: ${section.id}`);
  console.log(`Page: ${page.name}`);
  console.log(`Children: ${section.children?.length || 0}\n`);

  if (!section.children) {
    console.log("No children found\n");
    return;
  }

  // Categorize all nodes
  const nodesByType: Record<string, any[]> = {};
  for (const child of section.children) {
    const type = child.type;
    if (!nodesByType[type]) {
      nodesByType[type] = [];
    }
    nodesByType[type].push(child);
  }

  console.log("Node Type Summary:");
  for (const [type, nodes] of Object.entries(nodesByType)) {
    console.log(`  ${type}: ${nodes.length}`);
  }
  console.log("");

  // Analyze all FRAMES and INSTANCES
  console.log("=".repeat(60));
  console.log("ALL FRAMES AND INSTANCES");
  console.log("=".repeat(60) + "\n");

  const allFramesAndInstances = section.children.filter((c: any) => 
    c.type === "FRAME" || c.type === "INSTANCE"
  );

  console.log(`Total FRAME + INSTANCE nodes: ${allFramesAndInstances.length}\n`);

  let screenCount = 0;
  let guidanceCount = 0;
  let actionCount = 0;
  let otherCount = 0;

  for (let i = 0; i < allFramesAndInstances.length; i++) {
    const node = allFramesAndInstances[i];
    const bbox = node.absoluteBoundingBox;
    const classification = classifyNode(node);
    
    console.log(`[${i + 1}] ${node.name}`);
    console.log(`    ID: ${node.id}`);
    console.log(`    Type: ${node.type}`);
    if (bbox) {
      console.log(`    Size: ${bbox.width} × ${bbox.height}`);
      console.log(`    Position: (${bbox.x}, ${bbox.y})`);
    }
    console.log(`    Classification: ${classification}`);
    
    if (classification === "SCREEN") screenCount++;
    else if (classification === "GUIDANCE") guidanceCount++;
    else if (classification === "ACTION") actionCount++;
    else otherCount++;
    
    console.log("");
  }

  console.log("=".repeat(60));
  console.log("CLASSIFICATION SUMMARY");
  console.log("=".repeat(60) + "\n");
  console.log(`SCREENS: ${screenCount}`);
  console.log(`GUIDANCE: ${guidanceCount}`);
  console.log(`ACTIONS: ${actionCount}`);
  console.log(`OTHER: ${otherCount}`);
  console.log(`TOTAL: ${allFramesAndInstances.length}\n`);

  // List all screens
  console.log("=".repeat(60));
  console.log("ALL SCREEN NODES (24 expected)");
  console.log("=".repeat(60) + "\n");

  const screens = allFramesAndInstances.filter((n: any) => classifyNode(n) === "SCREEN");
  
  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    const bbox = screen.absoluteBoundingBox;
    
    console.log(`[${i + 1}] ${screen.name}`);
    console.log(`    ID: ${screen.id}`);
    console.log(`    Type: ${screen.type}`);
    if (bbox) {
      console.log(`    Size: ${bbox.width} × ${bbox.height}`);
    }
    console.log("");
  }

  console.log(`\n✅ TOTAL SCREENS FOUND: ${screens.length}`);
  console.log(`Expected: 24`);
  console.log(`Match: ${screens.length === 24 ? "YES" : "NO"}\n`);
}

function classifyNode(node: any): string {
  const bbox = node.absoluteBoundingBox;
  if (!bbox) return "NO_BBOX";

  const normalized = node.name.toLowerCase().trim();

  // Exclude "Note" frames
  if (normalized === "note" || normalized.startsWith("note ")) {
    return "NOTE";
  }

  // Small frames are likely actions or guidance
  if (bbox.width < 500 || bbox.height < 300) {
    if (bbox.height < 150) {
      return "ACTION";
    }
    return "GUIDANCE";
  }

  // Large frames/instances are screens
  if (node.type === "INSTANCE" || node.type === "FRAME") {
    return "SCREEN";
  }

  return "OTHER";
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
