import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import * as repo from "@/lib/repositories";

const queries = [
  "pension calculation retro early",
  "estimate detail tooltip",
  "pensioner contact popover",
  "contact accordion open",
  "rate group validation error",
  "MD 768 estimate",
  "no access contract",
  "50 J&S no delay",
];

async function main() {
  const [products, modules, screens] = await Promise.all([
    repo.listProducts(),
    repo.listModules(),
    repo.listScreens(),
  ]);

  console.log("products:", products.length);
  console.log("modules:", modules.length);
  console.log("screens:", screens.length);

  for (const q of queries) {
    const results = await repo.searchScreens(q);
    console.log(
      `${q}:`,
      results.length,
      results.slice(0, 3).map((s) => s.displayName),
    );
  }

  if (screens.length > 0) {
    const related = await repo.listRelatedScreens(screens[0].id);
    console.log("related:", related.length);
    const variants = await repo.listResponsiveVariants(screens[0].id);
    console.log("responsive variants:", variants.length);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
