import { FilterPanel } from "@/components/FilterPanel";
import { ScreenCard } from "@/components/ScreenCard";
import { SearchBox } from "@/components/SearchBox";
import { requireAuth } from "@/lib/auth/session";
import { getFilterOptions, searchScreens } from "@/lib/data";
import { listVariantsByScreen } from "@/lib/repositories/screen-variants";
import type { SearchFilters } from "@/lib/search";

export const dynamic = "force-dynamic";

function stringOrUndefined(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  await requireAuth();
  const query = stringOrUndefined(params.q) ?? "";

  const filters: SearchFilters = {
    productId: stringOrUndefined(params.productId),
    moduleId: stringOrUndefined(params.moduleId),
    figmaPageId: stringOrUndefined(params.figmaPageId),
    breakpointId: stringOrUndefined(params.breakpointId),
    status: stringOrUndefined(params.status),
    behavior: stringOrUndefined(params.behavior),
    state: stringOrUndefined(params.state),
    scenario: stringOrUndefined(params.scenario),
  };

  const [screens, options] = await Promise.all([
    searchScreens(query, filters),
    getFilterOptions(),
  ]);

  const screensWithVariants = await Promise.all(
    screens.map(async (screen) => {
      const variants = await listVariantsByScreen(screen.id);
      const breakpoints = variants
        .map((v) => v.breakpointCode)
        .filter((c): c is string => Boolean(c));
      return { screen, breakpoints, variantCount: variants.length };
    }),
  );

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

        <SearchBox key={query} initialQuery={query} />

        <FilterPanel
          options={options}
          initialFilters={filters}
          resultCount={screens.length}
        />

        <section aria-label="Search results">
          {screens.length === 0 ? (
            <p className="text-center text-zinc-500">No matching screens.</p>
          ) : (
            <div className="space-y-4">
              {screensWithVariants.map(({ screen, breakpoints, variantCount }) => (
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
      </div>
    </main>
  );
}
