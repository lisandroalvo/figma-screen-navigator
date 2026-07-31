"use client";

import type { SearchFilters } from "@/lib/search";
import { getFilterOptions } from "@/lib/search";

interface FilterPanelProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onClear: () => void;
  resultCount: number;
}

export function FilterPanel({
  filters,
  onChange,
  onClear,
  resultCount,
}: FilterPanelProps) {
  const { products, modules, pages, breakpoints, statuses } = getFilterOptions();

  const update = (key: keyof SearchFilters, value: string) => {
    onChange({ ...filters, [key]: value === "" ? undefined : value });
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900">Filters</h2>
        <span className="text-sm text-zinc-500">{resultCount} results</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Product</span>
          <select
            value={filters.productId ?? ""}
            onChange={(e) => update("productId", e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Module</span>
          <select
            value={filters.moduleId ?? ""}
            onChange={(e) => update("moduleId", e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5"
          >
            <option value="">All modules</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Page</span>
          <select
            value={filters.figmaPageId ?? ""}
            onChange={(e) => update("figmaPageId", e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5"
          >
            <option value="">All pages</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Breakpoint</span>
          <select
            value={filters.breakpointId ?? ""}
            onChange={(e) => update("breakpointId", e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5"
          >
            <option value="">All breakpoints</option>
            {breakpoints.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Status</span>
          <select
            value={filters.status ?? ""}
            onChange={(e) => update("status", e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Behavior</span>
          <input
            type="text"
            value={filters.behavior ?? ""}
            onChange={(e) => update("behavior", e.target.value)}
            placeholder="e.g. Tooltip, Modal"
            className="rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">State</span>
          <input
            type="text"
            value={filters.state ?? ""}
            onChange={(e) => update("state", e.target.value)}
            placeholder="e.g. Open, Empty"
            className="rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Scenario</span>
          <input
            type="text"
            value={filters.scenario ?? ""}
            onChange={(e) => update("scenario", e.target.value)}
            placeholder="e.g. 50% J&S"
            className="rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
      </div>
      <button
        onClick={onClear}
        className="mt-3 text-sm text-zinc-600 underline hover:text-zinc-900"
      >
        Clear all filters
      </button>
    </div>
  );
}
