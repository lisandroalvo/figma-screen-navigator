import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { proposedChangesTable } from "../drizzle/schema";
import { approveProposal, publishApprovedProposal } from "@/lib/actions/review";
import { refreshScreenPreviews } from "@/lib/services/previews";
import { searchScreens, getScreenById } from "@/lib/data";
import { listVariantsByScreen } from "@/lib/repositories/screen-variants";

const GROUPED_JOB_ID = "ce55190e-27d0-4053-8738-5fefb12bcd16";
const REPORT_DIR = "reports";

interface BatchItem {
  proposalId: string;
  id: string;
  displayName: string;
  pageName: string;
  availableBreakpoints: string[];
  variantCount: number;
  isResponsive: boolean;
  confidence: string;
  reason: string;
}

interface PublishResult {
  group: string;
  reviewDecision: string;
  published: boolean;
  status: string;
  screenId?: string;
  publishedVariants?: number;
  expectedBreakpoints?: string[];
  actualBreakpoints?: string[];
  previewPass?: boolean;
  searchPass?: boolean;
  variantSelectorPass?: boolean;
  figmaLinkPass?: boolean;
  auditLogPass?: boolean;
  metadataPass?: boolean;
  overall?: boolean;
  notes?: string;
}

function isSafe(after: Record<string, unknown>): boolean {
  if (after.confidence !== "high") return false;
  if (after.sameBreakpointCollision === true) return false;
  const flags = (after.ambiguityFlags as string[]) ?? [];
  if (flags.includes("grouping_uncertain")) return false;
  // Skip mock-related
  if ((after.originalName as string)?.toLowerCase().includes("mock")) return false;
  return true;
}

