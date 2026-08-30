"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { searchNavigator, type NavigatorIndex } from "@/lib/navigator-search";

type BadgeType = "module" | "page" | "flow" | "section" | "screen";

/** Entity badges share ONE brand family; the label communicates the type. */
function TypeBadge({ type }: { type: BadgeType }) {
  return (
    <span className="mt-0.5 shrink-0 rounded border border-primary/20 bg-brandbg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      {type}
    </span>
  );
}

/** Row with an internal navigation link + a secondary "Figma ↗" (modules/pages). */
function LinkRow({ type, href, name, context, figmaUrl, figmaLabel }: {
  type: BadgeType; href: string; name: string; context: string; figmaUrl: string; figmaLabel: string;
}) {
  return (
    <li className="group flex items-center gap-2 pl-3 pr-2 hover:bg-brandbg">
      <Link href={href} className="flex min-w-0 flex-1 items-start gap-3 rounded py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <TypeBadge type={type} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-primary">{name}</span>
          <span className="block truncate text-xs text-primary/60">{context}</span>
        </span>
        <span className="mt-0.5 shrink-0 text-primary/50 group-hover:text-primary">→</span>
      </Link>
      <a href={figmaUrl} target="_blank" rel="noreferrer" aria-label={figmaLabel}
        className="shrink-0 rounded px-2 py-1 text-xs text-primary/70 hover:bg-brandbg hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        Figma ↗
      </a>
    </li>
  );
}

/**
 * Row whose whole primary action opens the EXACT Figma node in a new tab. Used
 * for Flows (Figma SECTION) and Screens while the interactive prototype is
 * hidden — there is no link into the FlowPlayer here.
 */
function ExternalRow({ type, name, context, figmaUrl, label }: {
  type: BadgeType; name: string; context: string; figmaUrl: string; label: string;
}) {
  return (
    <li className="group hover:bg-brandbg">
      <a href={figmaUrl} target="_blank" rel="noreferrer" aria-label={label}
        className="flex items-start gap-3 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <TypeBadge type={type} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-primary">{name}</span>
          <span className="block truncate text-xs text-primary/60">{context}</span>
        </span>
        <span className="mt-0.5 shrink-0 text-xs text-primary/70 group-hover:text-primary group-hover:underline">Figma ↗</span>
      </a>
    </li>
  );
}

/**
 * Grouped results with progressive disclosure: renders the top `limit` matches
 * and a "Show N more" toggle. The heading keeps the FULL match count, and the
 * underlying searchable dataset is never truncated — only the DOM is limited so
 * broad queries (hover=187, modal=336) stay usable.
 */
function ResultGroup<T extends { id: string }>({
  title, items, render, limit = 20,
}: {
  title: string; items: T[]; render: (item: T) => React.ReactNode; limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, limit);
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</h2>
      <ul className="divide-y divide-primary/10 overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
        {shown.map(render)}
      </ul>
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded px-2 py-1 text-xs font-medium text-primary/70 hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {expanded ? "Show less" : `Show ${items.length - limit} more`}
        </button>
      )}
    </section>
  );
}

function Count({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <>
      <div className="text-lg font-semibold text-primary">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-primary/60">{label}</div>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border border-primary/15 bg-surface py-2 shadow-sm hover:border-primary/50">{inner}</Link>
  ) : (
    <div className="rounded-lg border border-primary/15 bg-surface py-2 shadow-sm">{inner}</div>
  );
}

