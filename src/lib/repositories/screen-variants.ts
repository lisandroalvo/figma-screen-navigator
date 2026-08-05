import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { screenVariantsTable } from "../../../drizzle/schema";

export async function listVariantsByScreen(screenId: string) {
  return getDb()
    .select()
    .from(screenVariantsTable)
    .where(eq(screenVariantsTable.screenId, screenId))
    .orderBy(screenVariantsTable.isPrimary);
}

export async function getVariantById(id: string) {
  const rows = await getDb()
    .select()
    .from(screenVariantsTable)
    .where(eq(screenVariantsTable.id, id))
    .limit(1);
  return rows[0];
}

export async function getVariantByFigmaNodeId(
  screenId: string,
  figmaNodeId: string,
) {
  const rows = await getDb()
    .select()
    .from(screenVariantsTable)
    .where(
      and(
        eq(screenVariantsTable.screenId, screenId),
        eq(screenVariantsTable.figmaNodeId, figmaNodeId),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function getPrimaryVariant(screenId: string) {
  const rows = await getDb()
    .select()
    .from(screenVariantsTable)
    .where(
      and(
        eq(screenVariantsTable.screenId, screenId),
        eq(screenVariantsTable.isPrimary, true),
      ),
    )
    .limit(1);
  return rows[0];
}
