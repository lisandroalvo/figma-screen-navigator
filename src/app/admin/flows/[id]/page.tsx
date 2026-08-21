import { requireAdmin } from "@/lib/auth";
import {
  getFlowById,
  listFlowSteps,
  listFlowGuidance,
  listInteractionsByFlow,
  listHotspotsByInteraction,
} from "@/lib/repositories/flows";
import { notFound } from "next/navigation";
import Image from "next/image";
import InteractionMapper from "@/components/admin/InteractionMapper";
import StartStepButton from "@/components/admin/StartStepButton";
import GuidanceReview from "@/components/admin/GuidanceReview";
import GraphReview from "@/components/admin/GraphReview";
import { computeGraphValidation } from "@/lib/flow-graph";
import { generateFigmaNodeUrl } from "@/lib/figma/flow-parser";

// Display labels from audit
const DISPLAY_LABELS: Record<string, string> = {
  // Beneficiary
  "21:19162": "Beneficiaries Tab - Default",
  "21:19194": "Beneficiaries Tab - Row Selected",
  "21:18725": "Add Beneficiary Modal - Empty",
  "21:19067": "Add Beneficiary Modal - Populated",
  "21:19094": "Add Beneficiary Modal - With QDRO",
  "21:18761": "Add Beneficiary Modal - Success",
  "21:19062": "Add Beneficiary Modal - Error",
  "21:18735": "QDRO Documents Modal",
  "21:18730": "Edit Beneficiary Modal - Default",
  "21:19236": "Edit Beneficiary Modal - Populated",
  "21:18654": "Edit Beneficiary Modal - Phone Dropdown",
  "21:19057": "Edit Beneficiary Modal - Success",
  "21:19127": "Edit Beneficiary Modal - Error",
  "21:19263": "Beneficiary Confirmation Modal",
  // Add Event
  "21:32353": "Default with Access",
  "21:32369": "Default with Access - Error",
  "21:32440": "Default with Access - Event Open",
  "21:32463": "Successfully Added (With Access)",
  "21:32497": "Default - Without Access",
  "21:32540": "Default - Without Access - Error",
  "21:32416": "Successfully Added (Without Access)",
  // Start Pay
  "21:18607": "Beneficiaries Tab - Default",
  "21:18442": "Pay Pensioner Modal",
  "21:18455": "Pensioner Profile / Default",
};

