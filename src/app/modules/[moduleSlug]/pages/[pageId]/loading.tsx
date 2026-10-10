export default function PageLoading() {
  return (
    <main className="min-h-screen bg-brandbg p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
        <div className="h-4 w-64 rounded bg-primary/10" />
        <div className="space-y-1">
          <div className="h-6 w-56 rounded bg-primary/15" />
          <div className="h-4 w-44 rounded bg-primary/10" />
        </div>
        <div className="h-10 w-full rounded-md bg-primary/10" />
        <div className="overflow-hidden rounded-lg border border-primary/15 bg-surface shadow-sm">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-primary/10 px-3 py-3">
              <div className="h-5 w-12 rounded bg-primary/10" />
              <div className="h-4 flex-1 rounded bg-primary/10" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
