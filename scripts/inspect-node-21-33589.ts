import "dotenv/config";
import { getFile, getFileNodes } from "../src/lib/figma/client";

const FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const TARGET_NODE_ID = "21:33589";

async function main() {
  console.log("\n=== INSPECTING NODE 21:33589 ===\n");

  // 1. Get full file
  console.log("1. Fetching full file...");
  const file = await getFile(FILE_KEY);
  console.log(`   File: ${file.name}\n`);

  // 3. Find the node in the hierarchy
  console.log("3. Finding node in hierarchy...");
  
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

  // 4. If this IS a section, inspect it
  if (foundNode.type === "SECTION") {
    console.log("4. Node IS a Flow Section\n");
    await inspectFlowSection(foundNode, parentPage);
  } else if (parentSection.type === "SECTION") {
    console.log("4. Node is INSIDE a Flow Section\n");
    console.log(`   Inspecting parent section: ${parentSection.name}\n`);
    await inspectFlowSection(parentSection, parentPage);
  } else {
    console.log("4. Node is NOT in a Flow Section");
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

  // Identify screen candidates
  console.log("=".repeat(60));
  console.log("SCREEN CANDIDATE ANALYSIS");
  console.log("=".repeat(60) + "\n");

  const screenCandidates: any[] = [];

  for (const child of section.children) {
    const isScreen = analyzeScreenCandidate(child);
    if (isScreen) {
      screenCandidates.push(child);
    }
  }

  console.log(`\nTotal Screen Candidates: ${screenCandidates.length}\n`);

  // List all screen candidates
  console.log("=".repeat(60));
  console.log("ALL SCREEN CANDIDATES");
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

  // Analyze non-screens
  console.log("=".repeat(60));
  console.log("NON-SCREEN NODES (for comparison)");
  console.log("=".repeat(60) + "\n");

  const nonScreens = section.children.filter((c: any) => {
    return !screenCandidates.some((s: any) => s.id === c.id);
  });

  console.log(`Total Non-Screen Nodes: ${nonScreens.length}\n`);

  // Group by type
  const nonScreensByType: Record<string, any[]> = {};
  for (const node of nonScreens) {
    const type = node.type;
    if (!nonScreensByType[type]) {
      nonScreensByType[type] = [];
    }
    nonScreensByType[type].push(node);
  }

  for (const [type, nodes] of Object.entries(nonScreensByType)) {
    console.log(`${type} (${nodes.length}):`);
    for (const node of nodes.slice(0, 5)) {
      const bbox = node.absoluteBoundingBox;
      const size = bbox ? `${bbox.width}×${bbox.height}` : "no bbox";
      console.log(`  - ${node.name} (${node.id}) [${size}]`);
    }
    if (nodes.length > 5) {
      console.log(`  ... and ${nodes.length - 5} more`);
    }
    console.log("");
  }
}

function analyzeScreenCandidate(node: any): boolean {
  // Must be INSTANCE or FRAME
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
