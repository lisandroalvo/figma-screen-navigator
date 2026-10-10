import { getNavigatorIndex } from "@/lib/navigator";

export const dynamic = "force-dynamic";
// Run near the Supabase project (ap-southeast-1) — DB RTT dominates latency.
export const preferredRegion = "sin1";

/**
 * Full navigator index as JSON. The home page fetches this lazily (on first
 * search input) so initial page render never pays the ~2,700-row cost — while
 * search still covers every module/page/flow/section/screen.
 */
export async function GET() {
  const index = await getNavigatorIndex();
  return Response.json(index, {
    headers: { "cache-control": "private, max-age=30" },
  });
}
