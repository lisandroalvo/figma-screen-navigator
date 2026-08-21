import Link from "next/link";
import { notFound } from "next/navigation";
import { getNavigatorIndex } from "@/lib/navigator";
import ModulePagesBrowser from "@/components/navigator/ModulePagesBrowser";

export const dynamic = "force-dynamic";

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ moduleSlug: string }>;
}) {
  const { moduleSlug } = await params;
  const index = await getNavigatorIndex();
  const mod = index.modules.find((m) => m.slug === moduleSlug);
  if (!mod) notFound();

  const flowsByPage = new Map<string, number>();
  for (const f of index.flows) {
    if (f.moduleSlug !== moduleSlug) continue;
    flowsByPage.set(f.pageId, (flowsByPage.get(f.pageId) ?? 0) + 1);
  }
  const pages = index.pages
    .filter((p) => p.moduleSlug === moduleSlug)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      id: p.id,
      name: p.name,
      pageUrl: p.pageUrl,
      flowCount: flowsByPage.get(p.id) ?? 0,
    }));

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Breadcrumb */}
        <nav className="text-sm text-zinc-500">
          <Link href="/modules" className="hover:text-zinc-900 hover:underline">
            Modules
          </Link>
          <span className="mx-1 text-zinc-400">›</span>
          <span className="font-medium text-zinc-700">{mod.name}</span>
        </nav>

        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{mod.name}</h1>
            <p className="text-sm text-zinc-500">
              {mod.pageCount} page{mod.pageCount === 1 ? "" : "s"} · {mod.flowCount} flow{mod.flowCount === 1 ? "" : "s"}
            </p>
          </div>
          <a
            href={mod.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Open File in Figma ↗
          </a>
        </header>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Pages
          </h2>
          <ModulePagesBrowser moduleSlug={moduleSlug} pages={pages} />
        </section>
      </div>
    </main>
  );
}
