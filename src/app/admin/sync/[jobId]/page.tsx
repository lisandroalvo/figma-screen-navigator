import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSyncJobById } from "@/lib/repositories/sync-jobs";
import { listProposedChangesByJob } from "@/lib/repositories/proposed-changes";
import { listRecentAuditLogs } from "@/lib/repositories/audit-logs";
import { requireAdmin } from "@/lib/auth/session";
import { ProposalActions } from "@/components/ProposalActions";

const CONFIDENCE_OPTIONS = ["all", "high", "medium", "low", "rejected", "missing"];
const STATUS_OPTIONS = ["all", "pending", "needs_review", "approved", "rejected", "published"];
const PAGE_OPTIONS = ["all", "Estimate", "Calculation", "Accrual", "List", "Floor"];

function getPilotIds() {
  try {
    const p = path.resolve(process.cwd(), "reports/pilot-review-subset.json");
    const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
    return new Set((raw.subset as { id: string }[]).map((s) => s.id));
  } catch {
    return new Set<string>();
  }
}

export default async function SyncJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ confidence?: string; status?: string; page?: string; subset?: string }>;
}) {
  await requireAdmin();
  const { jobId } = await params;
  const { confidence, status, page, subset } = await searchParams;
  const job = await getSyncJobById(jobId);
  if (!job) notFound();

  const allChanges = await listProposedChangesByJob(jobId);
  const pilotIds = getPilotIds();
  const auditLogs = await listRecentAuditLogs();

  let changes = allChanges;
  if (confidence && confidence !== "all" && confidence !== "missing") {
    changes = changes.filter((c) => {
      const after = (c.after as Record<string, unknown>) ?? {};
      return after.confidence === confidence;
    });
  } else if (confidence === "missing") {
    changes = changes.filter((c) => c.action === "missing");
  }

  if (status && status !== "all") {
    changes = changes.filter((c) => c.status === status);
  }

  if (page && page !== "all") {
    changes = changes.filter((c) => {
      const after = (c.after as Record<string, unknown>) ?? {};
      return (after.pageName as string)?.includes(page);
    });
  }

  if (subset === "pilot") {
    changes = changes.filter((c) => {
      const after = (c.after as Record<string, unknown>) ?? {};
      return pilotIds.has(after.id as string);
    });
  }

  const counts = allChanges.reduce(
    (acc, c) => {
      acc[c.action] = (acc[c.action] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const statusCounts = allChanges.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
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
          <Link href="/admin/sync" className="text-sm text-zinc-600 hover:underline">
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
          <h2 className="mb-2 text-xl font-semibold text-zinc-900">Proposed changes</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(counts).map(([action, n]) => (
              <div key={action} className="rounded bg-white p-3 text-center shadow-sm">
                <div className="text-2xl font-semibold">{n}</div>
                <div className="text-sm text-zinc-500">{action}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-zinc-900">Review status</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(statusCounts).map(([s, n]) => (
              <div key={s} className="rounded bg-white p-3 text-center shadow-sm">
                <div className="text-2xl font-semibold">{n}</div>
                <div className="text-sm text-zinc-500">{s}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-zinc-900">Filters</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/sync/${jobId}?subset=pilot`}
              className={`rounded px-4 py-2 text-sm font-medium ${
                subset === "pilot" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Pilot subset
            </Link>
            <Link
              href={`/admin/sync/${jobId}`}
              className={`rounded px-4 py-2 text-sm font-medium ${
                !subset ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              All proposals
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {CONFIDENCE_OPTIONS.map((conf) => (
              <Link
                key={conf}
                href={`/admin/sync/${jobId}?confidence=${conf}`}
                className={`rounded px-4 py-2 text-sm font-medium ${
                  confidence === conf || (!confidence && conf === "all")
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {conf}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <Link
                key={s}
                href={`/admin/sync/${jobId}?status=${s}`}
                className={`rounded px-4 py-2 text-sm font-medium ${
                  status === s || (!status && s === "all")
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {PAGE_OPTIONS.map((p) => (
              <Link
                key={p}
                href={`/admin/sync/${jobId}?page=${p}`}
                className={`rounded px-4 py-2 text-sm font-medium ${
                  page === p || (!page && p === "all")
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {p}
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
              const metadata = (after.metadata as Record<string, unknown>) ?? {};
              const flags = (after.ambiguityFlags as string[]) ?? [];
              const variants = (after.variants as Record<string, unknown>[]) ?? [];
              const primary = after.primaryVariant as Record<string, unknown> | undefined;
              const conf = (after.confidence as string) ?? "missing";
              const hasCollision = after.sameBreakpointCollision === true;
              const safeToApprove =
                (change.status === "pending" || change.status === "needs_review") &&
                conf === "high" &&
                !hasCollision &&
                !flags.includes("grouping_uncertain");

              return (
                <li key={change.id} className="rounded bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block rounded bg-zinc-200 px-2 py-0.5 text-sm font-medium">
                        {change.action}
                      </span>
                      <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-sm font-medium text-zinc-700">
                        {conf} · {change.status}
                      </span>
                      {safeToApprove && (
                        <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-sm font-medium text-green-700">
                          safe to approve
                        </span>
                      )}
                      {hasCollision && (
                        <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-700">
                          collision
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-zinc-900">
                      {(after.displayName as string) ?? (after.originalName as string) ?? "Unknown"}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {(after.pageName as string) ?? "?"} · {(after.availableBreakpoints as string[])?.join(", ")}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {variants.length} variant{variants.length === 1 ? "" : "s"} ·
                      w:{primary?.width as number} h:{primary?.height as number}
                    </p>
                    {flags.length > 0 && (
                      <p className="text-xs text-amber-600">{flags.join(" · ")}</p>
                    )}
                    {Boolean(primary?.figmaUrl) && (
                      <a
                        href={String(primary?.figmaUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Open in Figma
                      </a>
                    )}
                    <details className="text-sm">
                      <summary className="cursor-pointer text-zinc-600">Show metadata</summary>
                      <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-2 text-zinc-700">
                        <dt>Screen</dt><dd>{(metadata.screen as string) ?? "—"}</dd>
                        <dt>Scenario</dt><dd>{(metadata.scenario as string) ?? "—"}</dd>
                        <dt>Option</dt><dd>{(metadata.option as string) ?? "—"}</dd>
                        <dt>Condition</dt><dd>{(metadata.condition as string) ?? "—"}</dd>
                        <dt>Behavior</dt><dd>{(metadata.behavior as string) ?? "—"}</dd>
                        <dt>State</dt><dd>{(metadata.state as string) ?? "—"}</dd>
                      </dl>
                    </details>
                    <ProposalActions
                      proposalId={change.id}
                      jobId={jobId}
                      status={change.status}
                      hasCollision={hasCollision}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-zinc-900">Recent audit history</h2>
          <ul className="space-y-2">
            {auditLogs.length === 0 && <p className="text-sm text-zinc-500">No audit records yet.</p>}
            {auditLogs.map((log) => (
              <li key={log.id} className="rounded bg-white p-3 text-sm shadow-sm">
                <span className="font-medium">{log.action}</span> on{" "}
                <span className="text-zinc-600">{log.entity}</span>{" "}
                <span className="text-zinc-400">({log.entityId})</span>
                <span className="mx-2">·</span>
                <span className="text-zinc-500">{log.actorUserId}</span>
                <span className="mx-2">·</span>
                <span className="text-zinc-400">{new Date(log.createdAt).toISOString()}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
