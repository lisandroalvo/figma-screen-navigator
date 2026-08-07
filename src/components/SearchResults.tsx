"use client";

import { useTransition } from "react";
import { SearchBox } from "./SearchBox";
import { FilterPanel } from "./FilterPanel";
import { ScreenCard } from "./ScreenCard";
import type { Screen } from "@/types";
import type { SearchFilters } from "@/lib/search";

interface FilterOption {
  id: string;
  name: string;
}

interface SearchResultsProps {
  query: string;
  filters: SearchFilters;
  screens: Array<{
    screen: Screen;
    breakpoints: string[];
    variantCount: number;
  }>;
  options: {
    products: FilterOption[];
    modules: FilterOption[];
    pages: FilterOption[];
    breakpoints: FilterOption[];
    statuses: string[];
  };
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="h-4 w-3/4 rounded bg-zinc-200" />
      <div className="mt-2 h-3 w-1/2 rounded bg-zinc-200" />
      <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
        <div className="aspect-[4/3] rounded bg-zinc-200" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-zinc-200" />
          <div className="h-3 w-2/3 rounded bg-zinc-200" />
        </div>
      </div>
    </div>
  );
}

export function SearchResults({
  query,
  filters,
  screens,
  options,
}: SearchResultsProps) {
  const [isPending] = useTransition();

  return (
    <>
      <SearchBox initialQuery={query} isPending={isPending} />

      <FilterPanel
        options={options}
        initialFilters={filters}
        resultCount={screens.length}
        isPending={isPending}
      />

      <section aria-label="Search results" aria-busy={isPending}>
        {isPending ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : screens.length === 0 ? (
          <p className="text-center text-zinc-500">No matching screens.</p>
        ) : (
          <div className="space-y-4">
            {screens.map(({ screen, breakpoints, variantCount }) => (
              <ScreenCard
                key={screen.id}
                screen={screen}
                breakpoints={breakpoints}
                variantCount={variantCount}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
