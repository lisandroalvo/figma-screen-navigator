import Link from "next/link";
import { notFound } from "next/navigation";
import { getSyncJobById } from "@/lib/repositories/sync-jobs";
import { listProposedChangesByJob } from "@/lib/repositories/proposed-changes";

export default async function SyncJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getSyncJobById(jobId);
  if (!job) notFound();

  const changes = await listProposedChangesByJob(jobId);

  const counts = changes.reduce(
    (acc, c) => {
      acc[c.action] = (acc[c.action] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const preview = changes.slice(0, 50);

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
            Preview ({preview.length} of {changes.length})
          </h2>
          <ul className="space-y-2">
            {preview.map((change) => {
              const after = (change.after as Record<string, unknown>) ?? {};
              const figmaUrl =
                (after.figmaUrl as string) ??
                `https://www.figma.com/design/${after.fileKey}?node-id=${(after.id as string)?.replace(":", "-")}`;
              return (
                <li
                  key={change.id}
                  className="rounded bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block rounded bg-zinc-200 px-2 py-0.5 text-sm font-medium">
                        {change.action}
                      </span>
                      <h3 className="mt-1 font-medium text-zinc-900">
                        {(after.displayName as string) ??
                          (after.originalName as string) ??
                          "Unknown"}
                      </h3>
                      <p className="text-sm text-zinc-500">
                        {(after.pageName as string) ?? "?"}{" "}
                        {(after.breakpointCode as string)
                          ? `· ${after.breakpointCode as string}`
                          : ""}
                      </p>
                    </div>
                    <a
                      href={figmaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-zinc-600 underline hover:text-zinc-900"
                    >
                      Open in Figma
                    </a>
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
