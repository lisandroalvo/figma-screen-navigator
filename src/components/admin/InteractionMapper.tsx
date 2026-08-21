"use client";

import { useState, useEffect } from "react";
import {
  createInteractionAction,
  deleteInteractionAction,
  listInteractionsByFlowAction,
} from "@/app/admin/flows/actions";
import HotspotEditor from "./HotspotEditor";

interface FlowStep {
  id: string;
  figmaNodeId: string;
  name: string;
  previewUrl: string | null;
}

interface Interaction {
  id: string;
  sourceStepId: string;
  destinationStepId: string;
  label: string | null;
  trigger: string;
}

export default function InteractionMapper({
  flowId,
  steps,
  displayLabels,
}: {
  flowId: string;
  steps: FlowStep[];
  displayLabels: Record<string, string>;
}) {
  const [sourceStepId, setSourceStepId] = useState("");
  const [destinationStepId, setDestinationStepId] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [trigger, setTrigger] = useState<"click" | "branch" | "next">("click");
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [selectedInteraction, setSelectedInteraction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInteractions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]);

  async function loadInteractions() {
    const data = await listInteractionsByFlowAction(flowId);
    setInteractions(data);
  }

  async function handleCreate() {
    if (!sourceStepId || !destinationStepId) return;

    setLoading(true);
    try {
      await createInteractionAction({
        flowId,
        sourceStepId,
        destinationStepId,
        label: actionLabel || null,
        trigger,
      });

      // Reset form
      setActionLabel("");
      setDestinationStepId("");

      await loadInteractions();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this interaction?")) return;

    setLoading(true);
    try {
      await deleteInteractionAction(id);
      await loadInteractions();
      if (selectedInteraction === id) {
        setSelectedInteraction(null);
      }
    } finally {
      setLoading(false);
    }
  }

  const sourceStep = steps.find((s) => s.id === sourceStepId);
  const sourceInteractions = interactions.filter((i) => i.sourceStepId === sourceStepId);

  const labelFor = (stepId: string) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return "[unknown]";
    return displayLabels[step.figmaNodeId] || step.name;
  };

  return (
    <div className="space-y-6">
      {/* All interactions in the flow (not just the selected source) */}
      <div className="border rounded-lg p-6">
        <h3 className="font-semibold mb-4">
          Flow Interactions — {interactions.length}
        </h3>
        {interactions.length === 0 ? (
          <p className="text-sm text-gray-500">No interactions yet.</p>
        ) : (
          <div className="space-y-2">
            {interactions.map((interaction) => (
              <div
                key={interaction.id}
                className="flex items-center justify-between gap-3 p-3 border rounded"
              >
                <div className="text-sm">
                  <span className="font-medium">
                    {labelFor(interaction.sourceStepId)}
                  </span>
                  <span className="text-gray-500">
                    {" "}
                    →{interaction.label ? ` ${interaction.label} →` : ""}{" "}
                  </span>
                  <span className="font-medium">
                    {labelFor(interaction.destinationStepId)}
                  </span>
                  <span className="ml-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs uppercase text-gray-600">
                    {interaction.trigger}
                  </span>
                </div>
                <button
                  onClick={() => setSourceStepId(interaction.sourceStepId)}
                  className="shrink-0 px-3 py-1 text-sm border rounded hover:bg-gray-50"
                >
                  Focus
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Create Interaction */}
      <div className="border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Create Interaction</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Source Screen *</label>
            <select
              value={sourceStepId}
              onChange={(e) => setSourceStepId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select source...</option>
              {steps.map((step) => (
                <option key={step.id} value={step.id}>
                  {displayLabels[step.figmaNodeId] || step.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Action Label</label>
            <input
              type="text"
              value={actionLabel}
              onChange={(e) => setActionLabel(e.target.value)}
              placeholder="e.g., Click Add Beneficiary"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Trigger *</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as any)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="click">Click</option>
              <option value="branch">Branch</option>
              <option value="next">Next</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Destination Screen</label>
            <select
              value={destinationStepId}
              onChange={(e) => setDestinationStepId(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select destination...</option>
              {steps.map((step) => (
                <option key={step.id} value={step.id}>
                  {displayLabels[step.figmaNodeId] || step.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={!sourceStepId || !destinationStepId || loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Interaction"}
          </button>
        </div>
      </div>

      {/* Existing Interactions */}
      {sourceStepId && sourceInteractions.length > 0 && (
        <div className="border rounded-lg p-6">
          <h3 className="font-semibold mb-4">
            Interactions from {displayLabels[sourceStep?.figmaNodeId || ""] || sourceStep?.name}
          </h3>
          <div className="space-y-2">
            {sourceInteractions.map((interaction) => {
              const dest = steps.find((s) => s.id === interaction.destinationStepId);
              return (
                <div key={interaction.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">
                      {interaction.label || `[${interaction.trigger}]`}
                    </div>
                    <div className="text-sm text-gray-600">
                      → {dest ? (displayLabels[dest.figmaNodeId] || dest.name) : "[No destination]"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {interaction.trigger === "click" && (
                      <button
                        onClick={() => setSelectedInteraction(interaction.id)}
                        className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                      >
                        {selectedInteraction === interaction.id ? "Hide Hotspot" : "Edit Hotspot"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(interaction.id)}
                      className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hotspot Editor */}
      {selectedInteraction && sourceStep?.previewUrl && (
        <HotspotEditor
          interactionId={selectedInteraction}
          previewUrl={sourceStep.previewUrl}
          onClose={() => setSelectedInteraction(null)}
        />
      )}
    </div>
  );
}
