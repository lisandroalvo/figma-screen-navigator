import { redirect } from "next/navigation";
import Link from "next/link";
import { scanPilotModule } from "@/lib/figma/sync";
import { listSyncJobs } from "@/lib/repositories/sync-jobs";

export const dynamic = "force-dynamic";

async function startScan() {
  "use server";
  const result = await scanPilotModule();
  redirect(`/admin/sync/${result.syncJobId}`);
}

export default async function AdminSyncPage() {
  const jobs = await listSyncJobs();

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Internal prototype — authentication not yet enabled
        </div>

        <header>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Figma Sync Prototype
          </h1>
          <p className="mt-1 text-zinc-600">
            Scan the Pension Calculation Figma file and review proposed changes
            before publishing.
          </p>
        </header>

        <form action={startScan}>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-800"
          >
            Run read-only scan
          </button>
        </form>

        <section>
          <h2 className="mb-2 text-xl font-semibold text-zinc-900">
            Recent scans
          </h2>
          {jobs.length === 0 ? (
            <p className="text-zinc-500">No scans yet.</p>
          ) : (
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li key={job.id} className="rounded bg-white p-4 shadow-sm">
                  <Link
                    href={`/admin/sync/${job.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {job.startedAt.toISOString()}
                  </Link>
                  <span className="ml-3 text-sm text-zinc-500">
                    {job.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
