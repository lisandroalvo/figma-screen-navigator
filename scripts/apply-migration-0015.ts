/**
 * Applies drizzle/migrations/0015_enable_rls_flow_tables.sql to the DB.
 * Idempotent (ENABLE ROW LEVEL SECURITY is a no-op if already enabled).
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const file = path.resolve(process.cwd(), "drizzle/migrations/0015_enable_rls_flow_tables.sql");
  const ddl = fs.readFileSync(file, "utf-8");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 10, connect_timeout: 15, prepare: false });
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
    });
    console.log("MIGRATION_0015_APPLIED");
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
