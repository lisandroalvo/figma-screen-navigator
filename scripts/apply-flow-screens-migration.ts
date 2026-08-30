/** Apply the additive 0010_add_flow_screens migration (idempotent, non-destructive). */
import { readFile } from "node:fs/promises";
import { getDb } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const path = new URL("../drizzle/migrations/0010_add_flow_screens.sql", import.meta.url);
  const ddl = await readFile(path, "utf8");
  const db = getDb();
  // Execute the whole DDL script (multiple statements) in one call.
  await db.execute(sql.raw(ddl));
  const check = await db.execute(sql`SELECT to_regclass('public.flow_screens') AS t`);
  console.log("flow_screens exists:", JSON.stringify(check));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
