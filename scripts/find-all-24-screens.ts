import "dotenv/config";
import { getFile } from "../src/lib/figma/client";

const FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const BENEFICIARY_FLOW_ID = "21:18642";

async function main() {
  console.log("\n=== FINDING ALL 24 SCREENS ===\n");

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

  console.log(`Flow: ${beneficiaryFlow.name}`);
  console.log(`Total children: ${beneficiaryFlow.children.length}\n`);

  // Get all children by type
  const byType: Record<string, any[]> = {};
  for (const child of beneficiaryFlow.children) {
    if (!byType[child.type]) byType[child.type] = [];
    byType[child.type].push(child);
  }

  console.log("Children by type:");
  for (const [type, nodes] of Object.entries(byType)) {
    console.log(`  ${type}: ${nodes.length}`);
  }
  console.log("");

  // Strategy: Look for nodes that represent actual UI screens
  // These could be:
  // 1. Large FRAME nodes (>= 900px wide, typically 1920px)
  // 2. INSTANCE nodes of any reasonable size
  // 3. Medium FRAME nodes that look like screen components (>= 700px wide)

  const potentialScreens: any[] = [];

  for (const node of beneficiaryFlow.children) {
    if (node.type !== "FRAME" && node.type !== "INSTANCE") continue;
    
    const bbox = node.absoluteBoundingBox;
    if (!bbox) continue;

    const normalized = node.name.toLowerCase().trim();
    
    // Strategy 1: All INSTANCE nodes except tiny ones
    if (node.type === "INSTANCE" && bbox.width >= 100 && bbox.height >= 100) {
      potentialScreens.push({...node, reason: "INSTANCE >= 100×100"});
      continue;
    }

    // Strategy 2: Large FRAME nodes (likely full screens)
    if (node.type === "FRAME" && bbox.width >= 900) {
      potentialScreens.push({...node, reason: "FRAME width >= 900"});
      continue;
    }

    // Strategy 3: Medium FRAME nodes (700-900px, could be screen components)
    if (node.type === "FRAME" && bbox.width >= 700 && bbox.height >= 250) {
      // Exclude obvious guidance/action notes
      if (bbox.height < 150 && bbox.width < 1000) {
        continue; // Too small and wide, likely action label
      }
      potentialScreens.push({...node, reason: "FRAME 700×250+"});
      continue;
    }
  }

  console.log("=".repeat(60));
  console.log("POTENTIAL SCREENS (Liberal Strategy)");
  console.log("=".repeat(60) + "\n");

  console.log(`Found: ${potentialScreens.length} potential screens\n`);

  // Sort by position
  potentialScreens.sort((a, b) => {
    const bboxA = a.absoluteBoundingBox;
    const bboxB = b.absoluteBoundingBox;
    if (!bboxA || !bboxB) return 0;
    const yDiff = bboxA.y - bboxB.y;
    if (Math.abs(yDiff) > 100) return yDiff;
    return bboxA.x - bboxB.x;
  });

  for (let i = 0; i < potentialScreens.length; i++) {
    const node = potentialScreens[i];
    const bbox = node.absoluteBoundingBox;
    console.log(`[${i + 1}] ${node.name}`);
    console.log(`    ID: ${node.id}`);
    console.log(`    Type: ${node.type}`);
    console.log(`    Size: ${bbox.width} × ${bbox.height}`);
    console.log(`    Reason: ${node.reason}`);
    console.log("");
  }

  console.log("=".repeat(60));
  console.log("RESULT");
  console.log("=".repeat(60) + "\n");
  console.log(`Total found: ${potentialScreens.length}`);
  console.log(`Expected: 24`);
  console.log(`Match: ${potentialScreens.length === 24 ? "YES ✅" : `NO (${potentialScreens.length > 24 ? "too many" : "missing"} ${Math.abs(24 - potentialScreens.length)})`}\n`);

  if (potentialScreens.length > 24) {
    console.log("⚠️  Too many screens detected. Need to refine exclusion rules.\n");
  } else if (potentialScreens.length < 24) {
    console.log("⚠️  Still missing screens. Checking what else could be screens...\n");
    
    // Show all FRAME/INSTANCE nodes not yet included
    const included = new Set(potentialScreens.map((n: any) => n.id));
    const notIncluded = beneficiaryFlow.children.filter((c: any) => 
      (c.type === "FRAME" || c.type === "INSTANCE") && 
      !included.has(c.id)
    );

    console.log(`Not included (${notIncluded.length}):`);
    for (const node of notIncluded) {
      const bbox = node.absoluteBoundingBox;
      if (bbox) {
        console.log(`  - ${node.name} (${node.type}, ${bbox.width}×${bbox.height})`);
      }
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
