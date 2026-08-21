"use client";

import { useState } from "react";
import Link from "next/link";

export interface ModuleRow {
  id: string;
  slug: string;
  name: string;
  fileUrl: string;
  pageCount: number;
  flowCount: number;
}

export default function ModulesBrowser({ modules }: { modules: ModuleRow[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? modules.filter((m) => m.name.toLowerCase().includes(needle))
    : modules;

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search modules..."
        aria-label="Search modules"
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
      />
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          No modules match “{q}”.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          {filtered.map((m) => (
            <li key={m.id} className="group flex items-center gap-2 pl-3 pr-2 hover:bg-zinc-50">
              <Link
                href={`/modules/${m.slug}`}
                className="flex flex-1 items-center gap-3 rounded py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <span className="flex-1 truncate text-sm font-medium text-zinc-900">
                  {m.name}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {m.pageCount} page{m.pageCount === 1 ? "" : "s"} · {m.flowCount} flow{m.flowCount === 1 ? "" : "s"}
                </span>
                <span className="shrink-0 text-zinc-400 group-hover:text-zinc-700">→</span>
              </Link>
              <a
                href={m.fileUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${m.name} file in Figma`}
                className="shrink-0 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Figma ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
