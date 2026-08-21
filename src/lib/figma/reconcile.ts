import {
  listModules,
  archiveModule,
  setModuleSlug,
  slugify,
} from "@/lib/repositories/modules";

export interface ReconcileResult {
  archived: { name: string; figmaFileKey: string }[];
  reslugged: { name: string; from: string; to: string }[];
}

/**
 * Reconcile module identity against the current Figma project:
 *  - Modules whose file key is NOT in the project are archived (non-destructive)
 *    and re-slugged so they release any canonical slug they were squatting.
 *  - Real (in-project) modules then reclaim their canonical name-slug; genuine
 *    same-name real files keep a deterministic file-key-suffixed slug.
 * Never deletes anything.
 */
export async function reconcileModules(
  projectFileKeys: Set<string>,
): Promise<ReconcileResult> {
  const result: ReconcileResult = { archived: [], reslugged: [] };

  // 1. Archive stale/orphan modules (not present in the current project).
  const before = await listModules();
  for (const m of before) {
    if (projectFileKeys.has(m.figmaFileKey)) continue;
    if (m.status !== "archived") {
      const parkSlug = `archived-${slugify(m.name, m.figmaFileKey)}-${m.figmaFileKey.slice(0, 6).toLowerCase()}`;
      await archiveModule(m.id, parkSlug);
      result.archived.push({ name: m.name, figmaFileKey: m.figmaFileKey });
    }
  }

  // 2. Reclaim canonical slugs for active in-project modules (deterministic by
  // creation order so genuine duplicate names resolve stably).
  const after = await listModules();
  const active = after
    .filter((m) => m.status !== "archived" && projectFileKeys.has(m.figmaFileKey))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  const claimed = new Set<string>();
  for (const m of active) {
    const base = slugify(m.name, m.figmaFileKey);
    let target: string;
    if (!claimed.has(base)) {
      target = base;
    } else {
      target = `${base}-${m.figmaFileKey.slice(0, 6).toLowerCase()}`;
    }
    claimed.add(target);
    if (m.slug !== target) {
      await setModuleSlug(m.id, target);
      result.reslugged.push({ name: m.name, from: m.slug, to: target });
    }
  }

  return result;
}
