import "dotenv/config";
import { getFile } from "../src/lib/figma/client";

const FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const BENEFICIARY_FLOW_ID = "21:18642";

async function main() {
  console.log("\n=== ANALYZING SIZE-REJECTED NODES ===\n");

  const file = await getFile(FILE_KEY);
  
  let beneficiaryFlow: any = null;
  for (const page of file.document.children) {
    if (!page.children) continue;
    for (const child of page.children) {
      if (child.id === "21:33589" && child.children) {
        beneficiaryFlow = child.children.find((c: any) => c.id === BENEFICIARY_FLOW_ID);
        break;
      }
    }
    if (beneficiaryFlow) break;
  }

  if (!beneficiaryFlow || !beneficiaryFlow.children) {
    console.log("❌ Beneficiary Flow not found");
    return;
  }

  // Get all FRAME and INSTANCE nodes
  const allNodes = beneficiaryFlow.children.filter((c: any) => 
    c.type === "FRAME" || c.type === "INSTANCE"
  );

  console.log(`Total FRAME + INSTANCE nodes: ${allNodes.length}\n`);

  // Categorize by current parser rules
  const screens: any[] = [];
  const noteInstances: any[] = [];
  const sizeRejected: any[] = [];
  const actionFrames: any[] = [];

  for (const node of allNodes) {
    const bbox = node.absoluteBoundingBox;
    if (!bbox) continue;

    const normalized = node.name.toLowerCase().trim();
    const isNote = normalized === "note" || normalized.startsWith("note ");

    if (isNote) {
      if (node.type === "INSTANCE" || (bbox.width > 400 && bbox.height > 400)) {
        noteInstances.push(node);
      }
    } else if (bbox.width < 500 || bbox.height < 300) {
      sizeRejected.push(node);
    } else if (node.type === "FRAME" && bbox.height < 150) {
      actionFrames.push(node);
    } else {
      screens.push(node);
    }
  }

  console.log("Current Classification:");
  console.log(`  Screens (current parser): ${screens.length}`);
  console.log(`  Note instances (missing): ${noteInstances.length}`);
  console.log(`  Size rejected: ${sizeRejected.length}`);
  console.log(`  Action frames: ${actionFrames.length}\n`);

  console.log("=".repeat(60));
  console.log("SIZE-REJECTED NODES");
  console.log("=".repeat(60) + "\n");

  for (const node of sizeRejected) {
    const bbox = node.absoluteBoundingBox;
    console.log(`${node.name}`);
    console.log(`  ID: ${node.id}`);
    console.log(`  Type: ${node.type}`);
    console.log(`  Size: ${bbox.width} × ${bbox.height}`);
    console.log(`  Children: ${node.children?.length || 0}`);
    
    // Analyze if this could be a screen
    const couldBeScreen = 
      node.type === "INSTANCE" ||
      (bbox.width >= 300 && bbox.height >= 200) ||
      node.children && node.children.length > 3;
    
    console.log(`  Could be screen: ${couldBeScreen ? "YES ⭐" : "no"}`);
    console.log("");
  }

  // Count potential screens
  const sizeRejectedScreens = sizeRejected.filter((n: any) => {
    const bbox = n.absoluteBoundingBox;
    return n.type === "INSTANCE" || 
           (bbox && bbox.width >= 300 && bbox.height >= 200) ||
           (n.children && n.children.length > 3);
  });

  console.log("=".repeat(60));
  console.log("FINAL COUNT");
  console.log("=".repeat(60) + "\n");

  const total = screens.length + noteInstances.length + sizeRejectedScreens.length;
  
  console.log(`Current parser screens: ${screens.length}`);
  console.log(`+ Note instances: ${noteInstances.length}`);
  console.log(`+ Size-rejected screens: ${sizeRejectedScreens.length}`);
  console.log(`= Total: ${total}`);
  console.log(`Expected: 24`);
  console.log(`Match: ${total === 24 ? "YES ✅" : `NO (missing ${24 - total})`}\n`);

  // List all potential screens
  console.log("=".repeat(60));
  console.log("ALL POTENTIAL SCREENS");
  console.log("=".repeat(60) + "\n");

  const allScreens = [...screens, ...noteInstances, ...sizeRejectedScreens];
  allScreens.sort((a, b) => {
    const bboxA = a.absoluteBoundingBox;
    const bboxB = b.absoluteBoundingBox;
    if (!bboxA || !bboxB) return 0;
    const yDiff = bboxA.y - bboxB.y;
    if (Math.abs(yDiff) > 100) return yDiff;
    return bboxA.x - bboxB.x;
  });

  for (let i = 0; i < allScreens.length; i++) {
    const node = allScreens[i];
    const bbox = node.absoluteBoundingBox;
    console.log(`[${i + 1}] ${node.name}`);
    console.log(`    ID: ${node.id}`);
    console.log(`    Type: ${node.type}`);
    if (bbox) {
      console.log(`    Size: ${bbox.width} × ${bbox.height}`);
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
