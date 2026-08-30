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
    <main className="min-h-screen bg-brandbg p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Breadcrumb */}
        <nav className="text-sm text-primary/60">
          <Link href="/modules" className="text-primary/70 hover:text-primary hover:underline">
            Modules
          </Link>
          <span className="mx-1 text-primary/40">›</span>
          <Link href={`/modules/${moduleSlug}`} className="text-primary/70 hover:text-primary hover:underline">
            {page.moduleName}
          </Link>
          <span className="mx-1 text-primary/40">›</span>
          <span className="font-semibold text-primary">{page.name}</span>
        </nav>

        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-primary">{page.name}</h1>
            <p className="text-sm text-primary/60">
              {flows.length} flow{flows.length === 1 ? "" : "s"}
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
              {/* Interactive prototype hidden for now: the Flow row opens the
                  exact Figma SECTION rather than launching the FlowPlayer. The
                  /flows/[id] route and its data remain intact, just not linked. */}
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
      </div>
    </main>
  );
}
