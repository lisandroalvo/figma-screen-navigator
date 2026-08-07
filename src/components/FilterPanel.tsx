"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { SearchFilters } from "@/lib/search";

interface FilterOption {
  id: string;
  name: string;
}

interface FilterPanelProps {
  options: {
    products: FilterOption[];
    modules: FilterOption[];
    pages: FilterOption[];
    breakpoints: FilterOption[];
    statuses: string[];
  };
  initialFilters: SearchFilters;
  resultCount: number;
  isPending: boolean;
}

export function FilterPanel({
  options,
  initialFilters,
  resultCount,
  isPending,
}: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      startTransition(() => {
        router.replace(`?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams],
  );

  const getValue = (key: keyof SearchFilters) =>
    (searchParams.get(key) ?? initialFilters[key] ?? "").toString();

  const clear = () => {
    const params = new URLSearchParams(searchParams.toString());
    [
      "productId",
      "moduleId",
      "figmaPageId",
      "breakpointId",
      "status",
      "behavior",
      "state",
      "scenario",
    ].forEach((key) => params.delete(key));
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900">Filters</h2>
        <span className="text-sm text-zinc-500">{resultCount} results</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectFilter
          label="Product"
          name="productId"
          value={getValue("productId")}
          onChange={(value) => update({ productId: value })}
          options={options.products}
          allLabel="All products"
          disabled={isPending}
        />
        <SelectFilter
          label="Module"
          name="moduleId"
          value={getValue("moduleId")}
          onChange={(value) => update({ moduleId: value })}
          options={options.modules}
          allLabel="All modules"
          disabled={isPending}
        />
        <SelectFilter
          label="Page"
          name="figmaPageId"
          value={getValue("figmaPageId")}
          onChange={(value) => update({ figmaPageId: value })}
          options={options.pages}
          allLabel="All pages"
          disabled={isPending}
        />
        <SelectFilter
          label="Breakpoint"
          name="breakpointId"
          value={getValue("breakpointId")}
          onChange={(value) => update({ breakpointId: value })}
          options={options.breakpoints}
          allLabel="All breakpoints"
          disabled={isPending}
        />
        <SelectFilter
          label="Status"
          name="status"
          value={getValue("status")}
          onChange={(value) => update({ status: value })}
          options={options.statuses.map((s) => ({ id: s, name: s }))}
          allLabel="All statuses"
          disabled={isPending}
        />
        <TextFilter
          label="Behavior"
          name="behavior"
          value={getValue("behavior")}
          onChange={(value) => update({ behavior: value })}
          placeholder="e.g. Tooltip, Modal"
          disabled={isPending}
        />
        <TextFilter
          label="State"
          name="state"
          value={getValue("state")}
          onChange={(value) => update({ state: value })}
          placeholder="e.g. Open, Empty"
          disabled={isPending}
        />
        <TextFilter
          label="Scenario"
          name="scenario"
          value={getValue("scenario")}
          onChange={(value) => update({ scenario: value })}
          placeholder="e.g. 50% J&S"
          disabled={isPending}
        />
      </div>
      <button
        onClick={clear}
        disabled={isPending}
        className="mt-3 text-sm text-zinc-600 underline hover:text-zinc-900 disabled:opacity-50"
      >
        Clear all filters
      </button>
    </div>
  );
}

function SelectFilter({
  label,
  name,
  value,
  onChange,
  options,
  allLabel,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel: string;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded border border-zinc-300 px-2 py-1.5 disabled:opacity-50"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextFilter({
  label,
  name,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="rounded border border-zinc-300 px-2 py-1.5 disabled:opacity-50"
      />
    </label>
  );
}
