import "dotenv/config";
import { getFile } from "../src/lib/figma/client";

const FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const FLOWS_CONTAINER_ID = "21:33589";

interface NodeClassification {
  nodeId: string;
  name: string;
  type: string;
  width: number;
  height: number;
  classification: "SCREEN" | "GUIDANCE" | "ACTION" | "DECISION" | "BRANCH_LABEL" | "CONNECTOR" | "AMBIGUOUS";
  reason: string;
}

async function main() {
  console.log("\n=== AUDITING ALL THREE FLOWS ===\n");

  const file = await getFile(FILE_KEY);
  
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
    console.log("❌ Flows container not found");
    return;
  }

  console.log(`Parent: ${flowsContainer.name}`);
  console.log(`Node: ${flowsContainer.id}`);
  console.log(`Child Flows: ${flowsContainer.children.length}\n`);

  const allFlowScreens: NodeClassification[] = [];
  const allFlowDecisions: NodeClassification[] = [];
  const allFlowActions: NodeClassification[] = [];
  const allFlowGuidance: NodeClassification[] = [];
  const allAmbiguous: NodeClassification[] = [];

  for (const flowSection of flowsContainer.children) {
    if (flowSection.type !== "SECTION") continue;

    console.log("=".repeat(60));
    console.log(`FLOW: ${flowSection.name}`);
    console.log("=".repeat(60));
    console.log(`Section ID: ${flowSection.id}`);
    console.log(`Children: ${flowSection.children?.length || 0}\n`);

    if (!flowSection.children) {
      console.log("No children\n");
      continue;
    }

    // Classify all nodes
    const classifications = classifyFlowNodes(flowSection);

    console.log("Node Type Summary:");
    const byType: Record<string, number> = {};
    for (const child of flowSection.children) {
      byType[child.type] = (byType[child.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(byType)) {
      console.log(`  ${type}: ${count}`);
    }
    console.log("");

    console.log("Classification Summary:");
    console.log(`  SCREENS: ${classifications.screens.length}`);
    console.log(`  GUIDANCE: ${classifications.guidance.length}`);
    console.log(`  ACTIONS: ${classifications.actions.length}`);
    console.log(`  DECISIONS: ${classifications.decisions.length}`);
    console.log(`  BRANCH_LABELS: ${classifications.branchLabels.length}`);
    console.log(`  AMBIGUOUS: ${classifications.ambiguous.length}`);
    console.log(`  CONNECTORS: ${classifications.connectors.length}\n`);

    // List screens
    if (classifications.screens.length > 0) {
      console.log("SCREENS:");
      for (let i = 0; i < classifications.screens.length; i++) {
        const s = classifications.screens[i];
        console.log(`  [${i + 1}] ${s.name}`);
        console.log(`      ID: ${s.nodeId}`);
        console.log(`      Type: ${s.type}`);
        console.log(`      Size: ${s.width} × ${s.height}`);
        console.log(`      Reason: ${s.reason}`);
      }
      console.log("");
    }

    // List ambiguous nodes that need visual inspection
    if (classifications.ambiguous.length > 0) {
      console.log("⚠️  AMBIGUOUS (Need Visual Inspection):");
      for (const a of classifications.ambiguous) {
        console.log(`  - ${a.name} (${a.nodeId})`);
        console.log(`    Type: ${a.type}, Size: ${a.width}×${a.height}`);
        console.log(`    Reason: ${a.reason}`);
      }
      console.log("");
    }

    // Aggregate
    allFlowScreens.push(...classifications.screens);
    allFlowDecisions.push(...classifications.decisions);
    allFlowActions.push(...classifications.actions);
    allFlowGuidance.push(...classifications.guidance);
    allAmbiguous.push(...classifications.ambiguous);
  }

  // Final summary
  console.log("=".repeat(60));
  console.log("TOTAL ACROSS ALL THREE FLOWS");
  console.log("=".repeat(60) + "\n");

  console.log(`SCREENS: ${allFlowScreens.length}`);
  console.log(`DECISIONS: ${allFlowDecisions.length}`);
  console.log(`ACTIONS: ${allFlowActions.length}`);
  console.log(`GUIDANCE: ${allFlowGuidance.length}`);
  console.log(`AMBIGUOUS: ${allAmbiguous.length}\n`);

  console.log(`Total confirmed screens: ${allFlowScreens.length}`);
  console.log(`+ Ambiguous (need inspection): ${allAmbiguous.length}`);
  console.log(`= Potential total: ${allFlowScreens.length + allAmbiguous.length}`);
  console.log(`Expected: 24\n`);

  if (allAmbiguous.length > 0) {
    console.log("=".repeat(60));
    console.log("AMBIGUOUS NODES REQUIRING VISUAL INSPECTION");
    console.log("=".repeat(60) + "\n");

    for (const node of allAmbiguous) {
      console.log(`${node.name}`);
      console.log(`  ID: ${node.nodeId}`);
      console.log(`  Type: ${node.type}`);
      console.log(`  Size: ${node.width} × ${node.height}`);
      console.log(`  Reason: ${node.reason}`);
      console.log(`  Render command: npx tsx scripts/render-node.ts ${node.nodeId}`);
      console.log("");
    }
  }
}

function classifyFlowNodes(flowSection: any): {
  screens: NodeClassification[];
  guidance: NodeClassification[];
  actions: NodeClassification[];
  decisions: NodeClassification[];
  branchLabels: NodeClassification[];
  connectors: NodeClassification[];
  ambiguous: NodeClassification[];
} {
  const screens: NodeClassification[] = [];
  const guidance: NodeClassification[] = [];
  const actions: NodeClassification[] = [];
  const decisions: NodeClassification[] = [];
  const branchLabels: NodeClassification[] = [];
  const connectors: NodeClassification[] = [];
  const ambiguous: NodeClassification[] = [];

  for (const child of flowSection.children) {
    const bbox = child.absoluteBoundingBox;

    // Connectors (VECTOR)
    if (child.type === "VECTOR") {
      connectors.push({
        nodeId: child.id,
        name: child.name,
        type: child.type,
        width: bbox?.width || 0,
        height: bbox?.height || 0,
        classification: "CONNECTOR",
        reason: "VECTOR type",
      });
      continue;
    }

    // TEXT nodes (decisions or branch labels)
    if (child.type === "TEXT") {
      const text = (child as any).characters || "";
      if (text.endsWith("?")) {
        decisions.push({
          nodeId: child.id,
          name: child.name,
          type: child.type,
          width: bbox?.width || 0,
          height: bbox?.height || 0,
          classification: "DECISION",
          reason: "TEXT ending with ?",
        });
      } else {
        branchLabels.push({
          nodeId: child.id,
          name: child.name,
          type: child.type,
          width: bbox?.width || 0,
          height: bbox?.height || 0,
          classification: "BRANCH_LABEL",
          reason: "TEXT node",
        });
      }
      continue;
    }

    // Only FRAME and INSTANCE from here
    if (child.type !== "FRAME" && child.type !== "INSTANCE") continue;
    if (!bbox) continue;

    const normalized = child.name.toLowerCase().trim();

    // Tiny frames (< 100×100) are likely action buttons
    if (bbox.width < 100 && bbox.height < 100) {
      actions.push({
        nodeId: child.id,
        name: child.name,
        type: child.type,
        width: bbox.width,
        height: bbox.height,
        classification: "ACTION",
        reason: "Tiny frame < 100×100",
      });
      continue;
    }

    // Small height frames (~88px) are likely action labels or guidance
    if (bbox.height < 150 && bbox.width < 600) {
      actions.push({
        nodeId: child.id,
        name: child.name,
        type: child.type,
        width: bbox.width,
        height: bbox.height,
        classification: "ACTION",
        reason: "Small height < 150, width < 600",
      });
      continue;
    }

    // Large FRAME nodes (>= 1500px wide) are very likely full screens
    if (child.type === "FRAME" && bbox.width >= 1500) {
      screens.push({
        nodeId: child.id,
        name: child.name,
        type: child.type,
        width: bbox.width,
        height: bbox.height,
        classification: "SCREEN",
        reason: "Large FRAME >= 1500px wide",
      });
      continue;
    }

    // Large INSTANCE nodes (>= 1000px wide) are very likely screens
    if (child.type === "INSTANCE" && bbox.width >= 1000) {
      screens.push({
        nodeId: child.id,
        name: child.name,
        type: child.type,
        width: bbox.width,
        height: bbox.height,
        classification: "SCREEN",
        reason: "Large INSTANCE >= 1000px wide",
      });
      continue;
    }

    // Medium-large INSTANCE nodes (>= 400×400) are likely screens
    if (child.type === "INSTANCE" && bbox.width >= 400 && bbox.height >= 400) {
      screens.push({
        nodeId: child.id,
        name: child.name,
        type: child.type,
        width: bbox.width,
        height: bbox.height,
        classification: "SCREEN",
        reason: "Medium INSTANCE >= 400×400",
      });
      continue;
    }

    // AMBIGUOUS: Medium frames (900-1500px wide, or 300-900px wide with height > 250)
    // These could be screens OR guidance - need visual inspection
    if (child.type === "FRAME" && bbox.width >= 900 && bbox.width < 1500) {
      ambiguous.push({
        nodeId: child.id,
        name: child.name,
        type: child.type,
        width: bbox.width,
        height: bbox.height,
        classification: "AMBIGUOUS",
        reason: "Medium FRAME 900-1500px - could be screen or guidance",
      });
      continue;
    }

    // AMBIGUOUS: Small-medium INSTANCE (< 400×400 but >= 150×150)
    if (child.type === "INSTANCE" && bbox.width >= 150 && bbox.height >= 150 && (bbox.width < 400 || bbox.height < 400)) {
      ambiguous.push({
        nodeId: child.id,
        name: child.name,
        type: child.type,
        width: bbox.width,
        height: bbox.height,
        classification: "AMBIGUOUS",
        reason: "Small-medium INSTANCE - could be screen component or annotation",
      });
      continue;
    }

    // Everything else that's not tiny is likely guidance
    if (bbox.width >= 150 || bbox.height >= 150) {
      guidance.push({
        nodeId: child.id,
        name: child.name,
        type: child.type,
        width: bbox.width,
        height: bbox.height,
        classification: "GUIDANCE",
        reason: "Medium-sized frame/instance not matching screen criteria",
      });
    }
  }

  return { screens, guidance, actions, decisions, branchLabels, connectors, ambiguous };
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
