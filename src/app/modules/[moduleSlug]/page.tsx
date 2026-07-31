import Link from "next/link";
import { notFound } from "next/navigation";
import { getModuleBySlug, getScreensForModule } from "@/lib/data";
import { ScreenCard } from "@/components/ScreenCard";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ moduleSlug: string }>;
}) {
  const { moduleSlug } = await params;
  const figmaModule = getModuleBySlug(moduleSlug);
  if (!figmaModule) notFound();

  const screens = getScreensForModule(figmaModule.id);

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <Link
            href="/modules"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← All modules
          </Link>
        </div>
        <h1 className="text-3xl font-semibold text-zinc-900">{figmaModule.name}</h1>
        <p className="mt-1 text-zinc-600">
          {screens.length} screen{screens.length === 1 ? "" : "s"} indexed
        </p>
        <div className="mt-6 space-y-4">
          {screens.map((screen) => (
            <ScreenCard key={screen.id} screen={screen} />
          ))}
        </div>
      </div>
    </main>
  );
}
