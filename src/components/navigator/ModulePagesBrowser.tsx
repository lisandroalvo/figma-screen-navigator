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
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
        />
        <div className="flex shrink-0 overflow-hidden rounded-md border border-zinc-300 text-sm">
          <button
            type="button"
            onClick={() => setOnlyFlows(false)}
            aria-pressed={!onlyFlows}
            className={`px-3 py-2 ${!onlyFlows ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setOnlyFlows(true)}
            aria-pressed={onlyFlows}
            className={`px-3 py-2 ${onlyFlows ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
          >
            Has flows
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          No pages match{needle ? ` “${q}”` : ""}
          {onlyFlows ? " with flows" : ""}.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          {filtered.map((p) => (
            <li key={p.id} className="group flex items-center gap-2 pl-3 pr-2 hover:bg-zinc-50">
              <Link
                href={`/modules/${moduleSlug}/pages/${p.id}`}
                className="flex flex-1 items-center gap-3 rounded py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <span className="flex-1 truncate text-sm font-medium text-zinc-900">
                  {p.name}
                </span>
                {p.flowCount > 0 ? (
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                    {p.flowCount} flow{p.flowCount === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-zinc-400">0 flows</span>
                )}
                <span className="shrink-0 text-zinc-400 group-hover:text-zinc-700">→</span>
              </Link>
              {p.pageUrl && (
                <a
                  href={p.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${p.name} page in Figma`}
                  className="shrink-0 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
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
