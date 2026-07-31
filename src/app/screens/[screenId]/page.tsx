import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getScreenById,
  listRelatedScreens,
  listResponsiveVariants,
} from "@/lib/data";
import { ScreenDetail } from "@/components/ScreenDetail";

export default async function ScreenPage({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = await params;
  const [screen, related, responsive] = await Promise.all([
    getScreenById(screenId),
    listRelatedScreens(screenId),
    listResponsiveVariants(screenId),
  ]);

  if (!screen) notFound();

  const relatedScreens = [...related, ...responsive].filter(
    (s, i, a) => a.findIndex((t) => t.id === s.id) === i,
  );

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white p-4">
        <Link href="/" className="text-sm text-zinc-600 hover:underline">
          ← Search
        </Link>
      </div>
      <ScreenDetail screen={screen} relatedScreens={relatedScreens} />
    </main>
  );
}
