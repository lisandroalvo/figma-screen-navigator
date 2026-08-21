import Link from "next/link";
import { getNavigatorIndex, searchNavigator } from "@/lib/navigator";

export const dynamic = "force-dynamic";

type BadgeType = "module" | "page" | "flow";
function TypeBadge({ type }: { type: BadgeType }) {
  const styles: Record<BadgeType, string> = {
    module: "bg-indigo-100 text-indigo-800",
    page: "bg-emerald-100 text-emerald-800",
    flow: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[type]}`}>
      {type}
    </span>
  );
}

function ResultRow({
  type,
  href,
  name,
  context,
  figmaUrl,
  figmaLabel,
}: {
  type: BadgeType;
  href: string;
  name: string;
  context: string;
  figmaUrl: string;
  figmaLabel: string;
}) {
  return (
    <li className="group flex items-center gap-2 pl-3 pr-2 hover:bg-zinc-50">
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-start gap-3 rounded py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        <TypeBadge type={type} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-900">{name}</span>
          <span className="block truncate text-xs text-zinc-500">{context}</span>
        </span>
        <span className="mt-0.5 shrink-0 text-zinc-400 group-hover:text-zinc-700">→</span>
      </Link>
      <a
        href={figmaUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={figmaLabel}
        className="shrink-0 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        Figma ↗
      </a>
    </li>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        {children}
      </ul>
    </section>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const index = await getNavigatorIndex();
  const results = query ? searchNavigator(index, query) : null;

  return (
    <main className="min-h-screen bg-zinc-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Navigator</p>
          <h1 className="text-xl font-semibold text-zinc-900">Search Figma</h1>
        </header>

        <form method="GET" className="flex gap-2">
          <label htmlFor="q" className="sr-only">Search modules, pages, or flows</label>
          <input
            id="q"
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search modules, pages, or flows..."
            className="w-full rounded-md border border-zinc-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            autoFocus
          />
          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700">
            Search
          </button>
        </form>

        {/* Counts summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <Count label="Modules" value={index.counts.modules} href="/modules" />
          <Count label="Pages" value={index.counts.pages} />
          <Count label="Flows" value={index.counts.flows} />
        </div>

        {!results ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Browse modules</h2>
              <Link href="/modules" className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline">All modules →</Link>
            </div>
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              {[...index.modules]
                .sort((a, b) => b.flowCount - a.flowCount || a.name.localeCompare(b.name))
                .slice(0, 10)
                .map((m) => (
                  <ResultRow
                    key={m.id}
                    type="module"
                    href={`/modules/${m.slug}`}
                    name={m.name}
                    context={`${m.pageCount} page${m.pageCount === 1 ? "" : "s"} · ${m.flowCount} flow${m.flowCount === 1 ? "" : "s"}`}
                    figmaUrl={m.fileUrl}
                    figmaLabel={`Open ${m.name} file in Figma`}
                  />
                ))}
            </ul>
          </section>
        ) : results.total === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No modules, pages, or flows found for “{query}”.
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-zinc-500">
              {results.total} result{results.total === 1 ? "" : "s"} for “{query}”
            </p>

            {results.modules.length > 0 && (
              <Group title={`Modules (${results.modules.length})`}>
                {results.modules.map((m) => (
                  <ResultRow
                    key={m.id}
                    type="module"
                    href={`/modules/${m.slug}`}
                    name={m.name}
                    context={`${m.pageCount} page${m.pageCount === 1 ? "" : "s"} · ${m.flowCount} flow${m.flowCount === 1 ? "" : "s"}`}
                    figmaUrl={m.fileUrl}
                    figmaLabel={`Open ${m.name} file in Figma`}
                  />
                ))}
              </Group>
            )}

            {results.pages.length > 0 && (
              <Group title={`Pages (${results.pages.length})`}>
                {results.pages.map((p) => (
                  <ResultRow
                    key={p.id}
                    type="page"
                    href={`/modules/${p.moduleSlug}/pages/${p.id}`}
                    name={p.name}
                    context={`${p.moduleName}${p.flowCount > 0 ? ` · ${p.flowCount} flow${p.flowCount === 1 ? "" : "s"}` : ""}`}
                    figmaUrl={p.pageUrl}
                    figmaLabel={`Open ${p.name} page in Figma`}
                  />
                ))}
              </Group>
            )}

            {results.flows.length > 0 && (
              <Group title={`Flows (${results.flows.length})`}>
                {results.flows.map((f) => (
                  <ResultRow
                    key={f.id}
                    type="flow"
                    href={`/flows/${f.id}`}
                    name={f.name}
                    context={`${f.moduleName} › ${f.pageName}`}
                    figmaUrl={f.figmaUrl}
                    figmaLabel={`Open ${f.name} in Figma`}
                  />
                ))}
              </Group>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Count({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <>
      <div className="text-lg font-semibold text-zinc-900">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border border-zinc-200 bg-white py-2 shadow-sm hover:border-zinc-400">
      {inner}
    </Link>
  ) : (
    <div className="rounded-lg border border-zinc-200 bg-white py-2 shadow-sm">{inner}</div>
  );
}
