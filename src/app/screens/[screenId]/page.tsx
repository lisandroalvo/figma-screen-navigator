import Link from "next/link";
import { notFound } from "next/navigation";
import { getRelatedScreens, getScreenById } from "@/lib/data";
import { ScreenDetail } from "@/components/ScreenDetail";

export default async function ScreenPage({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = await params;
  const screen = getScreenById(screenId);
  if (!screen) notFound();

  const related = getRelatedScreens(screenId)
    .map((r) => r.screen)
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white p-4">
        <Link
          href="/"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Search
        </Link>
      </div>
      <ScreenDetail screen={screen} relatedScreens={related} />
    </main>
  );
}
