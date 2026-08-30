/** Apply the additive 0011_add_flow_sections migration (idempotent, non-destructive). */
import { readFile } from "node:fs/promises";
import { getDb } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const path = new URL("../drizzle/migrations/0011_add_flow_sections.sql", import.meta.url);
  const ddl = await readFile(path, "utf8");
  await getDb().execute(sql.raw(ddl));
  const check = await getDb().execute(sql`SELECT to_regclass('public.flow_sections') AS t`);
  console.log("flow_sections exists:", JSON.stringify(check));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
