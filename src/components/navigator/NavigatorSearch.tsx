"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { searchNavigator, type NavigatorIndex } from "@/lib/navigator-search";

type BadgeType = "module" | "page" | "flow" | "section" | "screen";

function TypeBadge({ type }: { type: BadgeType }) {
  return (
    <span className="mt-0.5 shrink-0 rounded border border-primary/20 bg-brandbg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      {type}
    </span>
  );
}

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

function ExternalRow({ type, name, context, figmaUrl, label, matched }: {
  type: BadgeType; name: string; context: string; figmaUrl: string; label: string; matched?: string | null;
}) {
  return (
    <li className="group hover:bg-brandbg">
      <a href={figmaUrl} target="_blank" rel="noreferrer" aria-label={label}
        className="flex items-start gap-3 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <TypeBadge type={type} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-primary">{name}</span>
          <span className="block truncate text-xs text-primary/60">{context}</span>
          {matched && (
            <span className="block truncate text-xs text-primary/45">Matched: {matched}</span>
          )}
        </span>
        <span className="mt-0.5 shrink-0 text-xs text-primary/70 group-hover:text-primary group-hover:underline">Figma ↗</span>
      </a>
    </li>
  );
}

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

/**
 * Scoped navigator search. `index` = data already loaded by the server for the
 * current level (module subtree / page subtree). `indexUrl` = lazy fetch (used
 * at the root so the home render never pays the global-index cost up front —
 * the index loads in the background on first focus/keystroke, then searches
 * run fully client-side).
 *
 * With no query, `children` (the level's default browse list) renders instead.
 */
export default function NavigatorSearch({
  index,
  indexUrl,
  placeholder = "Search...",
  scopeLabel,
  children,
}: {
  index?: NavigatorIndex;
  indexUrl?: string;
  placeholder?: string;
  scopeLabel?: string;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [lazyIndex, setLazyIndex] = useState<NavigatorIndex | null>(index ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inflight = useRef<Promise<NavigatorIndex> | null>(null);
  const trimmed = query.trim();

  // Prefetch the global index as soon as the page mounts (idle browser time),
  // so the first keystroke already searches in-memory instead of waiting ~5s
  // for the ~1.5MB index fetch. Only applies when indexUrl is used (root).
  useEffect(() => {
    if (!indexUrl || lazyIndex) return;
    const t = setTimeout(ensureIndex, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexUrl]);

  function ensureIndex() {
    if (lazyIndex || inflight.current || !indexUrl) return;
    setLoading(true);
    inflight.current = fetch(indexUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`index ${r.status}`);
        return r.json() as Promise<NavigatorIndex>;
      })
      .then((data) => {
        setLazyIndex(data);
        setLoading(false);
        return data;
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
        inflight.current = null;
        throw new Error("index fetch failed");
      });
    inflight.current.catch(() => {});
  }

  const results = useMemo(
    () => (trimmed && lazyIndex ? searchNavigator(lazyIndex, trimmed) : null),
    [trimmed, lazyIndex],
  );

  return (
    <div className="space-y-4">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="nav-q" className="sr-only">{placeholder}</label>
        <input
          id="nav-q"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={ensureIndex}
          onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
          placeholder={placeholder}
          className="w-full rounded-md border border-primary/20 bg-surface px-3.5 py-2.5 text-sm text-primary shadow-sm placeholder:text-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          autoComplete="off"
        />
      </form>

      {trimmed && !lazyIndex && loading && (
        <p className="rounded-lg border border-primary/15 bg-surface py-6 text-center text-sm text-primary/60 shadow-sm">
          Loading search index…
        </p>
      )}
      {trimmed && failed && (
        <p className="rounded-lg border border-red-300 bg-red-50 py-6 text-center text-sm text-red-700 shadow-sm">
          Search index failed to load. Try again.
        </p>
      )}

      {!trimmed && children}

      {results && (
        results.total === 0 ? (
          <p className="rounded-lg border border-primary/15 bg-surface py-8 text-center text-sm text-primary/70 shadow-sm">
            Nothing found for “{trimmed}”{scopeLabel ? ` in ${scopeLabel}` : ""}.
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-primary/60">
              {results.total} result{results.total === 1 ? "" : "s"} for “{trimmed}”
              {scopeLabel ? ` in ${scopeLabel}` : ""}
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
                    matched={s.matched}
                    figmaUrl={s.figmaUrl} label={`Open screen ${s.name} in Figma`} />
                )} />
            )}
          </div>
        )
      )}
    </div>
  );
}
