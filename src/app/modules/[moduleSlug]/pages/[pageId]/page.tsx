import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageScope, listAllCurrentPageParams } from "@/lib/navigator-scoped";
import NavigatorSearch from "@/components/navigator/NavigatorSearch";

// Prerender every page detail at build → CDN-cached HTML (~100ms TTFB).
// New/uncached paths still render on demand (dynamicParams default).
export async function generateStaticParams() {
  try {
    return await listAllCurrentPageParams();
  } catch {
    return [];
  }
}

// ISR: rendered HTML is cached and served near-instantly; busted every 300s
// or on-demand via POST /api/revalidate after a Figma re-index.
export const revalidate = 300;
// Run near the Supabase project (ap-southeast-1) — DB RTT dominates latency.
export const preferredRegion = "sin1";

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ moduleSlug: string; pageId: string }>;
}) {
  const { moduleSlug, pageId } = await params;
  const scope = await getPageScope(moduleSlug, pageId);
  if (!scope) notFound();

  const { module: mod, page, index } = scope;
  const flows = [...index.flows].sort((a, b) => a.name.localeCompare(b.name));
  const sections = [...index.sections].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen bg-brandbg p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <nav className="text-sm text-primary/60">
          <Link href="/" className="text-primary/70 hover:text-primary hover:underline">
            Navigator
          </Link>
          <span className="mx-1 text-primary/40">›</span>
          <Link href={`/modules/${mod.slug}`} className="text-primary/70 hover:text-primary hover:underline">
            {mod.name}
          </Link>
          <span className="mx-1 text-primary/40">›</span>
          <span className="font-semibold text-primary">{page.name}</span>
        </nav>

        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-primary">{page.name}</h1>
            <p className="text-sm text-primary/60">
              {flows.length} flow{flows.length === 1 ? "" : "s"} · {sections.length} section{sections.length === 1 ? "" : "s"} · {index.screens.length} screen{index.screens.length === 1 ? "" : "s"}
            </p>
          </div>
          {page.pageUrl && (
            <a
              href={page.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-primary bg-surface px-3 py-1.5 text-sm text-primary hover:bg-brandbg"
            >
              Open Page in Figma ↗
            </a>
          )}
        </header>

        <NavigatorSearch
          index={index}
          placeholder={`Search in ${page.name}…`}
          scopeLabel={page.name}
        >
          <div className="space-y-5">
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">
                Flow sections
              </h2>
              {flows.length === 0 ? (
                <p className="rounded-lg border border-primary/15 bg-surface p-4 text-sm text-primary/70 shadow-sm">
                  No Flow sections on this Page.
                </p>
              ) : (
                <ul className="divide-y divide-primary/10 overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
                  {flows.map((f) => (
                    <li key={f.id} className="group hover:bg-brandbg">
                      <a
                        href={f.figmaUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${f.name} in Figma`}
                        className="flex items-center gap-3 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="shrink-0 rounded border border-primary/20 bg-brandbg px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                          Flow
                        </span>
                        <span className="flex-1 truncate text-sm font-medium text-primary">
                          {f.name}
                        </span>
                        <span className="shrink-0 text-xs text-primary/70 group-hover:text-primary group-hover:underline">Figma ↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {sections.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Sections
                </h2>
                <ul className="divide-y divide-primary/10 overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
                  {sections.map((s) => (
                    <li key={s.id} className="group hover:bg-brandbg">
                      <a
                        href={s.figmaUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${s.name} section in Figma`}
                        className="flex items-center gap-3 px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="shrink-0 rounded border border-primary/20 bg-brandbg px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                          Section
                        </span>
                        <span className="flex-1 truncate text-sm font-medium text-primary">
                          {s.name}
                          {s.parentName ? (
                            <span className="text-xs text-primary/50"> · {s.parentName}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs text-primary/70 group-hover:text-primary group-hover:underline">Figma ↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </NavigatorSearch>
      </div>
    </main>
  );
}
