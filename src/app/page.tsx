import { getNavigatorIndex } from "@/lib/navigator";
import HomeSearch from "@/components/navigator/HomeSearch";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Load the current-scope index server-side (DB), then hand it to the client
  // component for instant, live (as-you-type) filtering — no Enter, no per-key
  // request. Interactive-prototype (FlowPlayer) entry points are intentionally
  // not linked here; Flow/Screen rows open the exact Figma node instead.
  const index = await getNavigatorIndex();

  return (
    <main className="min-h-screen bg-brandbg p-4 sm:p-6">
      <HomeSearch index={index} />
    </main>
  );
}
