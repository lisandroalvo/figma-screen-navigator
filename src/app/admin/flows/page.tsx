import { requireAdmin } from "@/lib/auth";
import { listFlows } from "@/lib/repositories/flows";
import { getDb } from "@/lib/db";
import { flowStepsTable, flowInteractionsTable, flowHotspotsTable, flowGuidanceTable } from "../../../../drizzle/schema";
import { eq, count } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";

export default async function AdminFlowsPage() {
  await requireAdmin();

  const flows = await listFlows({ status: "draft" });
  const db = getDb();

  // Get counts for each flow
  const flowsWithCounts = await Promise.all(
    flows.map(async (flow) => {
      const [stepCount] = await db
        .select({ count: count() })
        .from(flowStepsTable)
        .where(eq(flowStepsTable.flowId, flow.id));

      const [guidanceCount] = await db
        .select({ count: count() })
        .from(flowGuidanceTable)
        .where(eq(flowGuidanceTable.flowId, flow.id));

      const [interactionCount] = await db
        .select({ count: count() })
        .from(flowInteractionsTable)
        .where(eq(flowInteractionsTable.flowId, flow.id));

      // Count hotspots across all interactions
      const interactions = await db
        .select({ id: flowInteractionsTable.id })
        .from(flowInteractionsTable)
        .where(eq(flowInteractionsTable.flowId, flow.id));

      let hotspotCount = 0;
      for (const interaction of interactions) {
        const [result] = await db
          .select({ count: count() })
          .from(flowHotspotsTable)
          .where(eq(flowHotspotsTable.interactionId, interaction.id));
        hotspotCount += result.count;
      }

      return {
        ...flow,
        stepCount: stepCount.count,
        guidanceCount: guidanceCount.count,
        interactionCount: interactionCount.count,
        hotspotCount,
      };
    }),
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Flow Management</h1>
        <p className="text-gray-600">Manage interactive Figma Flows</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {flowsWithCounts.map((flow) => (
          <div key={flow.id} className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
            {flow.previewUrl && (
              <div className="mb-4 relative h-48 bg-gray-100 rounded overflow-hidden">
                <Image
                  src={flow.previewUrl}
                  alt={flow.name}
                  fill
                  className="object-contain"
                />
              </div>
            )}

            <h2 className="text-xl font-semibold mb-2">{flow.name}</h2>

            <div className="space-y-1 text-sm text-gray-600 mb-4">
              <div>Screens: {flow.stepCount}</div>
              <div>Guidance: {flow.guidanceCount}</div>
              <div>Interactions: {flow.interactionCount}</div>
              <div>Hotspots: {flow.hotspotCount}</div>
              <div className="capitalize">Status: {flow.status}</div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/admin/flows/${flow.id}`}
                className="flex-1 text-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Review Flow
              </Link>
              <a
                href={flow.figmaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Figma ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