export default async function AdminFlowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const flow = await getFlowById(id);
  if (!flow) notFound();

  const steps = await listFlowSteps(id);
  const guidance = await listFlowGuidance(id);
  const interactions = await listInteractionsByFlow(id);

  // Prefer human-verified displayName; fall back to the static map then name.
  const labelMap: Record<string, string> = { ...DISPLAY_LABELS };
  for (const s of steps) {
    if (s.displayName) labelMap[s.figmaNodeId] = s.displayName;
  }

  // Hotspot counts per interaction (for graph validation + review).
  const hotspotCountByInteraction: Record<string, number> = {};
  await Promise.all(
    interactions
      .filter((i) => i.trigger === "click")
      .map(async (i) => {
        const hs = await listHotspotsByInteraction(i.id);
        hotspotCountByInteraction[i.id] = hs.length;
      }),
  );

  const approvedInteractions = interactions.filter(
    (i) => i.reviewStatus === "approved",
  );
  const validation = computeGraphValidation(
    steps,
    approvedInteractions,
    flow.startStepId,
  );
  const screenSteps = steps.filter((s) => s.stepType === "screen");
  const labelledScreens = screenSteps.filter((s) => s.displayName).length;
  const decisionSteps = steps.filter((s) => s.stepType === "decision");
  const approvedGuidance = guidance.filter((g) => g.reviewStatus === "approved").length;
  const needsReviewGuidance = guidance.filter((g) => g.reviewStatus === "needs_review").length;
  const totalHotspots = Object.values(hotspotCountByInteraction).reduce((a, b) => a + b, 0);
  const requiredHotspots = approvedInteractions.filter((i) => i.trigger === "click").length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="text-sm text-gray-600 mb-2">
          {flow.moduleName} › {flow.pageName} › {flow.name}
        </div>
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

      {/* Flow Accuracy / readiness */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Flow Accuracy</h2>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Start step" value={flow.startStepId ? "Configured" : "Missing"} />
          <Stat label="Screens" value={`${screenSteps.length}`} />
          <Stat label="Screen labels verified" value={`${labelledScreens} / ${screenSteps.length}`} />
          <Stat label="Decision nodes" value={`${decisionSteps.length}`} />
          <Stat label="Interactions" value={`${interactions.length}`} />
          <Stat label="Approved edges" value={`${approvedInteractions.length}`} />
          <Stat label="Needs review edges" value={`${interactions.filter((i) => i.reviewStatus !== "approved").length}`} />
          <Stat label="Hotspots (mapped / required)" value={`${totalHotspots} / ${requiredHotspots}`} />
          <Stat label="Notes approved" value={`${approvedGuidance} / ${guidance.length}`} />
          <Stat label="Notes needs review" value={`${needsReviewGuidance}`} />
          <Stat label="Reachable screens" value={`${validation.reachable.length} / ${steps.length}`} />
          <Stat label="Unreachable" value={`${validation.unreachable.length}`} warn={validation.unreachable.length > 0} />
          <Stat label="Dead ends" value={`${validation.deadEnds.length}`} />
          <Stat label="Incomplete decisions" value={`${validation.incompleteDecisions.length}`} warn={validation.incompleteDecisions.length > 0} />
        </div>
      </section>

      {/* Side-by-side: Figma section (left) vs reconstructed graph (right) */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Figma vs Navigator</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-600">Figma Flow Section</h3>
            {flow.previewUrl && (
              <div className="border rounded-lg overflow-hidden bg-gray-50">
                <Image src={flow.previewUrl} alt={flow.name} width={2048} height={800} className="w-full h-auto" />
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-600">Navigator reconstructed edges (approved)</h3>
            <div className="rounded-lg border p-3 text-sm">
              {approvedInteractions.length === 0 ? (
                <p className="text-gray-500">No approved edges yet.</p>
              ) : (
                <ul className="space-y-1">
                  {approvedInteractions.map((it) => {
                    const src = steps.find((s) => s.id === it.sourceStepId);
                    const dst = steps.find((s) => s.id === it.destinationStepId);
                    return (
                      <li key={it.id}>
                        <span className="font-medium">{src?.displayName || src?.name}</span>
                        <span className="text-gray-400"> — {it.label || it.trigger} → </span>
                        <span className="font-medium">{dst?.displayName || dst?.name}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Screen States */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">
          Screen States ({steps.length} / {steps.length})
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => {
            const displayLabel = step.displayName || labelMap[step.figmaNodeId] || step.name;
            const figmaUrl = generateFigmaNodeUrl(flow.figmaFileKey, step.figmaNodeId);

            return (
              <div key={step.id} className="border rounded-lg p-4">
                {step.previewUrl && (
                  <div className="mb-3 relative h-48 bg-gray-100 rounded overflow-hidden">
                    <Image
                      src={step.previewUrl}
                      alt={displayLabel}
                      fill
                      className="object-contain"
                    />
                  </div>
                )}
                <h3 className="font-semibold mb-1">{displayLabel}</h3>
                <div className="text-xs text-gray-500 mb-2">
                  {step.name} ({step.figmaNodeId})
                </div>
                <div className="mb-2">
                  <StartStepButton
                    flowId={flow.id}
                    stepId={step.id}
                    isStart={flow.startStepId === step.id}
                  />
                </div>
                <a
                  href={figmaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Open in Figma ↗
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interaction Mapper */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Interaction Mapping</h2>
        <InteractionMapper flowId={flow.id} steps={steps} displayLabels={labelMap} />
      </section>

      {/* Notes / Guidance Review */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">
          Notes / Guidance Review ({guidance.length})
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Original Figma text is immutable — editing association never changes
          the wording. Only <strong>Approved</strong> notes appear in the QA
          Player.
        </p>
        <GuidanceReview
          flowId={flow.id}
          figmaFileKey={flow.figmaFileKey}
          guidance={guidance}
          steps={steps}
          interactions={interactions}
          displayLabels={labelMap}
        />
      </section>

      {/* Graph Review */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Graph Review</h2>
        <p className="mb-4 text-sm text-gray-600">
          The QA Player navigates using <strong>Approved</strong> edges only.
          Proposed / needs-review / rejected edges are shown here for
          verification but are never used for navigation.
        </p>
        <GraphReview
          flowId={flow.id}
          steps={steps}
          interactions={interactions}
          hotspotCountByInteraction={hotspotCountByInteraction}
        />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
