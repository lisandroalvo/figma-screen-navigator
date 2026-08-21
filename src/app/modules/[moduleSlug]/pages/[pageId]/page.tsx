import Link from "next/link";
import { notFound } from "next/navigation";
import { getNavigatorIndex } from "@/lib/navigator";

export const dynamic = "force-dynamic";

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ moduleSlug: string; pageId: string }>;
}) {
  const { moduleSlug, pageId } = await params;
  const index = await getNavigatorIndex();
  const page = index.pages.find((p) => p.id === pageId && p.moduleSlug === moduleSlug);
  if (!page) notFound();

  const flows = index.flows
    .filter((f) => f.pageId === pageId)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Breadcrumb */}
        <nav className="text-sm text-zinc-500">
          <Link href="/modules" className="hover:text-zinc-900 hover:underline">
            Modules
          </Link>
          <span className="mx-1 text-zinc-400">›</span>
          <Link href={`/modules/${moduleSlug}`} className="hover:text-zinc-900 hover:underline">
            {page.moduleName}
          </Link>
          <span className="mx-1 text-zinc-400">›</span>
          <span className="font-medium text-zinc-700">{page.name}</span>
        </nav>

        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{page.name}</h1>
            <p className="text-sm text-zinc-500">
              {flows.length} flow{flows.length === 1 ? "" : "s"}
            </p>
          </div>
          {page.pageUrl && (
            <a
              href={page.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Open Page in Figma ↗
            </a>
          )}
        </header>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Flow sections
          </h2>
          {flows.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-sm">
              No Flow sections on this Page.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              {flows.map((f) => (
                <li key={f.id} className="group flex items-center gap-2 pl-3 pr-2 hover:bg-zinc-50">
                  <Link
                    href={`/flows/${f.id}`}
                    className="flex flex-1 items-center gap-3 rounded py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                      Flow
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-zinc-900">
                      {f.name}
                    </span>
                    <span className="shrink-0 text-zinc-400 group-hover:text-zinc-700">→</span>
                  </Link>
                  <a
                    href={f.figmaUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${f.name} in Figma`}
                    className="shrink-0 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    Figma ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
