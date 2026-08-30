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
        className="w-full rounded-md border border-primary/20 bg-surface px-3 py-2 text-sm text-primary shadow-sm placeholder:text-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-primary/15 bg-surface py-6 text-center text-sm text-primary/70 shadow-sm">
          No modules match “{q}”.
        </p>
      ) : (
        <ul className="divide-y divide-primary/10 overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
          {filtered.map((m) => (
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
      )}
    </div>
  );
}
