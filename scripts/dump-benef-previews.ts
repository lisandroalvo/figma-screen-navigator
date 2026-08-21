import { getDb } from "../src/lib/db";
import { flowStepsTable } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { writeFile } from "node:fs/promises";

const FLOW = "3099f83f-7650-4f83-8258-4faae42a3988";
const NODES = ["21:19162", "21:19194"]; // Default, Row Selected

async function main() {
  const db = getDb();
  const steps = await db
    .select()
    .from(flowStepsTable)
    .where(
      and(
        eq(flowStepsTable.flowId, FLOW),
        inArray(flowStepsTable.figmaNodeId, NODES),
      ),
    );

  for (const s of steps) {
    console.log(s.figmaNodeId, "->", s.previewUrl);
    if (s.previewUrl) {
      const res = await fetch(s.previewUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      const path = `/tmp/benef_${s.figmaNodeId.replace(":", "_")}.png`;
      await writeFile(path, buf);
      console.log("  saved", path, buf.length, "bytes");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
