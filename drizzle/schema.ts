import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "qa_viewer",
  "design_administrator",
]);

export const productStatusEnum = pgEnum("product_status", [
  "active",
  "draft",
  "archived",
]);

export const screenStatusEnum = pgEnum("screen_status", [
  "draft",
  "qa_ready",
  "deprecated",
  "archived",
  "missing_review",
]);

export const relationshipTypeEnum = pgEnum("relationship_type", [
  "responsive_variant",
  "state_variant",
  "next",
  "previous",
  "related",
  "replaces",
  "replaced_by",
]);

export const syncJobStatusEnum = pgEnum("sync_job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const flowStatusEnum = pgEnum("flow_status", [
  "draft",
  "review_required",
  "qa_ready",
  "archived",
]);

export const flowStepTypeEnum = pgEnum("flow_step_type", [
  "screen",
  "decision",
]);

export const flowInteractionTriggerEnum = pgEnum("flow_interaction_trigger", [
  "click",
  "branch",
  "next",
]);

export const flowInteractionSourceEnum = pgEnum("flow_interaction_source", [
  "manual",
  "inferred",
]);

export const flowGuidanceTypeEnum = pgEnum("flow_guidance_type", [
  "guidance",
  "action",
  "qa_note",
]);

export const proposedChangeActionEnum = pgEnum("proposed_change_action", [
  "new",
  "update",
  "rename",
  "move",
  "missing",
  "duplicate",
  "ambiguous",
  "delete",
]);

export const proposedChangeStatusEnum = pgEnum("proposed_change_status", [
  "pending",
  "needs_review",
  "approved",
  "rejected",
  "published",
]);

export const screenSourceEnum = pgEnum("screen_source", [
  "mock",
  "figma",
  "manual",
]);

export const screenVariantStatusEnum = pgEnum("screen_variant_status", [
  "active",
  "missing_review",
  "deprecated",
  "archived",
]);

export const productsTable = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const modulesTable = pgTable(
  "modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    figmaFileKey: text("figma_file_key").notNull().unique(),
    figmaFileName: text("figma_file_name"),
    status: productStatusEnum("status").default("active").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique("module_product_slug").on(table.productId, table.slug)],
);

export const figmaPagesTable = pgTable(
  "figma_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modulesTable.id, { onDelete: "cascade" }),
    figmaNodeId: text("figma_node_id").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    orderIndex: integer("order_index").notNull(),
    isSearchable: boolean("is_searchable").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("page_module_node").on(table.moduleId, table.figmaNodeId),
    index("page_module_idx").on(table.moduleId),
  ],
);

export const breakpointsTable = pgTable(
  "breakpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    figmaPageId: uuid("figma_page_id")
      .notNull()
      .references(() => figmaPagesTable.id, { onDelete: "cascade" }),
    figmaNodeId: text("figma_node_id").notNull(),
    name: text("name").notNull(),
    code: text("code"),
    width: integer("width"),
    height: integer("height"),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("breakpoint_page_node").on(table.figmaPageId, table.figmaNodeId),
    index("breakpoint_page_idx").on(table.figmaPageId),
  ],
);

