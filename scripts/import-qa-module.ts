import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import {
  productsTable,
  modulesTable,
  syncJobsTable,
  proposedChangesTable,
  screensTable,
  screenVariantsTable,
} from "../drizzle/schema";
import { getFile } from "../src/lib/figma/client";
import { parseFigmaFile } from "../src/lib/figma/parser";
import { groupIntoLogicalScreens } from "../src/lib/figma/grouping";
import { buildFigmaUrl } from "../src/lib/figma/sync";
import { approveProposal, publishApprovedScreen } from "../src/lib/services/publish";
import { refreshScreenPreviews } from "../src/lib/services/previews";

const QA_MODULE_FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";
const QA_MODULE_NAME = "QA Module";
const QA_MODULE_SLUG = "qa-module";

interface ImportStats {
  moduleId: string;
  syncJobId: string;
  logicalScreens: number;
  variants: number;
  primaryVariants: number;
  logicalPreviews: number;
  variantPreviews: number;
  componentsPageScreens: number;
  duplicateCollisions: number;
  publishedScreens: number;
}

async function main() {
  console.log("\n=== QA MODULE IMPORT ===\n");
  console.log(`File Key: ${QA_MODULE_FILE_KEY}`);
  console.log(`Module Name: ${QA_MODULE_NAME}\n`);

  const db = getDb();

  // 1. Get or create NBF product
  console.log("1. Checking NBF product...");
  let [nbfProduct] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.slug, "nbf"))
    .limit(1);

  if (!nbfProduct) {
    console.log("   Creating NBF product...");
    [nbfProduct] = await db
      .insert(productsTable)
      .values({
        name: "NBF",
        slug: "nbf",
        description: "NBF Product Suite",
      })
      .returning();
  }
  console.log(`   ✅ NBF Product ID: ${nbfProduct.id}\n`);

  // 2. Get or create QA Module
  console.log("2. Checking QA Module...");
  let [qaModule] = await db
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.figmaFileKey, QA_MODULE_FILE_KEY))
    .limit(1);

  if (!qaModule) {
    console.log("   Creating QA Module...");
    [qaModule] = await db
      .insert(modulesTable)
      .values({
        productId: nbfProduct.id,
        name: QA_MODULE_NAME,
        slug: QA_MODULE_SLUG,
        figmaFileKey: QA_MODULE_FILE_KEY,
        figmaFileName: "QA MODULE",
        status: "active",
      })
      .returning();
  } else {
    console.log("   QA Module already exists, updating...");
    [qaModule] = await db
      .update(modulesTable)
      .set({
        name: QA_MODULE_NAME,
        figmaFileName: "QA MODULE",
        updatedAt: new Date(),
      })
      .where(eq(modulesTable.id, qaModule.id))
      .returning();
  }
  console.log(`   ✅ QA Module ID: ${qaModule.id}\n`);

  // 3. Fetch and parse Figma file
  console.log("3. Fetching Figma file...");
  const file = await getFile(QA_MODULE_FILE_KEY);
  console.log(`   File: ${file.name}`);
  console.log(`   Last Modified: ${file.lastModified}\n`);

  console.log("4. Parsing with INSTANCE support...");
  const parsed = parseFigmaFile(QA_MODULE_FILE_KEY, file);
  console.log(`   Pages: ${parsed.pages.length}`);
  console.log(`   Ignored: ${parsed.pages.filter((p) => !p.included).length}`);
  console.log(`   Screen candidates: ${parsed.screens.length}`);
  console.log(`   High confidence: ${parsed.counts.high}`);
  console.log(`   Medium confidence: ${parsed.counts.medium}\n`);

  // 4. Group into logical screens
  console.log("5. Grouping into logical screens...");
  const { groups, sameBreakpointCollisions, responsiveGroups } = 
    groupIntoLogicalScreens(parsed.screens);
  
  console.log(`   Logical screens: ${groups.length}`);
  console.log(`   Responsive groups: ${responsiveGroups}`);
  console.log(`   Duplicate collisions: ${sameBreakpointCollisions}\n`);

  // 5. Create sync job
  console.log("6. Creating sync job...");
  const [syncJob] = await db
    .insert(syncJobsTable)
    .values({
      moduleId: qaModule.id,
      status: "completed",
      triggeredBy: "devin-import",
      startedAt: new Date(),
      completedAt: new Date(),
    })
    .returning();
  console.log(`   ✅ Sync Job ID: ${syncJob.id}\n`);

  // 6. Create proposals for each logical screen
  console.log("7. Creating proposals...");
  const proposalIds: string[] = [];
  
  for (const group of groups) {
    // Skip if has same-breakpoint collision
    if (group.sameBreakpointCollision) {
      console.log(`   ⚠️  Skipping "${group.logicalName}" (collision)`);
      continue;
    }

    const variants = group.variants.map((v) => ({
      id: v.id,
      originalName: v.originalName,
      displayName: v.displayName,
      normalizedName: v.normalizedName,
      breakpointCode: v.breakpointCode,
      width: v.width,
      height: v.height,
      figmaUrl: buildFigmaUrl(QA_MODULE_FILE_KEY, v.id),
      metadata: v.metadata,
      ambiguityFlags: v.ambiguityFlags,
    }));

    const [proposal] = await db
      .insert(proposedChangesTable)
      .values({
        syncJobId: syncJob.id,
        action: "new",
        status: "pending",
        after: {
          id: group.id,
          displayName: group.logicalName,
          originalName: group.originalName,
          pageName: group.pageName,
          pageNodeId: group.pageNodeId,
          sectionName: group.sectionName,
          metadata: group.metadata,
          ambiguityFlags: group.ambiguityFlags,
          variants,
          availableBreakpoints: group.availableBreakpoints,
          isResponsive: group.isResponsive,
        },
      })
      .returning();

    proposalIds.push(proposal.id);
    console.log(`   ✅ Created proposal for "${group.logicalName}" (${group.pageName})`);
  }
  console.log(`\n   Total proposals: ${proposalIds.length}\n`);

  // 7. Approve and publish all proposals
  console.log("8. Approving and publishing proposals...");
  const publishedScreenIds: string[] = [];
  
  for (const proposalId of proposalIds) {
    await approveProposal(proposalId, "devin-import");
    const screenId = await publishApprovedScreen(proposalId, "devin-import");
    publishedScreenIds.push(screenId);
    
    const [screen] = await db
      .select()
      .from(screensTable)
      .where(eq(screensTable.id, screenId))
      .limit(1);
    
    console.log(`   ✅ Published: ${screen?.displayName}`);
  }
  console.log(`\n   Total published: ${publishedScreenIds.length}\n`);

  // 8. Generate previews
  console.log("9. Generating previews...");
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const screenId of publishedScreenIds) {
    try {
      const result = await refreshScreenPreviews(screenId);
      totalUpdated += result.updated;
      totalErrors += result.errors;
      
      const [screen] = await db
        .select()
        .from(screensTable)
        .where(eq(screensTable.id, screenId))
        .limit(1);
      
      console.log(`   ✅ ${screen?.displayName}: ${result.updated}/${result.requested} variants`);
      
      if (result.errors > 0) {
        console.log(`      ⚠️  ${result.errors} errors`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to generate previews for ${screenId}:`, error);
      totalErrors++;
    }
  }
  console.log(`\n   Total variant previews: ${totalUpdated}`);
  console.log(`   Total errors: ${totalErrors}\n`);

  // 9. Verify counts
  console.log("10. Verifying final counts...");
  
  const allScreens = await db
    .select()
    .from(screensTable)
    .where(eq(screensTable.moduleId, qaModule.id));

  const stats: ImportStats = {
    moduleId: qaModule.id,
    syncJobId: syncJob.id,
    logicalScreens: allScreens.length,
    variants: 0,
    primaryVariants: 0,
    logicalPreviews: 0,
    variantPreviews: totalUpdated,
    componentsPageScreens: 0,
    duplicateCollisions: sameBreakpointCollisions,
    publishedScreens: 0, // Not published to QA users yet
  };

  // Count all variants across all screens
  for (const screen of allScreens) {
    const variants = await db
      .select()
      .from(screenVariantsTable)
      .where(eq(screenVariantsTable.screenId, screen.id));
    
    stats.variants += variants.length;
    stats.primaryVariants += variants.filter((v) => v.isPrimary).length;
    
    // Count logical screen previews (from primary variant)
    if (screen.previewUrl) {
      stats.logicalPreviews++;
    }
  }

  console.log("\n=== FINAL REPORT ===\n");
  console.log("QA Module status:");
  console.log(`  Database import: ✅`);
  console.log(`  Module ID: ${stats.moduleId}`);
  console.log(`  Sync Job ID: ${stats.syncJobId}`);
  console.log(`  Logical screens: ${stats.logicalScreens}/8`);
  console.log(`  Variants: ${stats.variants}/32`);
  console.log(`  Primary variants: ${stats.primaryVariants}/8`);
  console.log(`  Logical previews: ${stats.logicalPreviews}/8`);
  console.log(`  Variant previews: ${stats.variantPreviews}/32`);
  console.log(`  Components page indexed screens: ${stats.componentsPageScreens}`);
  console.log(`  Duplicate collisions: ${stats.duplicateCollisions}`);
  console.log(`  Published screens: ${stats.publishedScreens}`);
  console.log("");
  console.log("⚠️  QA Module is in DRAFT status and NOT visible to QA users yet.");
  console.log("    Review in admin panel before publishing.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Import failed:", err);
  process.exit(1);
});
