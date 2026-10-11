import Link from "next/link";
import { notFound } from "next/navigation";
import { getModuleScope, getGlobalModuleList } from "@/lib/navigator-scoped";
import NavigatorSearch from "@/components/navigator/NavigatorSearch";
import BackNav from "@/components/navigator/BackNav";

// Prerender every module page at build → CDN-cached HTML (~100ms TTFB).
// New/uncached paths still render on demand (dynamicParams default).
export async function generateStaticParams() {
  try {
    const { modules } = await getGlobalModuleList();
    return modules.map((m) => ({ moduleSlug: m.slug }));
  } catch {
    return [];
  }
}

// ISR: rendered HTML is cached and served near-instantly; busted every 300s
// or on-demand via POST /api/revalidate after a Figma re-index.
export const revalidate = 300;
// Run near the Supabase project (ap-southeast-1) — DB RTT dominates latency.
export const preferredRegion = "sin1";

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ moduleSlug: string }>;
}) {
  const { moduleSlug } = await params;
  const scope = await getModuleScope(moduleSlug);
  if (!scope) notFound();

  const { module: mod, index } = scope;
  const pages = [...index.pages].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen bg-brandbg p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <BackNav fallback="/" label="modules" />
          <nav className="text-sm text-primary/60">
            <Link href="/" className="text-primary/70 hover:text-primary hover:underline">
              Navigator
            </Link>
            <span className="mx-1 text-primary/40">›</span>
            <span className="font-semibold text-primary">{mod.name}</span>
          </nav>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-primary">{mod.name}</h1>
            <p className="text-sm text-primary/60">
              {pages.length} page{pages.length === 1 ? "" : "s"} · {index.flows.length} flow{index.flows.length === 1 ? "" : "s"}
            </p>
          </div>
          <a
            href={mod.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-primary bg-surface px-3 py-1.5 text-sm text-primary hover:bg-brandbg"
          >
            Open File in Figma ↗
          </a>
        </header>

        <NavigatorSearch
          index={index}
          placeholder={`Search in ${mod.name}…`}
          scopeLabel={mod.name}
        >
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">
              Pages
            </h2>
            {pages.length === 0 ? (
              <p className="rounded-lg border border-primary/15 bg-surface p-4 text-sm text-primary/70 shadow-sm">
                No pages on this module.
              </p>
            ) : (
              <ul className="divide-y divide-primary/10 overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
                {pages.map((p) => (
                  <li key={p.id} className="group flex items-center gap-2 pl-3 pr-2 hover:bg-brandbg">
                    <Link
                      href={`/modules/${mod.slug}/pages/${p.id}`}
                      prefetch
                      className="flex flex-1 items-center gap-3 rounded py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="flex-1 truncate text-sm font-medium text-primary">
                        {p.name}
                      </span>
                      {p.flowCount > 0 ? (
                        <span className="shrink-0 rounded border border-primary/20 bg-brandbg px-1.5 py-0.5 text-xs font-medium text-primary">
                          {p.flowCount} flow{p.flowCount === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-primary/40">0 flows</span>
                      )}
                      <span className="shrink-0 text-primary/50 group-hover:text-primary">→</span>
                    </Link>
                    {p.pageUrl && (
                      <a
                        href={p.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${p.name} page in Figma`}
                        className="shrink-0 rounded px-2 py-1 text-xs text-primary/70 hover:bg-brandbg hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Figma ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </NavigatorSearch>
      </div>
    </main>
  );
}
