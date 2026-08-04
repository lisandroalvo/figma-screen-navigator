import Link from "next/link";
import { notFound } from "next/navigation";
import { getSyncJobById } from "@/lib/repositories/sync-jobs";
import { listProposedChangesByJob } from "@/lib/repositories/proposed-changes";

const FILTER_OPTIONS = ["all", "high", "medium", "low", "rejected", "missing"];

export default async function SyncJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ confidence?: string }>;
}) {
  const { jobId } = await params;
  const { confidence } = await searchParams;
  const job = await getSyncJobById(jobId);
  if (!job) notFound();

  const allChanges = await listProposedChangesByJob(jobId);

  const changes =
    confidence && confidence !== "all" && confidence !== "missing"
      ? allChanges.filter((c) => {
          const after = (c.after as Record<string, unknown>) ?? {};
          return after.confidence === confidence;
        })
      : confidence === "missing"
        ? allChanges.filter((c) => c.action === "missing")
        : allChanges;

  const counts = allChanges.reduce(
    (acc, c) => {
      acc[c.action] = (acc[c.action] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const confidenceCounts = allChanges.reduce(
    (acc, c) => {
      const after = (c.after as Record<string, unknown>) ?? {};
      const key = (after.confidence as string) ?? "missing";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const preview = changes.slice(0, 50);

  const active = confidence ?? "all";

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Internal prototype — authentication not yet enabled
        </div>

        <div className="mb-4">
          <Link
            href="/admin/sync"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← All scans
          </Link>
        </div>

        <header>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Sync {job.startedAt.toISOString()}
          </h1>
          <p className="mt-1 text-zinc-600">Status: {job.status}</p>
        </header>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-zinc-900">
            Proposed changes
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(counts).map(([action, n]) => (
              <div
                key={action}
                className="rounded bg-white p-3 text-center shadow-sm"
              >
                <div className="text-2xl font-semibold">{n}</div>
                <div className="text-sm text-zinc-500">{action}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-zinc-900">
            Confidence distribution
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            {Object.entries(confidenceCounts).map(([conf, n]) => (
              <div
                key={conf}
                className="rounded bg-white p-3 text-center shadow-sm"
              >
                <div className="text-2xl font-semibold">{n}</div>
                <div className="text-sm text-zinc-500">{conf}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-zinc-900">
            Filter by confidence
          </h2>
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((conf) => (
              <Link
                key={conf}
                href={`/admin/sync/${jobId}?confidence=${conf}`}
                className={`rounded px-4 py-2 text-sm font-medium ${
                  active === conf
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {conf}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-zinc-900">
            Preview ({preview.length} of {changes.length})
          </h2>
          <ul className="space-y-2">
            {preview.map((change) => {
              const after = (change.after as Record<string, unknown>) ?? {};
              const before = (change.before as Record<string, unknown>) ?? null;
              const conf = (after.confidence as string) ?? "missing";
              const figmaUrl =
                (after.figmaUrl as string) ??
                `https://www.figma.com/design/${after.fileKey}?node-id=${(after.id as string)?.replace(":", "-")}`;
              const reasonText =
                conf === "missing"
                  ? (before?.figmaNodeId as string) ?? ""
                  : (after.rejectionReasons as string[])?.join("; ") ??
                    (after.detectionReasons as string[])?.join("; ") ??
                    "";
              return (
                <li
                  key={change.id}
                  className="rounded bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-block rounded bg-zinc-200 px-2 py-0.5 text-sm font-medium">
                          {change.action}
                        </span>
                        <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-sm font-medium text-zinc-700">
                          {conf}
                          {after.confidenceScore !== undefined
                            ? ` (${after.confidenceScore})`
                            : ""}
                        </span>
                      </div>
                      <h3 className="mt-1 font-medium text-zinc-900">
                        {(after.displayName as string) ??
                          (after.originalName as string) ??
                          (before?.originalName as string) ??
                          "Unknown"}
                      </h3>
                      <p className="text-sm text-zinc-500">
                        {(after.pageName as string) ??
                          (before?.figmaPageNodeId as string) ??
                          "?"}{" "}
                        {(after.breakpointCode as string)
                          ? `· ${after.breakpointCode as string}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {after.width !== undefined
                          ? `w:${after.width} h:${after.height}`
                          : ""}
                        {after.depth !== undefined
                          ? ` · depth ${after.depth}`
                          : ""}
                      </p>
                      {reasonText && (
                        <p className="mt-1 text-xs text-zinc-500">
                          {reasonText}
                        </p>
                      )}
                      {Array.isArray(after.ambiguityFlags) &&
                        after.ambiguityFlags.length > 0 && (
                          <p className="mt-1 text-xs text-amber-600">
                            {after.ambiguityFlags.join(" · ")}
                          </p>
                        )}
                    </div>
                    {figmaUrl && (
                      <a
                        href={figmaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-sm text-zinc-600 underline hover:text-zinc-900"
                      >
                        Open in Figma
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
