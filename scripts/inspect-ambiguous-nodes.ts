import "dotenv/config";

const ambiguousNodes = [
  { id: "21:18440", name: "Frame 8949447", size: "950×352", flow: "Start Pay" },
  { id: "21:18452", name: "Note", size: "1158×88", flow: "Start Pay" },
  { id: "21:18640", name: "Note", size: "931×88", flow: "Start Pay" },
  { id: "21:18649", name: "Frame 8949298", size: "950×314", flow: "Beneficiary" },
  { id: "21:18651", name: "Frame 8949326", size: "950×276", flow: "Beneficiary" },
  { id: "21:18709", name: "Frame 8949299", size: "950×314", flow: "Beneficiary" },
  { id: "21:19265", name: "Note", size: "728×192", flow: "Beneficiary" },
];

async function main() {
  console.log("\n=== AMBIGUOUS NODES TO INSPECT ===\n");
  console.log("Use Figma MCP to render each node and determine if it's a SCREEN or GUIDANCE\n");

  for (const node of ambiguousNodes) {
    console.log(`${node.name} (${node.id})`);
    console.log(`  Flow: ${node.flow}`);
    console.log(`  Size: ${node.size}`);
    console.log(`  MCP Command: get_screenshot with nodeId="${node.id.replace(":", "-")}" fileKey="kZjw4BrecmEnfFqcYri5Ya"`);
    console.log("");
  }
}

main();
