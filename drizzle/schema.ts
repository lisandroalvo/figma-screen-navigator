import {
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
  "approved",
  "rejected",
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
