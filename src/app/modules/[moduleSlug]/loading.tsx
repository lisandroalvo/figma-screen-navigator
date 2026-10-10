export default function ModuleLoading() {
  return (
    <main className="min-h-screen bg-brandbg p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-primary/10" />
        <div className="space-y-1">
          <div className="h-6 w-64 rounded bg-primary/15" />
          <div className="h-4 w-32 rounded bg-primary/10" />
        </div>
        <div className="h-10 w-full rounded-md bg-primary/10" />
        <div className="overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-primary/10 px-3 py-3">
              <div className="h-4 w-2/3 rounded bg-primary/10" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
