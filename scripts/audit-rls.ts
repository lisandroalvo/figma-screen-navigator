/**
 * READ-ONLY security diagnostic: report which public-schema tables have RLS
 * disabled and what privileges the `anon` / `authenticated` roles hold on them.
 * This is what determines whether the public anon key (shipped in the browser
 * bundle) can read/write a table directly via PostgREST, bypassing the app.
 * Makes no changes.
 */
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { max: 1, idle_timeout: 10, connect_timeout: 15, prepare: false });

  try {
    const rls = await sql<{ tablename: string; rls_enabled: boolean }[]>`
      SELECT c.relname AS tablename, c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`;

    console.log(`\n=== public tables: RLS status (${rls.length} tables) ===`);
    const disabled = rls.filter((r) => !r.rls_enabled);
    for (const r of rls) console.log(`  ${r.rls_enabled ? "ON " : "OFF"}  ${r.tablename}`);
    console.log(`\nRLS DISABLED on ${disabled.length}/${rls.length} tables: ${disabled.map((d) => d.tablename).join(", ") || "(none)"}`);

    // Grants held by anon/authenticated on public tables (SELECT/INSERT/UPDATE/DELETE).
    const grants = await sql<{ table_name: string; grantee: string; privilege_type: string }[]>`
      SELECT table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
      ORDER BY table_name, grantee, privilege_type`;

    const byTable = new Map<string, Map<string, Set<string>>>();
    for (const g of grants) {
      if (!byTable.has(g.table_name)) byTable.set(g.table_name, new Map());
      const gm = byTable.get(g.table_name)!;
      if (!gm.has(g.grantee)) gm.set(g.grantee, new Set());
      gm.get(g.grantee)!.add(g.privilege_type);
    }

    console.log(`\n=== anon/authenticated grants on public tables ===`);
    for (const [t, gm] of byTable) {
      const parts: string[] = [];
      for (const [role, privs] of gm) parts.push(`${role}:[${[...privs].sort().join(",")}]`);
      console.log(`  ${t} -> ${parts.join("  ")}`);
    }

    // The real exposure: tables with RLS OFF *and* anon holding any write/read grant.
    const exposed = disabled.filter((d) => byTable.get(d.tablename)?.has("anon"));
    console.log(`\n=== EXPOSED (RLS off AND anon has grants) : ${exposed.length} ===`);
    for (const e of exposed) {
      const privs = [...(byTable.get(e.tablename)!.get("anon") ?? [])].sort().join(",");
      console.log(`  ${e.tablename} -> anon:[${privs}]`);
    }

    // Is PostgREST likely to expose these? Check the api search_path roles exist.
    const roles = await sql<{ rolname: string }[]>`SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')`;
    console.log(`\nSupabase roles present: ${roles.map((r) => r.rolname).join(", ")}`);
    console.log("\nAUDIT_DONE");
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
