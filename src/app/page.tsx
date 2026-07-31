"use client";

import { useMemo, useState } from "react";
import { FilterPanel } from "@/components/FilterPanel";
import { ScreenCard } from "@/components/ScreenCard";
import { searchScreens, type SearchFilters } from "@/lib/search";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});

  const results = useMemo(
    () => searchScreens(query, filters),
    [query, filters],
  );

  const clearFilters = () => {
    setFilters({});
    setQuery("");
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Figma Screen Navigator
          </h1>
          <p className="mt-1 text-zinc-600">
            Search approved Figma screens, states, scenarios, and component
            behaviors.
          </p>
        </header>

        <div className="space-y-2">
          <label className="sr-only" htmlFor="search">
            Search screens
          </label>
          <input
            id="search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. pension calculation retro early or contact accordion open"
            className="w-full rounded border border-zinc-300 px-4 py-3 text-lg shadow-sm"
          />
        </div>

        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={clearFilters}
          resultCount={results.length}
        />

        <section aria-label="Search results">
          {results.length === 0 ? (
            <p className="text-center text-zinc-500">No matching screens.</p>
          ) : (
            <div className="space-y-4">
              {results.map(({ screen }) => (
                <ScreenCard key={screen.id} screen={screen} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
