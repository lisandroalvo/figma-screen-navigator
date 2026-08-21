export interface Flow {
  id: string;
  productId: string;
  moduleId: string;
  figmaPageId: string;
  name: string;
  normalizedName: string;
  figmaFileKey: string;
  figmaSectionNodeId: string;
  figmaUrl: string;
  previewUrl: string | null;
  previewStoragePath: string | null;
  startStepId: string | null;
  status: "draft" | "review_required" | "qa_ready" | "archived";
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Denormalized for search/display
  productName?: string | null;
  productSlug?: string | null;
  moduleName?: string | null;
  moduleSlug?: string | null;
  pageName?: string | null;
}

export interface FlowStep {
  id: string;
  flowId: string;
  figmaNodeId: string;
  name: string;
  normalizedName: string;
  displayName: string | null;
  stepType: "screen" | "decision";
  previewUrl: string | null;
  previewStoragePath: string | null;
  figmaX: number | null;
  figmaY: number | null;
  figmaWidth: number | null;
  figmaHeight: number | null;
  displayOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlowInteraction {
  id: string;
  flowId: string;
  sourceStepId: string;
  destinationStepId: string;
  label: string | null;
  trigger: "click" | "branch" | "next";
  source: "manual" | "inferred";
  reviewStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlowHotspot {
  id: string;
  interactionId: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type GuidanceScope = "flow" | "step" | "interaction" | "decision";
export type GuidanceReviewStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "needs_review";
export type GuidanceCategory =
  | "USER_GUIDANCE"
  | "ACTION_INSTRUCTION"
  | "QA_NOTE"
  | "EXPLANATION"
  | "DECISION_CONTEXT"
  | "GENERAL_FLOW_NOTE";

export interface FlowGuidance {
  id: string;
  flowId: string;
  stepId: string | null;
  interactionId: string | null;
  decisionStepId: string | null;
  figmaNodeId: string;
  text: string;
  guidanceType: "guidance" | "action" | "qa_note";
  scope: GuidanceScope;
  category: GuidanceCategory | null;
  confidence: string | null;
  reviewStatus: GuidanceReviewStatus;
  figmaX: number | null;
  figmaY: number | null;
  figmaWidth: number | null;
  figmaHeight: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Extended types for Flow Player
export interface FlowStepWithInteractions extends FlowStep {
  outgoingInteractions: Array<FlowInteraction & { hotspot?: FlowHotspot }>;
  guidance: FlowGuidance[];
}

export interface FlowWithSteps extends Flow {
  steps: FlowStepWithInteractions[];
  totalSteps: number;
}
