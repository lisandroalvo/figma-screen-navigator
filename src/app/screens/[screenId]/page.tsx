import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getScreenById,
  listRelatedScreens,
  listResponsiveVariants,
} from "@/lib/data";
import { getPublishedScreenWithVariants } from "@/lib/repositories/logical-screens";
import { requireAuth } from "@/lib/auth/session";
import { ScreenDetail } from "@/components/ScreenDetail";

export const dynamic = "force-dynamic";
// Run near the Supabase project (ap-southeast-1) — DB RTT dominates latency.
export const preferredRegion = "sin1";

export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ screenId: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { screenId } = await params;
  const { variant } = await searchParams;
  await requireAuth();

  const [screen, published, related, responsive] = await Promise.all([
    getScreenById(screenId),
    getPublishedScreenWithVariants(screenId),
    listRelatedScreens(screenId),
    listResponsiveVariants(screenId),
  ]);

  if (!screen) notFound();

  const relatedScreens = [...related, ...responsive].filter(
    (s, i, a) => a.findIndex((t) => t.id === s.id) === i,
  );

  const variants = published?.variants ?? [];
  const requestedCode = variant?.toLowerCase();
  const selectedVariant =
    requestedCode && variants.length > 0
      ? variants.find(
          (v) =>
            (v.breakpointCode?.toLowerCase() ?? "") === requestedCode,
        ) ??
        variants.find((v) => v.isPrimary) ??
        variants[0]
      : variants.find((v) => v.isPrimary) ?? variants[0];

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white p-4">
        <Link href="/" className="text-sm text-zinc-600 hover:underline">
          ← Search
        </Link>
      </div>
      <ScreenDetail
        screen={screen}
        relatedScreens={relatedScreens}
        variants={variants}
        selectedVariant={selectedVariant}
      />
    </main>
  );
}
