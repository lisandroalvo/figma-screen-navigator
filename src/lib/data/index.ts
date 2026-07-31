import {
  breakpoints,
  figmaPages,
  modules,
  products,
  screenRelationships,
  screens,
} from "./mock";

export { breakpoints, figmaPages, modules, products, screenRelationships, screens };

export function getProductById(id: string) {
  return products.find((p) => p.id === id) ?? null;
}

export function getModuleById(id: string) {
  return modules.find((m) => m.id === id) ?? null;
}

export function getModuleBySlug(slug: string) {
  return modules.find((m) => m.slug === slug) ?? null;
}

export function getPageById(id: string) {
  return figmaPages.find((p) => p.id === id) ?? null;
}

export function getBreakpointById(id: string) {
  return breakpoints.find((b) => b.id === id) ?? null;
}

export function getScreenById(id: string) {
  return screens.find((s) => s.id === id) ?? null;
}

export function getScreensForModule(moduleId: string) {
  return screens.filter((s) => s.moduleId === moduleId);
}

export function getRelatedScreens(screenId: string) {
  const sourceRels = screenRelationships
    .filter((r) => r.sourceScreenId === screenId)
    .map((r) => ({ ...r, screen: getScreenById(r.targetScreenId) }))
    .filter((r) => r.screen);
  const targetRels = screenRelationships
    .filter((r) => r.targetScreenId === screenId)
    .map((r) => ({ ...r, screen: getScreenById(r.sourceScreenId) }))
    .filter((r) => r.screen);
  return [...sourceRels, ...targetRels];
}