export const screensTable = pgTable(
  "screens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modulesTable.id),
    figmaPageId: uuid("figma_page_id")
      .notNull()
      .references(() => figmaPagesTable.id),
    breakpointId: uuid("breakpoint_id")
      .notNull()
      .references(() => breakpointsTable.id),
    figmaFileKey: text("figma_file_key").notNull(),
    figmaPageNodeId: text("figma_page_node_id").notNull(),
    figmaNodeId: text("figma_node_id").notNull(),
    originalName: text("original_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    displayName: text("display_name").notNull(),
    figmaUrl: text("figma_url").notNull(),
    previewUrl: text("preview_url"),
    previewStoragePath: text("preview_storage_path"),
    previewUpdatedAt: timestamp("preview_updated_at", {
      withTimezone: true,
    }),
    status: screenStatusEnum("status").default("draft").notNull(),

    // Optional semantic metadata columns
    screen: text("screen"),
    flow: text("flow"),
    step: text("step"),
    scenario: text("scenario"),
    option: text("option"),
    condition: text("condition"),
    behavior: text("behavior"),
    state: text("state"),

    keywords: jsonb("keywords").$type<string[]>().default([]).notNull(),
    description: text("description"),
    parentPath: jsonb("parent_path").default([]).notNull(),
    ambiguityFlags: jsonb("ambiguity_flags").$type<string[]>().default([]).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    source: screenSourceEnum("source").default("figma").notNull(),

    lastFigmaModifiedAt: timestamp("last_figma_modified_at", {
      withTimezone: true,
    }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("screen_module_node").on(table.moduleId, table.figmaNodeId),
    index("screen_product_idx").on(table.productId),
    index("screen_module_idx").on(table.moduleId),
    index("screen_page_idx").on(table.figmaPageId),
    index("screen_breakpoint_idx").on(table.breakpointId),
    index("screen_status_idx").on(table.status),
    index("screen_scenario_idx").on(table.scenario),
    index("screen_option_idx").on(table.option),
    index("screen_state_idx").on(table.state),
    index("screen_behavior_idx").on(table.behavior),
    index("screen_display_name_trgm_idx").on(table.displayName), // requires pg_trgm extension + migration
  ],
);

export const screenVariantsTable = pgTable(
  "screen_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    screenId: uuid("screen_id")
      .notNull()
      .references(() => screensTable.id, { onDelete: "cascade" }),
    breakpointId: uuid("breakpoint_id").references(() => breakpointsTable.id, {
      onDelete: "set null",
    }),
    breakpointCode: text("breakpoint_code"),
    figmaNodeId: text("figma_node_id").notNull(),
    figmaFileKey: text("figma_file_key").notNull(),
    figmaPageNodeId: text("figma_page_node_id").notNull(),
    originalName: text("original_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    figmaUrl: text("figma_url").notNull(),
    previewUrl: text("preview_url"),
    previewStoragePath: text("preview_storage_path"),
    previewUpdatedAt: timestamp("preview_updated_at", {
      withTimezone: true,
    }),
    width: integer("width"),
    height: integer("height"),
    parentPath: jsonb("parent_path").default([]).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    ambiguityFlags: jsonb("ambiguity_flags").$type<string[]>().default([]).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    status: screenVariantStatusEnum("status").default("active").notNull(),
    previewGeneratedAt: timestamp("preview_generated_at", {
      withTimezone: true,
    }),
    previewExpiresAt: timestamp("preview_expires_at", {
      withTimezone: true,
    }),
    previewStatus: text("preview_status"),
    previewError: text("preview_error"),
    lastPreviewRefreshAt: timestamp("last_preview_refresh_at", {
      withTimezone: true,
    }),
    lastFigmaModifiedAt: timestamp("last_figma_modified_at", {
      withTimezone: true,
    }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("variant_screen_node").on(table.screenId, table.figmaNodeId),
    index("variant_screen_idx").on(table.screenId),
    index("variant_breakpoint_idx").on(table.breakpointId),
    index("variant_breakpoint_code_idx").on(table.breakpointCode),
    index("variant_primary_idx").on(table.isPrimary),
    index("variant_status_idx").on(table.status),
  ],
);

export const screenRelationshipsTable = pgTable(
  "screen_relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceScreenId: uuid("source_screen_id")
      .notNull()
      .references(() => screensTable.id, { onDelete: "cascade" }),
    targetScreenId: uuid("target_screen_id")
      .notNull()
      .references(() => screensTable.id, { onDelete: "cascade" }),
    type: relationshipTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("rel_source_idx").on(table.sourceScreenId),
    index("rel_target_idx").on(table.targetScreenId),
    index("rel_type_idx").on(table.type),
    unique("rel_unique").on(
      table.sourceScreenId,
      table.targetScreenId,
      table.type,
    ),
  ],
);

export const syncJobsTable = pgTable("sync_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id").references(() => modulesTable.id, {
    onDelete: "set null",
  }),
  status: syncJobStatusEnum("status").default("pending").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
});

