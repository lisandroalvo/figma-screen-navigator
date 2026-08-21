import "dotenv/config";
import { getFile } from "../src/lib/figma/client";

const FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const FLOWS_CONTAINER_ID = "21:33589";

interface ScreenCandidate {
  nodeId: string;
  name: string;
  type: string;
  width: number;
  height: number;
  depth: number;
  parentPath: string[];
  hasComplexChildren: boolean;
  childrenCount: number;
  nearbyLabel?: string;
}

async function main() {
  console.log("\n=== FINDING EXACT 24 SCREENS (RECURSIVE) ===\n");

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

  const allScreens: { flow: string; screens: ScreenCandidate[] }[] = [];

  for (const flowSection of flowsContainer.children) {
    if (flowSection.type !== "SECTION") continue;

    console.log("=".repeat(60));
    console.log(`FLOW: ${flowSection.name}`);
    console.log("=".repeat(60));
    console.log(`Section ID: ${flowSection.id}\n`);

    // Recursively find all screen candidates
    const candidates = findScreenCandidatesRecursive(flowSection, [], 0);

    console.log(`Total recursive candidates: ${candidates.length}\n`);

    // Filter to actual screens using multiple signals
    const screens = filterToActualScreens(candidates);

    console.log(`Filtered to ${screens.length} screens:\n`);

    for (let i = 0; i < screens.length; i++) {
      const s = screens[i];
      console.log(`[${i + 1}] ${s.name}`);
      console.log(`    ID: ${s.nodeId}`);
      console.log(`    Type: ${s.type}`);
      console.log(`    Size: ${s.width} × ${s.height}`);
      console.log(`    Depth: ${s.depth}`);
      console.log(`    Children: ${s.childrenCount}`);
      console.log(`    Path: ${s.parentPath.join(" > ")}`);
      if (s.nearbyLabel) {
        console.log(`    Label: ${s.nearbyLabel}`);
      }
      console.log("");
    }

    allScreens.push({ flow: flowSection.name, screens });
  }

  // Summary
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60) + "\n");

  let total = 0;
  for (const { flow, screens } of allScreens) {
    console.log(`${flow}: ${screens.length} screens`);
    total += screens.length;
  }

  console.log(`\nTOTAL: ${total} screens`);
  console.log(`Expected: 24`);
  console.log(`Match: ${total === 24 ? "YES ✅" : `NO (${total > 24 ? "+" : ""}${total - 24})`}\n`);

  if (total !== 24) {
    console.log("⚠️  Count mismatch. Adjusting filters...\n");
  }
}

function findScreenCandidatesRecursive(
  node: any,
  parentPath: string[],
  depth: number,
): ScreenCandidate[] {
  const candidates: ScreenCandidate[] = [];

  // Only consider FRAME and INSTANCE nodes
  if (node.type === "FRAME" || node.type === "INSTANCE") {
    const bbox = node.absoluteBoundingBox;
    if (bbox) {
      const hasComplexChildren = node.children && node.children.length > 5;
      const childrenCount = node.children?.length || 0;

      candidates.push({
        nodeId: node.id,
        name: node.name,
        type: node.type,
        width: bbox.width,
        height: bbox.height,
        depth,
        parentPath: [...parentPath],
        hasComplexChildren,
        childrenCount,
      });
    }
  }

  // Recurse into children
  if (node.children) {
    const newPath = [...parentPath, node.name];
    for (const child of node.children) {
      candidates.push(...findScreenCandidatesRecursive(child, newPath, depth + 1));
    }
  }

  return candidates;
}

function filterToActualScreens(candidates: ScreenCandidate[]): ScreenCandidate[] {
  // Strategy: Find nodes that represent complete UI snapshots
  // Exclude: tiny nodes, obvious labels, nested duplicates

  const screens: ScreenCandidate[] = [];
  const excludedIds = new Set<string>();

  // Sort by depth (prefer shallower nodes) and size (prefer larger)
  const sorted = [...candidates].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return (b.width * b.height) - (a.width * a.height);
  });

  for (const candidate of sorted) {
    // Skip if already excluded
    if (excludedIds.has(candidate.nodeId)) continue;

    // Skip tiny nodes (< 80×80)
    if (candidate.width < 80 || candidate.height < 80) {
      excludedIds.add(candidate.nodeId);
      continue;
    }

    // Skip obvious labels (< 150 height and < 1000 width, unless INSTANCE)
    if (candidate.type === "FRAME" && candidate.height < 150 && candidate.width < 1000) {
      excludedIds.add(candidate.nodeId);
      continue;
    }

    // Check if this is a UI snapshot candidate
    const isLikelyScreen = 
      // Large screens (>= 1000px wide)
      (candidate.width >= 1000) ||
      // Medium-large INSTANCE (>= 400×400)
      (candidate.type === "INSTANCE" && candidate.width >= 400 && candidate.height >= 400) ||
      // Complex nodes with many children (likely UI containers)
      (candidate.hasComplexChildren && candidate.width >= 300 && candidate.height >= 300) ||
      // Medium INSTANCE with reasonable size (>= 200×200)
      (candidate.type === "INSTANCE" && candidate.width >= 200 && candidate.height >= 200);

    if (isLikelyScreen) {
      screens.push(candidate);
      
      // Exclude all descendants of this screen to avoid double-counting
      for (const other of candidates) {
        if (other.depth > candidate.depth && 
            other.parentPath.some(p => p === candidate.name)) {
          excludedIds.add(other.nodeId);
        }
      }
    }
  }

  return screens;
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
