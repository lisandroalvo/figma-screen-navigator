import "dotenv/config";
import { getFile } from "../src/lib/figma/client";

const FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const TARGET_NODE_ID = "21:33589";

async function main() {
  console.log("\n=== INSPECTING NODE 21:33589 ===\n");

  console.log("1. Fetching full file...");
  const file = await getFile(FILE_KEY);
  console.log(`   File: ${file.name}\n`);

  console.log("2. Finding node in hierarchy...");
  
  let foundNode: any = null;
  let parentSection: any = null;
  let parentPage: any = null;

  for (const page of file.document.children) {
    if (!page.children) continue;
    
    for (const child of page.children) {
      if (child.id === TARGET_NODE_ID) {
        foundNode = child;
        parentSection = child;
        parentPage = page;
        break;
      }
      
      // Check if target is inside this child
      if (child.children) {
        const found = findNodeInTree(child, TARGET_NODE_ID);
        if (found) {
          foundNode = found;
          parentSection = child;
          parentPage = page;
          break;
        }
      }
    }
    if (foundNode) break;
  }

  if (!foundNode) {
    console.log("   ❌ Node not found in file hierarchy");
    return;
  }

  console.log(`   ✅ Found in hierarchy`);
  console.log(`      Page: ${parentPage.name} (${parentPage.id})`);
  console.log(`      Parent Section: ${parentSection.name} (${parentSection.id})`);
  console.log(`      Node: ${foundNode.name} (${foundNode.id})`);
  console.log(`      Type: ${foundNode.type}\n`);

  // If this IS a section, inspect it
  if (foundNode.type === "SECTION") {
    console.log("3. Node IS a Flow Section\n");
    await inspectFlowSection(foundNode, parentPage);
  } else if (parentSection.type === "SECTION") {
    console.log("3. Node is INSIDE a Flow Section\n");
    console.log(`   Inspecting parent section: ${parentSection.name}\n`);
    await inspectFlowSection(parentSection, parentPage);
  } else {
    console.log("3. Node is NOT in a Flow Section");
    console.log(`   Parent type: ${parentSection.type}\n`);
  }
}

function findNodeInTree(node: any, targetId: string): any {
  if (node.id === targetId) return node;
  
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeInTree(child, targetId);
      if (found) return found;
    }
  }
  
  return null;
}

async function inspectFlowSection(section: any, page: any) {
  console.log("=".repeat(60));
  console.log("FLOW SECTION ANALYSIS");
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

  // Identify screen candidates using CURRENT parser logic
  console.log("=".repeat(60));
  console.log("SCREEN CANDIDATE ANALYSIS (Current Parser)");
  console.log("=".repeat(60) + "\n");

  const screenCandidates: any[] = [];

  for (const child of section.children) {
    const isScreen = isScreenCandidateCurrentParser(child);
    if (isScreen) {
      screenCandidates.push(child);
    }
  }

  console.log(`Current Parser Detects: ${screenCandidates.length} screens\n`);

  // List all screen candidates
  console.log("=".repeat(60));
  console.log("SCREENS DETECTED BY CURRENT PARSER");
  console.log("=".repeat(60) + "\n");

  for (let i = 0; i < screenCandidates.length; i++) {
    const screen = screenCandidates[i];
    const bbox = screen.absoluteBoundingBox;
    
    console.log(`[${i + 1}] ${screen.name}`);
    console.log(`    ID: ${screen.id}`);
    console.log(`    Type: ${screen.type}`);
    if (bbox) {
      console.log(`    Size: ${bbox.width} × ${bbox.height}`);
      console.log(`    Position: (${bbox.x}, ${bbox.y})`);
    }
    console.log("");
  }

  // Now analyze ALL FRAMES and INSTANCES to find missing screens
  console.log("=".repeat(60));
  console.log("ALL FRAMES AND INSTANCES (to find missing screens)");
  console.log("=".repeat(60) + "\n");

  const allFramesAndInstances = section.children.filter((c: any) => 
    c.type === "FRAME" || c.type === "INSTANCE"
  );

  console.log(`Total FRAME + INSTANCE nodes: ${allFramesAndInstances.length}\n`);

  for (let i = 0; i < allFramesAndInstances.length; i++) {
    const node = allFramesAndInstances[i];
    const bbox = node.absoluteBoundingBox;
    const isDetected = screenCandidates.some((s: any) => s.id === node.id);
    const status = isDetected ? "✅ DETECTED" : "❌ MISSING";
    
    console.log(`[${i + 1}] ${status} ${node.name}`);
    console.log(`    ID: ${node.id}`);
    console.log(`    Type: ${node.type}`);
    if (bbox) {
      console.log(`    Size: ${bbox.width} × ${bbox.height}`);
      console.log(`    Position: (${bbox.x}, ${bbox.y})`);
      
      // Explain why it was rejected
      if (!isDetected) {
        const reasons: string[] = [];
        if (bbox.width < 500) reasons.push(`width ${bbox.width} < 500`);
        if (bbox.height < 300) reasons.push(`height ${bbox.height} < 300`);
        const normalized = node.name.toLowerCase().trim();
        if (normalized === "note" || normalized.startsWith("note ")) {
          reasons.push("name starts with 'note'");
        }
        if (node.type === "FRAME" && bbox.height < 150) {
          reasons.push("FRAME height < 150");
        }
        if (reasons.length > 0) {
          console.log(`    REJECTED: ${reasons.join(", ")}`);
        }
      }
    }
    console.log("");
  }

  // Summary
  const missing = allFramesAndInstances.filter((n: any) => 
    !screenCandidates.some((s: any) => s.id === n.id)
  );

  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60) + "\n");
  console.log(`Total FRAME + INSTANCE nodes: ${allFramesAndInstances.length}`);
  console.log(`Detected by parser: ${screenCandidates.length}`);
  console.log(`Missing from parser: ${missing.length}\n`);
}

function isScreenCandidateCurrentParser(node: any): boolean {
  // Current parser logic from flow-parser.ts
  if (node.type !== "INSTANCE" && node.type !== "FRAME") {
    return false;
  }

  const bbox = node.absoluteBoundingBox;
  if (!bbox) return false;

  // Exclude small nodes (likely notes/labels)
  if (bbox.width < 500 || bbox.height < 300) {
    return false;
  }

  // Exclude nodes named "Note"
  const normalized = node.name.toLowerCase().trim();
  if (normalized === "note" || normalized.startsWith("note ")) {
    return false;
  }

  // Exclude small frames (action labels)
  if (node.type === "FRAME" && bbox.height < 150) {
    return false;
  }

  return true;
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
