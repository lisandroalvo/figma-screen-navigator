import { getImages } from "../src/lib/figma/client";
import { writeFile } from "node:fs/promises";

const QA_FILE_KEY = "kZjw4BrecmEnfFqcYri5Ya";

// 14 screen states + confirmation modal
const NODES = [
  "21:19162", "21:19194", "21:18725", "21:19067", "21:19094",
  "21:18761", "21:19062", "21:18735", "21:18730", "21:19236",
  "21:18654", "21:19057", "21:19127", "21:19263",
];

async function main() {
  const res = await getImages(QA_FILE_KEY, NODES, { scale: 1, format: "png" });
  if (res.err) throw new Error("Figma images error: " + res.err);
  for (const node of NODES) {
    const key = node.replace(":", "-");
    const url = (res.images as Record<string, string>)[key] ?? (res.images as Record<string, string>)[node];
    if (!url) {
      console.log(node, "-> NO IMAGE");
      continue;
    }
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const path = `/tmp/fig_${key}.png`;
    await writeFile(path, buf);
    console.log(node, "->", path, buf.length, "bytes");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
