import Link from "next/link";
import { getGlobalModuleList } from "@/lib/navigator-scoped";
import NavigatorSearch from "@/components/navigator/NavigatorSearch";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Cheap: aggregate counts + module rows only. The full search index (~2,700
  // rows) is fetched lazily by the client on first search input.
  const { modules, counts } = await getGlobalModuleList();

  return (
    <main className="min-h-screen bg-brandbg p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/60">
            Navigator
          </p>
          <h1 className="text-xl font-semibold text-primary">Search Figma</h1>
          <p className="mt-1 text-sm text-primary/60">
            {counts.modules} modules · {counts.pages} pages · {counts.flows} flows
          </p>
        </header>

        <NavigatorSearch
          indexUrl="/api/navigator-index"
          placeholder="Search modules, pages, flows, sections, screens..."
        >
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">
              Modules
            </h2>
            <ul className="divide-y divide-primary/10 overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
              {modules.map((m) => (
                <li key={m.id} className="group flex items-center gap-2 pl-3 pr-2 hover:bg-brandbg">
                  <Link
                    href={`/modules/${m.slug}`}
                    className="flex flex-1 items-center gap-3 rounded py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex-1 truncate text-sm font-medium text-primary">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-xs text-primary/60">
                      {m.pageCount} page{m.pageCount === 1 ? "" : "s"} · {m.flowCount} flow{m.flowCount === 1 ? "" : "s"}
                    </span>
                    <span className="shrink-0 text-primary/50 group-hover:text-primary">→</span>
                  </Link>
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${m.name} file in Figma`}
                    className="shrink-0 rounded px-2 py-1 text-xs text-primary/70 hover:bg-brandbg hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Figma ↗
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </NavigatorSearch>
      </div>
    </main>
  );
}
