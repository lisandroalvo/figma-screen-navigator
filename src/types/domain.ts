export type ScreenStatus =
  | "draft"
  | "qa_ready"
  | "deprecated"
  | "archived"
  | "missing_review";

export type ScreenSource = "mock" | "figma" | "manual";

export type RelationshipType =
  | "responsive_variant"
  | "state_variant"
  | "next"
  | "previous"
  | "related"
  | "replaces"
  | "replaced_by";

export type ProposedChangeAction =
  | "new"
  | "update"
  | "rename"
  | "move"
  | "missing"
  | "duplicate"
  | "ambiguous"
  | "delete";

export type SyncJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type ProposedChangeStatus =
  | "pending"
  | "approved"
  | "rejected";

export interface ParentPathItem {
  id: string;
  name: string;
  type:
    | "product"
    | "module"
    | "page"
    | "breakpoint"
    | "group"
    | "screen";
}

/**
 * Flexible metadata captured from a wireframe name.
 * Fields are optional because the slash-separated segments in a Figma
 * name do not always map to the same semantic positions.
 */
export interface ScreenMetadata {
  flow?: string;
  step?: string;
  screen?: string;
  scenario?: string;
  option?: string;
  condition?: string;
  behavior?: string;
  state?: string;
  status?: ScreenStatus;
  keywords?: string[];
  description?: string;
  ambiguityFlags?: string[];
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Module {
  id: string;
  productId: string;
  name: string;
  slug: string;
  figmaFileKey: string;
  figmaFileName?: string | null;
  status: "active" | "draft" | "archived";
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FigmaPage {
  id: string;
  moduleId: string;
  figmaNodeId: string;
  name: string;
  normalizedName: string;
  orderIndex: number;
  isSearchable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Breakpoint {
  id: string;
  figmaPageId: string;
  figmaNodeId: string;
  name: string;
  code?: string | null; // e.g. "xl", "md"
  width?: number | null;
  height?: number | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Screen {
  id: string;
  productId: string;
  moduleId: string;
  figmaPageId: string;
  breakpointId: string;
  figmaFileKey: string;
  figmaPageNodeId: string;
  figmaNodeId: string;
  originalName: string;
  normalizedName: string;
  displayName: string;
  figmaUrl: string;
  previewUrl?: string | null;
  status: ScreenStatus;
  source: ScreenSource;

  // Optional semantic metadata. Most are nullable.
  screen?: string | null;
  flow?: string | null;
  step?: string | null;
  scenario?: string | null;
  option?: string | null;
  condition?: string | null;
  behavior?: string | null;
  state?: string | null;

  keywords: string[];
  description?: string | null;
  parentPath: ParentPathItem[];
  ambiguityFlags: string[];
  metadata: ScreenMetadata;

  lastFigmaModifiedAt?: Date | null;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScreenVariant {
  id: string;
  screenId: string;
  breakpointId?: string | null;
  breakpointCode?: string | null;
  figmaNodeId: string;
  figmaFileKey: string;
  figmaPageNodeId: string;
  originalName: string;
  normalizedName: string;
  figmaUrl: string;
  previewUrl?: string | null;
  width?: number | null;
  height?: number | null;
  parentPath: ParentPathItem[];
  metadata: ScreenMetadata;
  ambiguityFlags: string[];
  isPrimary: boolean;
  status: "active" | "missing_review" | "deprecated" | "archived";
  lastFigmaModifiedAt?: Date | null;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScreenWithVariants extends Screen {
  variants: ScreenVariant[];
}

export interface ScreenRelationship {
  id: string;
  sourceScreenId: string;
  targetScreenId: string;
  type: RelationshipType;
  createdAt: Date;
}

export interface SyncJob {
  id: string;
  moduleId?: string | null;
  status: SyncJobStatus;
  triggeredBy: string;
  startedAt: Date;
  completedAt?: Date | null;
  errorMessage?: string | null;
}

export interface ProposedChange {
  id: string;
  syncJobId: string;
  screenId?: string | null;
  action: ProposedChangeAction;
  status: ProposedChangeStatus;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
}

export interface AuditLog {
  id: string;
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: Date;
}
