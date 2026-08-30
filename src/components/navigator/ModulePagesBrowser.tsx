"use client";

import { useState } from "react";
import Link from "next/link";

export interface PageRow {
  id: string;
  name: string;
  pageUrl: string;
  flowCount: number;
}

export default function ModulePagesBrowser({
  moduleSlug,
  pages,
}: {
  moduleSlug: string;
  pages: PageRow[];
}) {
  const [q, setQ] = useState("");
  const [onlyFlows, setOnlyFlows] = useState(false);
  const needle = q.trim().toLowerCase();
  const filtered = pages
    .filter((p) => (needle ? p.name.toLowerCase().includes(needle) : true))
    .filter((p) => (onlyFlows ? p.flowCount > 0 : true));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search pages..."
          aria-label="Search pages"
          className="w-full rounded-md border border-primary/20 bg-surface px-3 py-2 text-sm text-primary shadow-sm placeholder:text-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex shrink-0 overflow-hidden rounded-md border border-primary/30 text-sm">
          <button
            type="button"
            onClick={() => setOnlyFlows(false)}
            aria-pressed={!onlyFlows}
            className={`px-3 py-2 ${!onlyFlows ? "bg-primary text-white" : "bg-surface text-primary hover:bg-brandbg"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setOnlyFlows(true)}
            aria-pressed={onlyFlows}
            className={`border-l border-primary/30 px-3 py-2 ${onlyFlows ? "bg-primary text-white" : "bg-surface text-primary hover:bg-brandbg"}`}
          >
            Has flows
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-primary/15 bg-surface py-6 text-center text-sm text-primary/70 shadow-sm">
          No pages match{needle ? ` “${q}”` : ""}
          {onlyFlows ? " with flows" : ""}.
        </p>
      ) : (
        <ul className="divide-y divide-primary/10 overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
          {filtered.map((p) => (
            <li key={p.id} className="group flex items-center gap-2 pl-3 pr-2 hover:bg-brandbg">
              <Link
                href={`/modules/${moduleSlug}/pages/${p.id}`}
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
    </div>
  );
}