export default function HomeSearch({ index }: { index: NavigatorIndex }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  // Client-side, in-memory filtering: the whole index is already loaded, so
  // results recompute synchronously on every keystroke (no Enter, no request,
  // no debounce, no loading flash, no stale-response races).
  const results = useMemo(
    () => (trimmed ? searchNavigator(index, trimmed) : null),
    [trimmed, index],
  );

  const topModules = useMemo(
    () => [...index.modules].sort((a, b) => b.flowCount - a.flowCount || a.name.localeCompare(b.name)).slice(0, 10),
    [index.modules],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/60">Navigator</p>
        <h1 className="text-xl font-semibold text-primary">Search Figma</h1>
      </header>

      {/* No submit needed — results update as you type. */}
      <form role="search" onSubmit={(e) => e.preventDefault()} className="flex gap-2">
        <label htmlFor="q" className="sr-only">Search modules, pages, flows, or screens</label>
        <input
          id="q"
          type="text"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
          placeholder="Search modules, pages, flows, or screens..."
          className="w-full rounded-md border border-primary/20 bg-surface px-3.5 py-2.5 text-sm text-primary shadow-sm placeholder:text-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          autoFocus
          autoComplete="off"
        />
      </form>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Count label="Modules" value={index.counts.modules} href="/modules" />
        <Count label="Pages" value={index.counts.pages} />
        <Count label="Flows" value={index.counts.flows} />
      </div>

      {!results ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">Browse modules</h2>
            <Link href="/modules" className="text-sm text-primary/70 hover:text-primary hover:underline">All modules →</Link>
          </div>
          <ul className="divide-y divide-primary/10 overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
            {topModules.map((m) => (
              <LinkRow key={m.id} type="module" href={`/modules/${m.slug}`} name={m.name}
                context={`${m.pageCount} page${m.pageCount === 1 ? "" : "s"} · ${m.flowCount} flow${m.flowCount === 1 ? "" : "s"}`}
                figmaUrl={m.fileUrl} figmaLabel={`Open ${m.name} file in Figma`} />
            ))}
          </ul>
        </section>
      ) : results.total === 0 ? (
        <p className="rounded-lg border border-primary/15 bg-surface py-8 text-center text-sm text-primary/70 shadow-sm">
          No modules, pages, flows, sections, or screens found for “{trimmed}”.
        </p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-primary/60">
            {results.total} result{results.total === 1 ? "" : "s"} for “{trimmed}”
          </p>

          {results.modules.length > 0 && (
            <ResultGroup title={`Modules (${results.modules.length})`} items={results.modules}
              render={(m) => (
                <LinkRow key={m.id} type="module" href={`/modules/${m.slug}`} name={m.name}
                  context={`${m.pageCount} page${m.pageCount === 1 ? "" : "s"} · ${m.flowCount} flow${m.flowCount === 1 ? "" : "s"}`}
                  figmaUrl={m.fileUrl} figmaLabel={`Open ${m.name} file in Figma`} />
              )} />
          )}

          {results.pages.length > 0 && (
            <ResultGroup title={`Pages (${results.pages.length})`} items={results.pages}
              render={(p) => (
                <LinkRow key={p.id} type="page" href={`/modules/${p.moduleSlug}/pages/${p.id}`} name={p.name}
                  context={`${p.moduleName}${p.flowCount > 0 ? ` · ${p.flowCount} flow${p.flowCount === 1 ? "" : "s"}` : ""}`}
                  figmaUrl={p.pageUrl} figmaLabel={`Open ${p.name} page in Figma`} />
              )} />
          )}

          {results.flows.length > 0 && (
            <ResultGroup title={`Flows (${results.flows.length})`} items={results.flows}
              render={(f) => (
                <ExternalRow key={f.id} type="flow" name={f.name}
                  context={`${f.moduleName} › ${f.pageName}`}
                  figmaUrl={f.figmaUrl} label={`Open ${f.name} in Figma`} />
              )} />
          )}

          {results.sections.length > 0 && (
            <ResultGroup title={`Sections (${results.sections.length})`} items={results.sections}
              render={(s) => (
                <ExternalRow key={s.id} type="section" name={s.name}
                  context={`${s.moduleName} › ${s.pageName}${s.parentName ? ` › ${s.parentName}` : ""}`}
                  figmaUrl={s.figmaUrl} label={`Open section ${s.name} in Figma`} />
              )} />
          )}

          {results.screens.length > 0 && (
            <ResultGroup title={`Screens (${results.screens.length})`} items={results.screens}
              render={(s) => (
                <ExternalRow key={s.id} type="screen" name={s.name}
                  context={`${s.moduleName} › ${s.pageName}${s.parentName ? ` › ${s.parentName}` : ""}`}
                  figmaUrl={s.figmaUrl} label={`Open screen ${s.name} in Figma`} />
              )} />
          )}
        </div>
      )}
    </div>
  );
}
