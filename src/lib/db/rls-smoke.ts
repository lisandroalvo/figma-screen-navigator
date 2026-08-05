import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { getDb } from "@/lib/db";

async function main() {
  const db = getDb();
  const rows = await db.execute<{ relname: string; relrowsecurity: boolean }>(`
    SELECT relname, relrowsecurity
    FROM pg_class
    JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
    WHERE nspname = 'public'
      AND relname IN (
        'products', 'modules', 'figma_pages', 'breakpoints',
        'screens', 'screen_variants', 'screen_relationships',
        'sync_jobs', 'proposed_changes', 'audit_logs', 'profiles'
      )
  `);

  const tableStatus = rows.map((r) => ({
    table: r.relname,
    rlsEnabled: r.relrowsecurity,
  }));

  const allEnabled = tableStatus.every((t) => t.rlsEnabled);
  console.table(tableStatus);
  if (!allEnabled) {
    console.error("RLS is not enabled on all required tables.");
    process.exit(1);
  }
  console.log("RLS enabled on all required tables.");
}

main().catch((err) => {
  console.error("RLS smoke failed:", err);
  process.exit(1);
});