export const proposedChangesTable = pgTable(
  "proposed_changes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    syncJobId: uuid("sync_job_id")
      .notNull()
      .references(() => syncJobsTable.id, { onDelete: "cascade" }),
    screenId: uuid("screen_id").references(() => screensTable.id, {
      onDelete: "set null",
    }),
    action: proposedChangeActionEnum("action").notNull(),
    status: proposedChangeStatusEnum("status").default("pending").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
  },
  (table) => [
    index("proposed_change_job_idx").on(table.syncJobId),
    index("proposed_change_screen_idx").on(table.screenId),
    index("proposed_change_status_idx").on(table.status),
  ],
);

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("audit_entity_idx").on(table.entity, table.entityId)],
);

export const profilesTable = pgTable(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    email: text("email").notNull(),
    role: userRoleEnum("role").default("qa_viewer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("profile_user_id_idx").on(table.userId)],
);

// SQL to add in a later migration for PostgreSQL full-text search:
// ALTER TABLE screens ADD COLUMN search_vector tsvector
//   GENERATED ALWAYS AS (
//     to_tsvector('english',
//       coalesce(display_name, '') || ' ' ||
//       coalesce(original_name, '') || ' ' ||
//       coalesce(scenario, '') || ' ' ||
//       coalesce(option, '') || ' ' ||
//       coalesce(state, '') || ' ' ||
//       coalesce(behavior, '') || ' ' ||
//       coalesce(description, '') || ' ' ||
//       coalesce(array_to_string(keywords, ' '), '')
//     )
//   ) STORED;
// CREATE INDEX screens_search_vector_idx ON screens USING GIN (search_vector);

// ============================================================
// FLOW DOMAIN TABLES
// ============================================================

export const flowsTable = pgTable(
  "flows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modulesTable.id, { onDelete: "cascade" }),
    figmaPageId: uuid("figma_page_id")
      .notNull()
      .references(() => figmaPagesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    figmaFileKey: text("figma_file_key").notNull(),
    figmaSectionNodeId: text("figma_section_node_id").notNull(),
    figmaUrl: text("figma_url").notNull(),
    previewUrl: text("preview_url"),
    previewStoragePath: text("preview_storage_path"),
    // Explicit entry point for the interactive player. Nullable so existing
    // flows keep working; set to null if the referenced step is deleted.
    startStepId: uuid("start_step_id").references(
      (): AnyPgColumn => flowStepsTable.id,
      { onDelete: "set null" },
    ),
    status: flowStatusEnum("status").default("draft").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("flow_module_section").on(table.moduleId, table.figmaSectionNodeId),
    index("flow_module_idx").on(table.moduleId),
    index("flow_page_idx").on(table.figmaPageId),
    index("flow_status_idx").on(table.status),
  ],
);

/**
 * flow_screens — the SCREEN leaf of the Module -> Page -> Flow -> Screen
 * hierarchy (added 2026-08-21 as an Annuity pilot). A Screen is the root
 * wireframe/state FRAME detected inside a Flow SECTION. This is a NEW dedicated
 * additive table (not the legacy `screens` table, which has a NOT NULL
 * breakpointId page-scoped model and is consumed by the frozen screen-search
 * sync/publish/preview system; and not `flow_steps`, which is owned by the
 * FlowPlayer/Golden Flow). Isolating screens here keeps this pilot from
 * touching either system. Identity is file-scoped: (moduleId, figmaNodeId).
 */
export const flowScreensTable = pgTable(
  "flow_screens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modulesTable.id, { onDelete: "cascade" }),
    figmaPageId: uuid("figma_page_id")
      .notNull()
      .references(() => figmaPagesTable.id, { onDelete: "cascade" }),
    // Nullable: screens may live under any SECTION, not only a top-level Flow.
    flowId: uuid("flow_id").references(() => flowsTable.id, { onDelete: "cascade" }),
    figmaFileKey: text("figma_file_key").notNull(),
    figmaPageNodeId: text("figma_page_node_id").notNull(),
    figmaSectionNodeId: text("figma_section_node_id"),
    // Nearest parent SECTION + Flow context (resolved during global detection).
    parentSectionNodeId: text("parent_section_node_id"),
    parentSectionName: text("parent_section_name"),
    parentFlowNodeId: text("parent_flow_node_id"),
    parentFlowName: text("parent_flow_name"),
    // The SCREEN root node id (file-scoped). Deep links target THIS node.
    figmaNodeId: text("figma_node_id").notNull(),
    // Figma node name (may be auto "Frame 8948459"), kept for traceability.
    figmaFrameName: text("figma_frame_name").notNull(),
    // Authored screen name (the frame's title TEXT child); the searchable name.
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    // Additive search enrichment (2026-09): authored layer-name titles found
    // inside the accepted screen (e.g. "Rate Group Modal") + deterministic
    // normalized aliases. Do NOT affect detection/identity; discoverability only.
    searchTitles: text("search_titles").array(),
    searchAliases: text("search_aliases").array(),
    figmaUrl: text("figma_url").notNull(),
    width: integer("width"),
    height: integer("height"),
    detectionConfidence: text("detection_confidence").notNull(),
    detectionReason: text("detection_reason"),
    // 'detected' = high-confidence auto-indexed; 'needs_review' = ambiguous.
    status: text("status").default("detected").notNull(),
    orderIndex: integer("order_index"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("flow_screen_module_node").on(table.moduleId, table.figmaNodeId),
    index("flow_screen_flow_idx").on(table.flowId),
    index("flow_screen_module_idx").on(table.moduleId),
    index("flow_screen_page_idx").on(table.figmaPageId),
    index("flow_screen_status_idx").on(table.status),
    index("flow_screen_normalized_idx").on(table.normalizedName),
  ],
);

/**
 * flow_sections — every searchable Figma SECTION node (added 2026-08-23 as an
 * Annuity pilot). FLOW = Figma SECTION, but the interactive `flows` table only
 * holds top-level "- Flow" containers (with status/startStepId/interactions/
 * Golden Flow). This additive, SEARCH-ONLY table lets ANY authored SECTION
 * (including nested ones like "Add Beneficiary Modal", "Pop Up", "Table") be
 * found by substring without overloading interactive Flow semantics. It carries
 * NO player/status data. Identity is file-scoped: (moduleId, figmaNodeId). The
 * Navigator hides sections whose node id is already a top-level Flow, so a
 * "- Flow" section shows once (as FLOW), never duplicated as SECTION.
 */
export const flowSectionsTable = pgTable(
  "flow_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modulesTable.id, { onDelete: "cascade" }),
    figmaPageId: uuid("figma_page_id")
      .notNull()
      .references(() => figmaPagesTable.id, { onDelete: "cascade" }),
    figmaFileKey: text("figma_file_key").notNull(),
    figmaPageNodeId: text("figma_page_node_id").notNull(),
    // The SECTION node id (file-scoped). Deep links target THIS node.
    figmaNodeId: text("figma_node_id").notNull(),
    parentNodeId: text("parent_node_id"),
    parentName: text("parent_name"),
    // Nearest ancestor SECTION whose name ends "- flow" (if any). Lets a result
    // show "› parent Flow" only when the hierarchy genuinely proves one.
    parentFlowNodeId: text("parent_flow_node_id"),
    parentFlowName: text("parent_flow_name"),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    figmaUrl: text("figma_url").notNull(),
    depth: integer("depth"),
    // true when name ends "- flow" (also a top-level interactive Flow container).
    isFlowContainer: boolean("is_flow_container").default(false).notNull(),
    status: text("status").default("detected").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("flow_section_module_node").on(table.moduleId, table.figmaNodeId),
    index("flow_section_module_idx").on(table.moduleId),
    index("flow_section_page_idx").on(table.figmaPageId),
    index("flow_section_status_idx").on(table.status),
    index("flow_section_normalized_idx").on(table.normalizedName),
  ],
);

