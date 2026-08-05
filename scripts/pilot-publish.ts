import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { proposedChangesTable, screensTable, screenVariantsTable } from "../drizzle/schema";
import { searchScreens } from "@/lib/data";
import { getScreenById } from "@/lib/data";
import { publishApprovedScreen, approveProposal } from "@/lib/services/publish";

const SUBSET_PATH = "reports/pilot-review-subset.json";
const REPORT_DIR = "reports";

interface PublishResult {
  group: string;
  reason: string;
  published: boolean;
  status: string;
  screenId?: string;
  publishedVariants?: number;
  expectedBreakpoints?: string[];
  actualBreakpoints?: string[];
  searchPass?: boolean | null;
  previewPass?: boolean | null;
  figmaLinkPass?: boolean | null;
  metadataPass?: boolean | null;
  overall?: boolean | null;
  notes?: string;
}

interface SubsetItem {
  id: string;
  displayName: string;
  reason: string;
  sameBreakpointCollision?: boolean;
  primaryVariant?: { id: string };
  availableBreakpoints?: string[];
  metadata?: Record<string, unknown>;
}

async function main() {
  const subset = JSON.parse(fs.readFileSync(SUBSET_PATH, "utf-8")) as {
    syncJobId: string;
    subset: SubsetItem[];
  };

  const db = getDb();

  // Clean up previously published figma screens so the script is idempotent.
  // Mock records are untouched because they have source = 'mock'.
  const toRemove = await db
    .select({ id: screensTable.id })
    .from(screensTable)
    .where(eq(screensTable.source, "figma"));
  if (toRemove.length > 0) {
    await db
      .delete(screensTable)
      .where(eq(screensTable.source, "figma"));
  }

  const results: PublishResult[] = [];
  const seenGroupIds = new Set<string>();

  for (const item of subset.subset) {
    if (seenGroupIds.has(item.id)) continue;
    seenGroupIds.add(item.id);
    const reason = item.reason as string;
    const unsafe =
      item.sameBreakpointCollision === true ||
      reason.includes("collision") ||
      reason.includes("uncertain") ||
      reason.includes("mismatch");

    if (unsafe) {
      results.push({
        group: item.displayName,
        reason,
        published: false,
        status: "left_pending",
        notes: reason,
        searchPass: null,
        previewPass: null,
        figmaLinkPass: null,
        metadataPass: null,
      });
      continue;
    }

    const matches = await db
      .select()
      .from(proposedChangesTable)
      .where(
        and(
          eq(proposedChangesTable.syncJobId, subset.syncJobId),
          eq(proposedChangesTable.action, "new"),
        ),
      );
    const match = matches.find(
      (p) => (p.after as Record<string, unknown>)?.id === item.id,
    );

    if (!match) {
      results.push({
        group: item.displayName,
        reason,
        published: false,
        status: "proposal_not_found",
        notes: "Could not find matching proposal",
        searchPass: false,
        previewPass: false,
        figmaLinkPass: false,
        metadataPass: false,
      });
      continue;
    }

    await approveProposal(match.id);
    const screenId = await publishApprovedScreen(match.id);

    const screen = await getScreenById(screenId);
    const variants = await db
      .select()
      .from(screenVariantsTable)
      .where(eq(screenVariantsTable.screenId, screenId));

    const searchResults = await searchScreens(
      item.displayName,
      { source: "figma" },
    );
    const found = searchResults.find(
      (s) => s.displayName === item.displayName,
    );
    const searchPass = Boolean(found);

    const expectedBps = (item.availableBreakpoints as string[]).sort();
    const actualBps = variants
      .map((v) => v.breakpointCode)
      .filter((c): c is string => Boolean(c))
      .sort();
    const previewPass =
      actualBps.length > 0 &&
      variants.some((v) => v.figmaUrl && v.figmaUrl.includes(v.figmaNodeId.replace(":", "-")));
    const figmaLinkPass = variants.every(
      (v) => v.figmaUrl.includes("figma.com/design/") && v.figmaUrl.includes(v.figmaNodeId.replace(":", "-")),
    );
    const metadataPass =
      screen != null &&
      screen.screen === (item.metadata?.screen as string | undefined) &&
      (item.metadata?.scenario === undefined ||
        screen.scenario === (item.metadata?.scenario as string | undefined));

    results.push({
      group: item.displayName,
      reason,
      published: true,
      status: "published",
      screenId,
      publishedVariants: variants.length,
      expectedBreakpoints: expectedBps,
      actualBreakpoints: actualBps,
      searchPass,
      previewPass,
      figmaLinkPass,
      metadataPass,
      overall:
        searchPass && previewPass && figmaLinkPass && metadataPass,
      notes: "",
    });
  }

  const published = results.filter((r) => r.published);
  const pending = results.filter((r) => !r.published);

  const summary = {
    totalReviewed: subset.subset.length,
    published: published.length,
    leftPending: pending.length,
    screensCreated: published.length,
    variantsCreated: published.reduce((a, r) => a + (r.publishedVariants ?? 0), 0),
    searchPassCount: published.filter((r) => r.searchPass).length,
    previewPassCount: published.filter((r) => r.previewPass).length,
    figmaLinkPassCount: published.filter((r) => r.figmaLinkPass).length,
    metadataPassCount: published.filter((r) => r.metadataPass).length,
    overallPassCount: published.filter((r) => r.overall).length,
    results,
  };

  fs.writeFileSync(
    path.join(REPORT_DIR, "pilot-publish-verification.json"),
    JSON.stringify(summary, null, 2),
  );

  const md = `# Pilot Publish Verification

## Summary

- **Total reviewed:** ${summary.totalReviewed}
- **Published:** ${summary.published}
- **Left pending:** ${summary.leftPending}
- **Screens created:** ${summary.screensCreated}
- **Variants created:** ${summary.variantsCreated}
- **Search pass:** ${summary.searchPassCount}/${summary.published}
- **Preview pass:** ${summary.previewPassCount}/${summary.published}
- **Figma link pass:** ${summary.figmaLinkPassCount}/${summary.published}
- **Metadata pass:** ${summary.metadataPassCount}/${summary.published}
- **Overall pass:** ${summary.overallPassCount}/${summary.published}

## Details

${results.map((r, i) => `### ${i + 1}. ${r.group}

- **Reason:** ${r.reason}
- **Published:** ${r.published}
- **Status:** ${r.status}
- **Screen ID:** ${r.screenId ?? "n/a"}
- **Variants:** ${r.publishedVariants ?? 0}
- **Expected breakpoints:** ${(r.expectedBreakpoints ?? []).join(", ")}
- **Actual breakpoints:** ${(r.actualBreakpoints ?? []).join(", ")}
- **Search pass:** ${r.searchPass ?? "n/a"}
- **Preview pass:** ${r.previewPass ?? "n/a"}
- **Figma link pass:** ${r.figmaLinkPass ?? "n/a"}
- **Metadata pass:** ${r.metadataPass ?? "n/a"}
- **Overall:** ${r.overall ?? "n/a"}
- **Notes:** ${r.notes}
`).join("\n")}
`;

  fs.writeFileSync(
    path.join(REPORT_DIR, "pilot-publish-verification.md"),
    md,
  );

  console.log(
    "Pilot publish summary:",
    summary.published,
    "published",
    summary.leftPending,
    "pending",
  );
}

main().catch((err) => {
  console.error("Pilot publish failed:", err);
  process.exit(1);
});
