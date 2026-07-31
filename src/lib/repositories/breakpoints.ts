import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { breakpointsTable } from "../../../drizzle/schema";
import type { Breakpoint } from "@/types";

function mapBreakpoint(row: typeof breakpointsTable.$inferSelect): Breakpoint {
  return {
    id: row.id,
    figmaPageId: row.figmaPageId,
    figmaNodeId: row.figmaNodeId,
    name: row.name,
    code: row.code,
    width: row.width,
    height: row.height,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listBreakpoints(): Promise<Breakpoint[]> {
  const db = getDb();
  const rows = await db.select().from(breakpointsTable);
  return rows.map(mapBreakpoint);
}

export async function getBreakpointById(
  id: string,
): Promise<Breakpoint | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(breakpointsTable)
    .where(eq(breakpointsTable.id, id))
    .limit(1);
  return rows[0] ? mapBreakpoint(rows[0]) : null;
}