export const flowStepsTable = pgTable(
  "flow_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => flowsTable.id, { onDelete: "cascade" }),
    figmaNodeId: text("figma_node_id").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    // Human-verified display label (Figma frame name is kept in `name`).
    displayName: text("display_name"),
    stepType: flowStepTypeEnum("step_type").default("screen").notNull(),
    previewUrl: text("preview_url"),
    previewStoragePath: text("preview_storage_path"),
    figmaX: integer("figma_x"),
    figmaY: integer("figma_y"),
    figmaWidth: integer("figma_width"),
    figmaHeight: integer("figma_height"),
    displayOrder: integer("display_order"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("flow_step_node").on(table.flowId, table.figmaNodeId),
    index("flow_step_flow_idx").on(table.flowId),
  ],
);

export const flowInteractionsTable = pgTable(
  "flow_interactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => flowsTable.id, { onDelete: "cascade" }),
    sourceStepId: uuid("source_step_id")
      .notNull()
      .references(() => flowStepsTable.id, { onDelete: "cascade" }),
    destinationStepId: uuid("destination_step_id")
      .notNull()
      .references(() => flowStepsTable.id, { onDelete: "cascade" }),
    label: text("label"),
    trigger: flowInteractionTriggerEnum("trigger").default("click").notNull(),
    source: flowInteractionSourceEnum("source").default("manual").notNull(),
    reviewStatus: text("review_status").default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("flow_interaction_flow_idx").on(table.flowId),
    index("flow_interaction_source_idx").on(table.sourceStepId),
  ],
);

