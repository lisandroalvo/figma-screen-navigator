import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  proposedChangesTable,
  screensTable,
  screenVariantsTable,
} from "../../../drizzle/schema";

export interface LogicalScreenReview {
  id: string;
  displayName: string;
  pageName: string;
  primaryVariant: Record<string, unknown>;
  variants: Record<string, unknown>[];
  availableBreakpoints: string[];
  isResponsive: boolean;
  sameBreakpointCollision: boolean;
  metadata: Record<string, unknown>;
  source: "figma" | "mock";
}

export async function listLogicalScreensForReview(syncJobId: string) {
  const rows = await getDb()
    .select()
    .from(proposedChangesTable)
    .where(eq(proposedChangesTable.syncJobId, syncJobId));

  return rows
    .filter((r) => r.action === "new")
    .map((r) => {
      const after = (r.after as Record<string, unknown>) ?? {};
      return {
        proposalId: r.id,
        ...after,
      } as LogicalScreenReview & { proposalId: string };
    });
}

export async function getLogicalScreenByProposalId(proposalId: string) {
  const rows = await getDb()
    .select()
    .from(proposedChangesTable)
    .where(eq(proposedChangesTable.id, proposalId))
    .limit(1);
  const after = (rows[0]?.after as Record<string, unknown>) ?? {};
  return after as unknown as LogicalScreenReview | null;
}

export async function getPublishedScreenWithVariants(screenId: string) {
  const db = getDb();
  const screen = await db
    .select()
    .from(screensTable)
    .where(eq(screensTable.id, screenId))
    .limit(1);
  if (!screen[0]) return null;
  const variants = await db
    .select()
    .from(screenVariantsTable)
    .where(eq(screenVariantsTable.screenId, screenId));
  return { screen: screen[0], variants };
}
