/** READ-ONLY: render the 19 accepted Annuity screen nodes to PNGs for visual QA. */
import { getImages } from "../src/lib/figma/client";
import { writeFile } from "node:fs/promises";

const ANNUITY_KEY = "ukMW6Flp8kc9sDTomkCPBs";
const OUT = "/private/tmp/claude-501/-Users-lisandroalvo-Desktop/d536df60-ac6d-4183-b8e3-ae37855ebc5e/scratchpad";

// [flowLabel, nodeId, shortName]
const NODES: [string, string, string][] = [
  ["main", "27313:4385", "Default"],
  ["main", "27313:4661", "Missing-DOB"],
  ["main", "27359:11642", "Pop-Over"],
  ["main", "27359:11643", "Pop-Over-Action"],
  ["Lg", "27359:12417", "Default"],
  ["Lg", "27360:13338", "Popup"],
  ["Lg", "27360:13632", "Popup-ActionMenu"],
  ["Lg", "27360:12876", "No-Balance"],
  ["Lg", "27360:13107", "Cannot-Retrieved"],
  ["MD", "27360:16658", "Default"],
  ["MD", "27360:16661", "Popup"],
  ["MD", "27360:16668", "Popup-ActionMenu"],
  ["MD", "27360:16727", "No-Balance"],
  ["MD", "27360:16779", "Cannot-Retrieved"],
  ["Sm", "27360:25736", "Default"],
  ["Sm", "27360:25739", "Popup"],
  ["Sm", "27360:25746", "Popup-ActionMenu"],
  ["Sm", "27360:25753", "No-Balance"],
  ["Sm", "27360:25805", "Cannot-Retrieved"],
];

async function main() {
  const ids = NODES.map((n) => n[1]);
  const res = await getImages(ANNUITY_KEY, ids, { scale: 1, format: "png" });
  if (res.err) { console.error("getImages err:", res.err); process.exit(1); }
  for (const [flow, id, name] of NODES) {
    const url = res.images[id];
    if (!url) { console.log(`  MISSING image for ${id}`); continue; }
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const file = `${OUT}/annuity_${flow}_${name}_${id.replace(":", "-")}.png`;
    await writeFile(file, buf);
    console.log(`${flow}\t${id}\t${(buf.length / 1024).toFixed(0)}KB\t${file}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