export const flowHotspotsTable = pgTable(
  "flow_hotspots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    interactionId: uuid("interaction_id")
      .notNull()
      .references(() => flowInteractionsTable.id, { onDelete: "cascade" }),
    xPercent: integer("x_percent").notNull(),
    yPercent: integer("y_percent").notNull(),
    widthPercent: integer("width_percent").notNull(),
    heightPercent: integer("height_percent").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("flow_hotspot_interaction_idx").on(table.interactionId)],
);

export const flowGuidanceTable = pgTable(
  "flow_guidance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => flowsTable.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => flowStepsTable.id, {
      onDelete: "cascade",
    }),
    figmaNodeId: text("figma_node_id").notNull(),
    text: text("text").notNull(),
    guidanceType: flowGuidanceTypeEnum("guidance_type")
      .default("guidance")
      .notNull(),
    // A note may belong to a screen, an interaction, a decision, or the whole
    // flow. scope selects which association column is authoritative.
    scope: text("scope").default("step").notNull(), // flow | step | interaction | decision
    interactionId: uuid("interaction_id").references(
      (): AnyPgColumn => flowInteractionsTable.id,
      { onDelete: "set null" },
    ),
    decisionStepId: uuid("decision_step_id").references(
      (): AnyPgColumn => flowStepsTable.id,
      { onDelete: "set null" },
    ),
    // Richer classification kept alongside the coarse guidanceType enum.
    category: text("category"), // USER_GUIDANCE | ACTION_INSTRUCTION | QA_NOTE | EXPLANATION | DECISION_CONTEXT | GENERAL_FLOW_NOTE
    confidence: text("confidence"), // low | medium | high
    reviewStatus: text("review_status").default("proposed").notNull(), // proposed | approved | rejected | needs_review
    // Position metadata from Figma (traceability / re-association).
    figmaX: integer("figma_x"),
    figmaY: integer("figma_y"),
    figmaWidth: integer("figma_width"),
    figmaHeight: integer("figma_height"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("flow_guidance_flow_idx").on(table.flowId),
    index("flow_guidance_step_idx").on(table.stepId),
    index("flow_guidance_interaction_idx").on(table.interactionId),
    index("flow_guidance_review_idx").on(table.reviewStatus),
  ],
);
