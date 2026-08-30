import Link from "next/link";
import { getNavigatorIndex } from "@/lib/navigator";
import ModulesBrowser from "@/components/navigator/ModulesBrowser";

export const dynamic = "force-dynamic";

export default async function ModulesPage() {
  const index = await getNavigatorIndex();
  const modules = [...index.modules]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      fileUrl: m.fileUrl,
      pageCount: m.pageCount,
      flowCount: m.flowCount,
    }));

  return (
    <main className="min-h-screen bg-brandbg p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-primary">Modules</h1>
            <p className="text-sm text-primary/60">
              {index.counts.modules} modules · {index.counts.pages} pages · {index.counts.flows} flows
            </p>
          </div>
          <Link href="/" className="text-sm text-primary/70 hover:text-primary hover:underline">
            ← Search
          </Link>
        </header>

        <ModulesBrowser modules={modules} />
      </div>
    </main>
  );
}
