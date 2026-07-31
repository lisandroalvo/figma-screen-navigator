import Link from "next/link";
import { listModulesWithCounts, listProducts } from "@/lib/data";

export default async function ModulesPage() {
  const [modules, products] = await Promise.all([
    listModulesWithCounts(),
    listProducts(),
  ]);
  const product = products[0];

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold text-zinc-900">Modules</h1>
        <p className="mt-1 text-zinc-600">
          Product: <span className="font-medium">{product?.name}</span>
        </p>
        <ul className="mt-6 space-y-3">
          {modules.map((module) => (
            <li key={module.id}>
              <Link
                href={`/modules/${module.slug}`}
                className="block rounded border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-400"
              >
                <h2 className="text-lg font-medium text-zinc-900">
                  {module.name}
                </h2>
                <p className="text-sm text-zinc-500">
                  {module.screensCount} screen
                  {module.screensCount === 1 ? "" : "s"} · Figma file: {" "}
                  {module.figmaFileName ?? module.figmaFileKey}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
