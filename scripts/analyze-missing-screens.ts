import "dotenv/config";
import { getFile } from "../src/lib/figma/client";

const FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const BENEFICIARY_FLOW_ID = "21:18642";

async function main() {
  console.log("\n=== ANALYZING MISSING SCREENS ===\n");

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
  console.log(`ID: ${beneficiaryFlow.id}`);
  console.log(`Children: ${beneficiaryFlow.children.length}\n`);

  // Get all FRAME and INSTANCE nodes
  const allNodes = beneficiaryFlow.children.filter((c: any) => 
    c.type === "FRAME" || c.type === "INSTANCE"
  );

  console.log("=".repeat(60));
  console.log("DETAILED NODE ANALYSIS");
  console.log("=".repeat(60) + "\n");

  const currentParserScreens: any[] = [];
  const rejectedByName: any[] = [];
  const rejectedBySize: any[] = [];
  const rejectedByOther: any[] = [];

  for (const node of allNodes) {
    const bbox = node.absoluteBoundingBox;
    if (!bbox) continue;

    const normalized = node.name.toLowerCase().trim();
    const isNote = normalized === "note" || normalized.startsWith("note ");
    const isTooSmall = bbox.width < 500 || bbox.height < 300;
    const isSmallFrame = node.type === "FRAME" && bbox.height < 150;

    if (isNote) {
      rejectedByName.push(node);
    } else if (isTooSmall) {
      rejectedBySize.push(node);
    } else if (isSmallFrame) {
      rejectedByOther.push(node);
    } else {
      currentParserScreens.push(node);
    }
  }

  console.log(`Current Parser Screens: ${currentParserScreens.length}`);
  console.log(`Rejected by "Note" name: ${rejectedByName.length}`);
  console.log(`Rejected by size < 500×300: ${rejectedBySize.length}`);
  console.log(`Rejected by other rules: ${rejectedByOther.length}\n`);

  // Analyze rejected by name
  console.log("=".repeat(60));
  console.log("REJECTED BY 'NOTE' NAME");
  console.log("=".repeat(60) + "\n");

  for (const node of rejectedByName) {
    const bbox = node.absoluteBoundingBox;
    console.log(`${node.name}`);
    console.log(`  ID: ${node.id}`);
    console.log(`  Type: ${node.type}`);
    console.log(`  Size: ${bbox.width} × ${bbox.height}`);
    console.log(`  Children: ${node.children?.length || 0}`);
    
    // Check if this looks like a real screen
    const looksLikeScreen = 
      node.type === "INSTANCE" || 
      (bbox.width > 400 && bbox.height > 400);
    
    console.log(`  Looks like screen: ${looksLikeScreen ? "YES ⭐" : "no"}`);
    console.log("");
  }

  // Count how many look like screens
  const notesLookingLikeScreens = rejectedByName.filter((n: any) => {
    const bbox = n.absoluteBoundingBox;
    return n.type === "INSTANCE" || (bbox && bbox.width > 400 && bbox.height > 400);
  });

  console.log("=".repeat(60));
  console.log("POTENTIAL MISSING SCREENS");
  console.log("=".repeat(60) + "\n");

  console.log(`"Note" nodes that look like screens: ${notesLookingLikeScreens.length}\n`);

  for (const node of notesLookingLikeScreens) {
    const bbox = node.absoluteBoundingBox;
    console.log(`⭐ ${node.name}`);
    console.log(`   ID: ${node.id}`);
    console.log(`   Type: ${node.type}`);
    console.log(`   Size: ${bbox.width} × ${bbox.height}\n`);
  }

  console.log("=".repeat(60));
  console.log("CONCLUSION");
  console.log("=".repeat(60) + "\n");

  const totalPotentialScreens = currentParserScreens.length + notesLookingLikeScreens.length;
  
  console.log(`Current parser: ${currentParserScreens.length} screens`);
  console.log(`+ Note instances/large frames: ${notesLookingLikeScreens.length}`);
  console.log(`= Total potential screens: ${totalPotentialScreens}`);
  console.log(`Expected: 24`);
  console.log(`Match: ${totalPotentialScreens === 24 ? "YES ✅" : "NO ❌"}\n`);

  if (totalPotentialScreens === 24) {
    console.log("✅ SOLUTION: Remove the 'Note' name exclusion for INSTANCE nodes");
    console.log("   and large FRAME nodes (>400×400)\n");
  } else {
    console.log(`❌ Still missing ${24 - totalPotentialScreens} screens\n`);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
