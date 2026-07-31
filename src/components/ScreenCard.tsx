import Link from "next/link";
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

export function ScreenCard({ screen }: { screen: Screen }) {
  const context = [screen.scenario, screen.option, screen.condition, screen.state, screen.behavior]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <Breadcrumb path={screen.parentPath} />
      <h3 className="mt-2 text-lg font-semibold text-zinc-900">
        {screen.displayName}
      </h3>
      {context && <p className="text-sm text-zinc-600">{context}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <span className="text-zinc-500">Module</span>
          <p className="font-medium text-zinc-900">{screen.parentPath[1]?.name}</p>
        </div>
        <div>
          <span className="text-zinc-500">Page</span>
          <p className="font-medium text-zinc-900">{screen.parentPath[2]?.name}</p>
        </div>
        <div>
          <span className="text-zinc-500">Breakpoint</span>
          <p className="font-medium text-zinc-900">{screen.parentPath[3]?.name}</p>
        </div>
        <div>
          <span className="text-zinc-500">Status</span>
          <p className="font-medium text-zinc-900">{statusLabel(screen.status)}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
        <PlaceholderPreview label={screen.displayName} />
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-zinc-500">
            Original: <span className="text-zinc-700">{screen.originalName}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/screens/${screen.id}`}
              className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              View details
            </Link>
            <span className="inline-flex items-center rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-400">
              Open in Figma (mock)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
