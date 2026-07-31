import { getServerEnv } from "@/lib/env";
import * as db from "@/lib/repositories";
import * as mock from "./mock";
import * as localSearch from "@/lib/search";
import type { SearchFilters } from "@/lib/search";
import type {
  Breakpoint,
  FigmaPage,
  Module,
  Product,
  Screen,
} from "@/types";

function isDb() {
  return getServerEnv().DATA_SOURCE === "database";
}

// Products
export async function listProducts(): Promise<Product[]> {
  return isDb() ? db.listProducts() : mock.products;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return isDb()
    ? db.getProductBySlug(slug)
    : mock.products.find((p) => p.slug === slug) ?? null;
}

// Modules
export async function listModules(): Promise<Module[]> {
  return isDb() ? db.listModules() : mock.modules;
}

export async function getModuleBySlug(slug: string): Promise<Module | null> {
  return isDb()
    ? db.getModuleBySlug(slug)
    : mock.modules.find((m) => m.slug === slug) ?? null;
}

export async function listModulesWithCounts(): Promise<
  (Module & { screensCount: number })[]
> {
  return isDb()
    ? db.listModulesWithCounts()
    : mock.modules.map((m) => ({
        ...m,
        screensCount: mock.screens.filter((s) => s.moduleId === m.id).length,
      }));
}

// Figma pages
export async function listAllPages(): Promise<FigmaPage[]> {
  return isDb() ? db.listPages() : mock.figmaPages;
}

export async function listPagesByModule(
  moduleId: string,
): Promise<FigmaPage[]> {
  return isDb()
    ? db.listPagesByModule(moduleId)
    : mock.figmaPages.filter((p) => p.moduleId === moduleId);
}

export async function getPageById(id: string): Promise<FigmaPage | null> {
  return isDb()
    ? db.getPageById(id)
    : mock.figmaPages.find((p) => p.id === id) ?? null;
}

// Breakpoints
export async function listAllBreakpoints(): Promise<Breakpoint[]> {
  return isDb() ? db.listBreakpoints() : mock.breakpoints;
}

// Screens
export async function listScreens(): Promise<Screen[]> {
  return isDb() ? db.listScreens() : mock.screens;
}

export async function getScreenById(id: string): Promise<Screen | null> {
  return isDb() ? db.getScreenById(id) : mock.screens.find((s) => s.id === id) ?? null;
}

export async function listScreensByModule(
  moduleId: string,
): Promise<Screen[]> {
  return isDb()
    ? db.listScreensByModule(moduleId)
    : mock.screens.filter((s) => s.moduleId === moduleId);
}

export async function listRelatedScreens(screenId: string): Promise<Screen[]> {
  return isDb()
    ? db.listRelatedScreens(screenId)
    : mock.screenRelationships
        .flatMap((r) => {
          const otherId =
            r.sourceScreenId === screenId
              ? r.targetScreenId
              : r.targetScreenId === screenId
                ? r.sourceScreenId
                : null;
          return otherId ? [mock.screens.find((s) => s.id === otherId)] : [];
        })
        .filter((s): s is Screen => Boolean(s));
}

export async function listResponsiveVariants(
  screenId: string,
): Promise<Screen[]> {
  return isDb()
    ? db.listResponsiveVariants(screenId)
    : mock.screenRelationships
        .filter(
          (r) =>
            r.type === "responsive_variant" &&
            (r.sourceScreenId === screenId || r.targetScreenId === screenId),
        )
        .flatMap((r) => {
          const otherId =
            r.sourceScreenId === screenId ? r.targetScreenId : r.sourceScreenId;
          const screen = mock.screens.find((s) => s.id === otherId);
          return screen ? [screen] : [];
        });
}

export async function searchScreens(
  query: string,
  filters: SearchFilters = {},
): Promise<Screen[]> {
  if (isDb()) return db.searchScreens(query, filters);
  const results = localSearch.searchScreens(query, filters);
  return results.map((r) => r.screen);
}

export async function getFilterOptions() {
  const [products, modules, pages, breakpoints] = await Promise.all([
    listProducts(),
    listModules(),
    listAllPages(),
    listAllBreakpoints(),
  ]);
  return {
    products,
    modules,
    pages,
    breakpoints,
    statuses: ["draft", "qa_ready", "deprecated", "archived", "missing_review"],
  };
}
