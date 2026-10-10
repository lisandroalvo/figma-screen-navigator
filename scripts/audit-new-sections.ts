import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 10, connect_timeout: 15, prepare: false });
  try {
    const totals = await sql.unsafe(`select status, count(*)::int from flow_sections group by status order by status`);
    console.log("flow_sections by status:", JSON.stringify(totals));

    // Newest detected sections overall (likely the just-created ones)
    const newest = await sql.unsafe(`
      select fs.name, m.name as module, fs.status, fs.figma_node_id, fs.created_at, fs.updated_at
      from flow_sections fs join modules m on m.id = fs.module_id
      where fs.status = 'detected'
      order by fs.created_at desc nulls last, fs.updated_at desc nulls last
      limit 10`);
    console.log("\n=== 10 newest detected sections ===");
    for (const r of newest as any[]) console.log(`  [${r.module}] "${r.name}"  node=${r.figma_node_id}  created=${r.created_at}`);

    // Pensioner Profile sections specifically
    const pp = await sql.unsafe(`
      select fs.name, fs.status, fs.figma_node_id, fs.created_at
      from flow_sections fs join modules m on m.id = fs.module_id
      where m.name = 'Pensioner Profile'
      order by fs.created_at desc nulls last`);
    console.log(`\n=== Pensioner Profile sections (${(pp as any[]).length}) ===`);
    for (const r of pp as any[]) console.log(`  ${r.status}  "${r.name}"  node=${r.figma_node_id}  created=${r.created_at}`);
    console.log("DONE");
  } finally { await sql.end({ timeout: 5 }); }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
