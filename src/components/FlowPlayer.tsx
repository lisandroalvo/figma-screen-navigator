"use client";

import { useState, useEffect } from "react";
import {
  listInteractionsBySourceAction,
  listHotspotsByInteractionAction,
  listApprovedGuidanceForStepAction,
} from "@/app/flows/actions";
import Image from "next/image";

interface Guidance {
  id: string;
  text: string;
  scope: string;
  category: string | null;
  interactionId: string | null;
  figmaNodeId: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  USER_GUIDANCE: "User Guidance",
  ACTION_INSTRUCTION: "Action",
  QA_NOTE: "QA Note",
  EXPLANATION: "Explanation",
  DECISION_CONTEXT: "Decision Guidance",
  GENERAL_FLOW_NOTE: "Note",
};

interface FlowStep {
  id: string;
  figmaNodeId: string;
  name: string;
  displayName?: string | null;
  stepType?: string;
  previewUrl: string | null;
}

const stepLabel = (s: { displayName?: string | null; name: string }) =>
  s.displayName || s.name;

interface Interaction {
  id: string;
  destinationStepId: string;
  label: string | null;
  trigger: string;
}

interface Hotspot {
  id: string;
  interactionId: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export default function FlowPlayer({
  flowId,
  steps,
  startStepId,
}: {
  flowId: string;
  steps: FlowStep[];
  startStepId?: string | null;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [guidance, setGuidance] = useState<Guidance[]>([]);
  const [showClickableAreas, setShowClickableAreas] = useState(false);

  const currentStep = steps.find((s) => s.id === currentStepId);

  useEffect(() => {
    if (currentStepId) {
      loadInteractions(currentStepId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepId]);

  async function loadInteractions(stepId: string) {
    const data = await listInteractionsBySourceAction(stepId);
    setInteractions(data);

    // Load hotspots for click interactions
    const allHotspots: Hotspot[] = [];
    for (const interaction of data) {
      if (interaction.trigger === "click") {
        const hotspotData = await listHotspotsByInteractionAction(interaction.id);
        allHotspots.push(...hotspotData.map((h) => ({ ...h, interactionId: interaction.id })));
      }
    }
    setHotspots(allHotspots);

    // Approved Figma-authored guidance for this step + its outgoing interactions
    const guidanceData = await listApprovedGuidanceForStepAction(
      stepId,
      data.map((i) => i.id),
    );
    setGuidance(guidanceData);
  }

  // Order notes: User Guidance, Action, QA Note, Explanation, Decision, then rest.
  const CATEGORY_ORDER = [
    "USER_GUIDANCE",
    "ACTION_INSTRUCTION",
    "QA_NOTE",
    "EXPLANATION",
    "DECISION_CONTEXT",
    "GENERAL_FLOW_NOTE",
  ];
  const sortedGuidance = [...guidance].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category ?? "GENERAL_FLOW_NOTE") -
      CATEGORY_ORDER.indexOf(b.category ?? "GENERAL_FLOW_NOTE"),
  );
  const screenGuidance = sortedGuidance.filter((g) => g.scope === "step");
  const interactionGuidance = sortedGuidance.filter((g) => g.scope === "interaction");
  const decisionGuidance = sortedGuidance.filter((g) => g.scope === "decision");

  // Resolve the explicit start step; fall back to the first step only if the
  // flow has no configured start (or it points at a step that no longer exists).
  const resolvedStartStep =
    (startStepId && steps.find((s) => s.id === startStepId)) || steps[0];

  function startFlow() {
    if (!resolvedStartStep) return;
    setIsPlaying(true);
    setCurrentStepId(resolvedStartStep.id);
    setHistory([resolvedStartStep.id]);
  }

  function handleHotspotClick(interactionId: string) {
    const interaction = interactions.find((i) => i.id === interactionId);
    if (!interaction) return;

    setHistory([...history, interaction.destinationStepId]);
    setCurrentStepId(interaction.destinationStepId);
  }

  function handleBranchClick(interactionId: string) {
    const interaction = interactions.find((i) => i.id === interactionId);
    if (!interaction) return;

    setHistory([...history, interaction.destinationStepId]);
    setCurrentStepId(interaction.destinationStepId);
  }

  function goBack() {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    setCurrentStepId(newHistory[newHistory.length - 1]);
  }

  function goForward() {
    // Only advance if exactly one deterministic next interaction
    const nextInteractions = interactions.filter((i) => i.trigger === "next");
    if (nextInteractions.length === 1) {
      setHistory([...history, nextInteractions[0].destinationStepId]);
      setCurrentStepId(nextInteractions[0].destinationStepId);
    }
  }

  function exitPlayer() {
    setIsPlaying(false);
    setCurrentStepId(null);
    setHistory([]);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isPlaying) return;

      if (e.key === "Escape") {
        exitPlayer();
      } else if (e.key === "ArrowLeft") {
        goBack();
      } else if (e.key === "ArrowRight") {
        goForward();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, history, interactions]);

  if (!isPlaying) {
    return (
      <div className="text-center py-12">
        <button
          onClick={startFlow}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700"
        >
          Start Interactive Flow
        </button>
      </div>
    );
  }

  if (!currentStep) {
    return <div>Loading...</div>;
  }

  const branchInteractions = interactions.filter((i) => i.trigger === "branch");
  const clickInteractions = interactions.filter((i) => i.trigger === "click");
  const canGoBack = history.length > 1;
  const canGoForward = interactions.filter((i) => i.trigger === "next").length === 1;
  // The toggle only reveals mapped hotspots; it never creates interactivity.
  const showUnmappedNotice =
    showClickableAreas && clickInteractions.length > 0 && hotspots.length === 0;

  const isDecision =
    currentStep.stepType === "decision" || branchInteractions.length > 0;
  const destLabel = (i: Interaction) => {
    const s = steps.find((x) => x.id === i.destinationStepId);
    return s ? stepLabel(s) : "";
  };
  // On a decision, branch labels (Yes/No/Matching SSN…) are the buttons — don't
  // also render them as guidance cards. And drop the note that merely repeats
  // the decision's own label (same Figma node as the decision step).
  const shownInteractionGuidance = isDecision ? [] : interactionGuidance;
  const decisionExtraGuidance = decisionGuidance.filter(
    (g) => g.figmaNodeId !== currentStep.figmaNodeId,
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex gap-2">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            ← Previous
          </button>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Next →
          </button>
          <button
            onClick={exitPlayer}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Exit (Esc)
          </button>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showClickableAreas}
            onChange={(e) => setShowClickableAreas(e.target.checked)}
          />
          <span className="text-sm">Show clickable areas</span>
        </label>
      </div>

      {/* Screen Display */}
      {currentStep.previewUrl && (
        <div className="relative border rounded-lg overflow-hidden bg-gray-50">
          <Image
            src={currentStep.previewUrl}
            alt={currentStep.name}
            width={1920}
            height={1080}
            className="w-full h-auto"
          />

          {/* Hotspots */}
          {hotspots.map((hotspot) => (
            <button
              key={hotspot.id}
              onClick={() => handleHotspotClick(hotspot.interactionId)}
              className={`absolute cursor-pointer transition-all ${
                showClickableAreas
                  ? "border-2 border-blue-500 bg-blue-500/30"
                  : "hover:border-2 hover:border-blue-500 hover:bg-blue-500/20"
              }`}
              style={{
                left: `${hotspot.xPercent * 100}%`,
                top: `${hotspot.yPercent * 100}%`,
                width: `${hotspot.widthPercent * 100}%`,
                height: `${hotspot.heightPercent * 100}%`,
              }}
              aria-label={`Hotspot ${hotspot.id}`}
            />
          ))}
        </div>
      )}

      {/* Figma-authored guidance for this screen and its actions */}
      {(screenGuidance.length > 0 || shownInteractionGuidance.length > 0) && (
        <div className="space-y-3">
          {screenGuidance.map((g) => (
            <NoteCard key={g.id} category={g.category} text={g.text} />
          ))}
          {shownInteractionGuidance.map((g) => (
            <NoteCard key={g.id} category={g.category} text={g.text} />
          ))}
        </div>
      )}

      {/* Clickable areas exist as interactions but none are mapped yet */}
      {showUnmappedNotice && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No clickable areas mapped for this screen yet.
        </div>
      )}

