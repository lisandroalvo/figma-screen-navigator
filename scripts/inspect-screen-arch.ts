/** READ-ONLY inspection of existing screen storage + breakpoints. No writes. */
import { getDb } from "../src/lib/db";
import { screensTable, screenVariantsTable, breakpointsTable, modulesTable } from "../drizzle/schema";
import { sql, eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  const screenCount = await db.select({ n: sql<number>`count(*)` }).from(screensTable);
  const variantCount = await db.select({ n: sql<number>`count(*)` }).from(screenVariantsTable);
  console.log(`screens rows: ${screenCount[0].n}`);
  console.log(`screen_variants rows: ${variantCount[0].n}`);

  const bySource = await db
    .select({ source: screensTable.source, status: screensTable.status, n: sql<number>`count(*)` })
    .from(screensTable)
    .groupBy(screensTable.source, screensTable.status);
  console.log("screens by (source,status):", JSON.stringify(bySource));

  const bps = await db
    .select({ id: breakpointsTable.id, code: breakpointsTable.code, name: breakpointsTable.name, minW: breakpointsTable.minWidth })
    .from(breakpointsTable);
  console.log(`breakpoints (${bps.length}):`, JSON.stringify(bps));

  // Any screens attached to the Annuity module?
  const annuity = await db.select({ id: modulesTable.id, name: modulesTable.name })
    .from(modulesTable).where(eq(modulesTable.figmaFileKey, "ukMW6Flp8kc9sDTomkCPBs"));
  console.log("Annuity module:", JSON.stringify(annuity));
  if (annuity[0]) {
    const annScreens = await db.select({ n: sql<number>`count(*)` })
      .from(screensTable).where(eq(screensTable.moduleId, annuity[0].id));
    console.log(`Annuity existing screens: ${annScreens[0].n}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
