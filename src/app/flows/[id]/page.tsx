import { getFlowById, listFlowSteps } from "@/lib/repositories/flows";
import { notFound } from "next/navigation";
import FlowPlayer from "@/components/FlowPlayer";
import Image from "next/image";
import Link from "next/link";

// Run near the Supabase project (ap-southeast-1) — DB RTT dominates latency.
export const preferredRegion = "sin1";

export default async function FlowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const flow = await getFlowById(id);
  if (!flow) notFound();

  const steps = await listFlowSteps(id);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        {/* Dynamic Module › Page › Flow breadcrumb from DB relationships */}
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-gray-600">
          {flow.moduleSlug ? (
            <Link href={`/modules/${flow.moduleSlug}`} className="hover:underline">
              {flow.moduleName}
            </Link>
          ) : (
            <span>{flow.moduleName}</span>
          )}
          <span className="text-gray-400">›</span>
          {flow.moduleSlug ? (
            <Link
              href={`/modules/${flow.moduleSlug}/pages/${flow.figmaPageId}`}
              className="hover:underline"
            >
              {flow.pageName}
            </Link>
          ) : (
            <span>{flow.pageName}</span>
          )}
          <span className="text-gray-400">›</span>
          <span className="font-medium text-gray-800">{flow.name}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{flow.name}</h1>
          <a
            href={flow.figmaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Open Flow in Figma ↗
          </a>
        </div>
      </div>

      {/* Flow Overview */}
      {flow.previewUrl && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Flow Overview</h2>
          <div className="border rounded-lg overflow-hidden bg-gray-50">
            <Image
              src={flow.previewUrl}
              alt={flow.name}
              width={2048}
              height={800}
              className="w-full h-auto"
            />
          </div>
        </section>
      )}

      {/* Interactive Player */}
      <section>
        <FlowPlayer
          flowId={flow.id}
          steps={steps}
          startStepId={flow.startStepId}
        />
      </section>
    </div>
  );
}
