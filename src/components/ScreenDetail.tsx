import type { Screen } from "@/types";
import { Breadcrumb } from "./Breadcrumb";
import { PlaceholderPreview } from "./PlaceholderPreview";

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: "Draft",
    qa_ready: "QA Ready",
    deprecated: "Deprecated",
    archived: "Archived",
    missing_review: "Missing / Review",
  };
  return map[status] ?? status;
}

export function ScreenDetail({
  screen,
  relatedScreens,
}: {
  screen: Screen;
  relatedScreens: Screen[];
}) {
  const context = [
    screen.scenario,
    screen.option,
    screen.condition,
    screen.state,
    screen.behavior,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Breadcrumb path={screen.parentPath} />
      <h1 className="mt-4 text-3xl font-semibold text-zinc-900">
        {screen.displayName}
      </h1>
      {context && <p className="mt-1 text-lg text-zinc-600">{context}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <PlaceholderPreview label={screen.displayName} />
          <div className="mt-4 rounded border border-zinc-200 p-4">
            <h2 className="font-semibold text-zinc-900">Original Figma name</h2>
            <p className="mt-1 text-zinc-700">{screen.originalName}</p>
          </div>
          <div className="mt-4 rounded border border-zinc-200 p-4">
            <h2 className="font-semibold text-zinc-900">Figma URL</h2>
            <p className="mt-1 break-all text-sm text-zinc-500">
              {screen.figmaUrl}
            </p>
            <p className="text-xs text-zinc-400">
              (mock — not a live link yet)
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded border border-zinc-200 p-4">
            <h2 className="font-semibold text-zinc-900">Status</h2>
            <p className="text-zinc-700">{statusLabel(screen.status)}</p>
          </div>
          <div className="rounded border border-zinc-200 p-4">
            <h2 className="font-semibold text-zinc-900">Structured metadata</h2>
            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-2 text-sm">
              {screen.screen && (
                <>
                  <dt className="text-zinc-500">Screen</dt>
                  <dd className="text-zinc-900">{screen.screen}</dd>
                </>
              )}
              {screen.flow && (
                <>
                  <dt className="text-zinc-500">Flow</dt>
                  <dd className="text-zinc-900">{screen.flow}</dd>
                </>
              )}
              {screen.step && (
                <>
                  <dt className="text-zinc-500">Step</dt>
                  <dd className="text-zinc-900">{screen.step}</dd>
                </>
              )}
              {screen.scenario && (
                <>
                  <dt className="text-zinc-500">Scenario</dt>
                  <dd className="text-zinc-900">{screen.scenario}</dd>
                </>
              )}
              {screen.option && (
                <>
                  <dt className="text-zinc-500">Option</dt>
                  <dd className="text-zinc-900">{screen.option}</dd>
                </>
              )}
              {screen.condition && (
                <>
                  <dt className="text-zinc-500">Condition</dt>
                  <dd className="text-zinc-900">{screen.condition}</dd>
                </>
              )}
              {screen.behavior && (
                <>
                  <dt className="text-zinc-500">Behavior</dt>
                  <dd className="text-zinc-900">{screen.behavior}</dd>
                </>
              )}
              {screen.state && (
                <>
                  <dt className="text-zinc-500">State</dt>
                  <dd className="text-zinc-900">{screen.state}</dd>
                </>
              )}
            </dl>
          </div>
          {screen.keywords.length > 0 && (
            <div className="rounded border border-zinc-200 p-4">
              <h2 className="font-semibold text-zinc-900">Keywords</h2>
              <p className="mt-1 text-sm text-zinc-700">
                {screen.keywords.join(", ")}
              </p>
            </div>
          )}
          {screen.description && (
            <div className="rounded border border-zinc-200 p-4">
              <h2 className="font-semibold text-zinc-900">Description</h2>
              <p className="mt-1 text-sm text-zinc-700">{screen.description}</p>
            </div>
          )}
          {relatedScreens.length > 0 && (
            <div className="rounded border border-zinc-200 p-4">
              <h2 className="font-semibold text-zinc-900">Related screens</h2>
              <ul className="mt-2 space-y-2">
                {relatedScreens.map((s) => (
                  <li key={s.id} className="text-sm text-zinc-700">
                    {s.displayName}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {screen.ambiguityFlags.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-4">
              <h2 className="font-semibold text-amber-900">Ambiguity flags</h2>
              <ul className="mt-1 list-disc pl-4 text-sm text-amber-800">
                {screen.ambiguityFlags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