      {/* Decision panel — the decision title, then the branch choices as
          clearly interactive controls. Branch labels are NOT duplicated as
          guidance cards; the decision's own label is not repeated. */}
      {branchInteractions.length > 0 && (
        <div
          className="rounded-xl border border-zinc-600 bg-zinc-900 p-6 text-zinc-100 shadow-lg"
          role="group"
          aria-label={`Decision: ${stepLabel(currentStep)}`}
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Decision
          </div>
          <h3 className="mt-1 text-xl font-bold text-white">
            {stepLabel(currentStep)}
          </h3>
          <p className="mt-1 text-sm text-zinc-300">Choose a path</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {branchInteractions.map((interaction) => (
              <button
                key={interaction.id}
                onClick={() => handleBranchClick(interaction.id)}
                className="rounded-lg border-2 border-zinc-400 bg-zinc-800 px-5 py-3 text-left transition-colors hover:border-blue-400 hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 sm:min-w-[180px] sm:flex-1"
              >
                <span className="block text-base font-semibold text-white">
                  {interaction.label || "Continue"}
                </span>
                {destLabel(interaction) && (
                  <span className="mt-0.5 block text-xs text-zinc-400">
                    → {destLabel(interaction)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {decisionExtraGuidance.length > 0 && (
            <div className="mt-5 border-t border-zinc-700 pt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Guidance
              </div>
              <div className="space-y-3">
                {decisionExtraGuidance.map((g) => (
                  <NoteCard key={g.id} category={g.category} text={g.text} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current screen label */}
      <div className="text-sm font-medium text-zinc-300">
        {stepLabel(currentStep)}
      </div>

      {/* Debug Info */}
      <div className="text-xs text-zinc-500">
        Step {history.length} | {currentStep.name} | Interactions: {interactions.length} | Hotspots: {hotspots.length} | Notes: {guidance.length}
      </div>
    </div>
  );
}

function NoteCard({
  category,
  text,
}: {
  category: string | null;
  text: string;
}) {
  const label = CATEGORY_LABELS[category ?? "GENERAL_FLOW_NOTE"] ?? "Note";
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
        {label}
      </div>
      <p className="whitespace-pre-wrap text-sm text-amber-900">{text}</p>
    </div>
  );
}