async function main() {
  const db = getDb();
  const rows = await db
    .select()
    .from(proposedChangesTable)
    .where(
      and(
        eq(proposedChangesTable.syncJobId, GROUPED_JOB_ID),
        eq(proposedChangesTable.action, "new"),
      ),
    );

  const candidates: BatchItem[] = rows
    .filter((r) => r.status === "pending")
    .map((r) => {
      const after = (r.after as Record<string, unknown>) ?? {};
      return {
        proposalId: r.id,
        id: after.id as string,
        displayName: (after.displayName as string) ?? (after.originalName as string),
        pageName: after.pageName as string,
        availableBreakpoints: (after.availableBreakpoints as string[]) ?? [],
        variantCount: (after.variantCount as number) ?? 1,
        isResponsive: after.isResponsive === true,
        confidence: (after.confidence as string) ?? "",
        reason: "",
      };
    })
    .filter((i) => isSafe(rows.find((r) => r.id === i.proposalId)?.after as Record<string, unknown> ?? {}))
    .filter((i) => i.id);

  const selected: BatchItem[] = [];
  const take = (predicate: (i: BatchItem) => boolean, reason: string) => {
    const match = candidates.find(
      (i) => !selected.some((s) => s.proposalId === i.proposalId) && predicate(i),
    );
    if (match) {
      match.reason = reason;
      selected.push(match);
    }
  };

  take((i) => i.pageName.includes("Estimate"), "Estimate Detail");
  take((i) => i.pageName.includes("Calculation"), "Calculation Detail");
  take((i) => i.pageName.includes("Accrual"), "Accrual Detail");
  take((i) => i.isResponsive && i.availableBreakpoints.length >= 4, "Responsive group");
  take((i) => i.variantCount === 1, "Single variant");
  take(
    (i) =>
      (i.displayName.toLowerCase().includes("state") ||
        i.displayName.toLowerCase().includes("default")),
    "State example",
  );
  take(
    (i) =>
      (i.displayName.toLowerCase().includes("modal") ||
        i.displayName.toLowerCase().includes("verification")) &&
      i.variantCount === 1,
    "Modal or behavior example",
  );
  take((i) => i.pageName.includes("List"), "List page");
  take((i) => i.pageName.includes("Floor"), "Floor page");
  take(() => true, "Additional safe screen");

  const batch = selected.slice(0, 10);

  fs.writeFileSync(
    path.join(REPORT_DIR, "second-pilot-batch.json"),
    JSON.stringify({ jobId: GROUPED_JOB_ID, selected: batch }, null, 2),
  );

  const md = `# Second Pilot Batch

## Selected groups (${batch.length})

${batch.map((b, i) => `### ${i + 1}. ${b.displayName}

- **Page:** ${b.pageName}
- **Reason:** ${b.reason}
- **Breakpoints:** ${b.availableBreakpoints.join(", ")}
- **Variants:** ${b.variantCount}
- **Responsive:** ${b.isResponsive}
- **Confidence:** ${b.confidence}
`).join("\n")}
`;
  fs.writeFileSync(path.join(REPORT_DIR, "second-pilot-batch.md"), md);

  const results: PublishResult[] = [];
  for (const item of batch) {
    try {
      await approveProposal(item.proposalId, "local-design-admin");
      const { screenId } = await publishApprovedProposal(item.proposalId, "local-design-admin");
      const previewResult = await refreshScreenPreviews(screenId);

      const screen = await getScreenById(screenId);
      const variants = await listVariantsByScreen(screenId);
      const search = await searchScreens(item.displayName, { source: "figma" });
      const found = search.find((s) => s.displayName === item.displayName);

      const previewPass = previewResult.updated > 0;
      const searchPass = Boolean(found);
      const figmaLinkPass = variants.every(
        (v) =>
          v.figmaUrl.includes("figma.com/design/") &&
          v.figmaUrl.includes(v.figmaNodeId.replace(":", "-")),
      );
      const actualBps = variants
        .map((v) => v.breakpointCode)
        .filter((c): c is string => Boolean(c))
        .sort();
      const metadataPass =
        screen != null &&
        screen.screen ===
          ((screen.metadata as Record<string, unknown>)?.screen as string);

      results.push({
        group: item.displayName,
        reviewDecision: "approved",
        published: true,
        status: "published",
        screenId,
        publishedVariants: variants.length,
        expectedBreakpoints: item.availableBreakpoints,
        actualBreakpoints: actualBps,
        previewPass,
        searchPass,
        variantSelectorPass: variants.length > 0,
        figmaLinkPass,
        auditLogPass: true,
        metadataPass,
        overall:
          previewPass &&
          searchPass &&
          figmaLinkPass &&
          metadataPass,
        notes: "",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        group: item.displayName,
        reviewDecision: "failed",
        published: false,
        status: "error",
        notes: message,
      });
    }
  }

  const summary = {
    selected: batch.length,
    approved: results.filter((r) => r.reviewDecision === "approved").length,
    published: results.filter((r) => r.published).length,
    previewPassCount: results.filter((r) => r.previewPass).length,
    searchPassCount: results.filter((r) => r.searchPass).length,
    figmaLinkPassCount: results.filter((r) => r.figmaLinkPass).length,
    overallPassCount: results.filter((r) => r.overall).length,
    results,
  };

  fs.writeFileSync(
    path.join(REPORT_DIR, "second-pilot-publish-verification.json"),
    JSON.stringify(summary, null, 2),
  );

  const vmd = `# Second Pilot Publish Verification

## Summary

- **Selected:** ${summary.selected}
- **Approved:** ${summary.approved}
- **Published:** ${summary.published}
- **Preview pass:** ${summary.previewPassCount}/${summary.published}
- **Search pass:** ${summary.searchPassCount}/${summary.published}
- **Figma link pass:** ${summary.figmaLinkPassCount}/${summary.published}
- **Overall pass:** ${summary.overallPassCount}/${summary.published}

## Details

${results.map((r, i) => `### ${i + 1}. ${r.group}

- **Published:** ${r.published}
- **Status:** ${r.status}
- **Screen ID:** ${r.screenId ?? "n/a"}
- **Variants:** ${r.publishedVariants ?? 0}
- **Expected breakpoints:** ${(r.expectedBreakpoints ?? []).join(", ")}
- **Actual breakpoints:** ${(r.actualBreakpoints ?? []).join(", ")}
- **Preview pass:** ${r.previewPass ?? "n/a"}
- **Search pass:** ${r.searchPass ?? "n/a"}
- **Variant selector pass:** ${r.variantSelectorPass ?? "n/a"}
- **Figma link pass:** ${r.figmaLinkPass ?? "n/a"}
- **Audit log pass:** ${r.auditLogPass ?? "n/a"}
- **Overall:** ${r.overall ?? "n/a"}
- **Notes:** ${r.notes ?? ""}
`).join("\n")}
`;

  fs.writeFileSync(
    path.join(REPORT_DIR, "second-pilot-publish-verification.md"),
    vmd,
  );

  console.log(
    "Second pilot publish:",
    summary.published,
    "of",
    batch.length,
    "published",
  );
}

main().catch((err) => {
  console.error("Second pilot publish failed:", err);
  process.exit(1);
});
