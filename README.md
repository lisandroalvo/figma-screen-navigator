# Figma Screen Navigator

A standalone internal web application for searching, browsing, and inspecting approved Figma screens, responsive views, scenarios, states, and component behaviors.

## Product purpose

Figma remains the source of truth for designs. This portal indexes a controlled subset of Figma wireframes so the QA team can find the exact reference screen without manually navigating multiple Figma files, pages, and responsive containers.

The first implementation targets the **NBF** product and the **Pension Calculation** module.

## Actual Figma hierarchy

- **Figma file** = a **module** (e.g. `Pension Calculation`)
- **Figma page** = a product **page** or functional area (e.g. `Estimate Detail`)
- **Responsive parent frame** = a **breakpoint** or viewport (e.g. `XL – 1280px`)
- **Individual wireframe frame** = a searchable **screen**, scenario, option, condition, state, or component behavior

Example indexed path:

```text
NBF → Pension Calculation → Estimate Detail → XL – 1280px → 50% J&S → Retro → Early
```

### Important naming rule

The slash-separated segments in a wireframe name are **not** guaranteed to represent fixed semantic positions. The application preserves the original Figma name in `originalName` and stores classified metadata (screen, scenario, option, behavior, state, etc.) in separate columns. Ambiguous or unclassifiable segments are flagged for administrative review.

## Technology choices

- **Framework:** Next.js App Router (React, TypeScript strict)
- **Styling:** Tailwind CSS
- **Database:** Supabase Postgres
- **ORM/migrations:** Drizzle ORM
- **Authentication:** Supabase Auth (deferred)
- **Figma integration:**
  - Figma REST API for production synchronization and indexing (deferred)
  - Figma MCP for development-time inspection only (deferred)
- **Testing:** Vitest
- **CI/CD:** GitHub + Vercel (deferred)

## Data-source mode

The application runs in one of two explicit modes, controlled by `DATA_SOURCE` in `.env.local`:

- `DATA_SOURCE=database` — production mode; reads from the Supabase project. Missing database configuration causes a clear error.
- `DATA_SOURCE=mock` — local and test mode; returns the static representative dataset.

Mock mode is intentional only. It will not silently replace a failed production database connection.

## Database architecture

| Entity | Role |
|---|---|
| `Product` | Workspace or product (e.g. NBF) |
| `Module` | Figma file |
| `FigmaPage` | Page or functional area inside a Figma file |
| `Breakpoint` | Responsive parent frame (viewport) |
| `Screen` | Individual searchable wireframe with optional semantic metadata |
| `ScreenRelationship` | Links responsive variants, state variants, next/previous, and related screens |
| `SyncJob` | Record of a Figma scan operation (deferred) |
| `ProposedChange` | Staged change awaiting admin approval (deferred) |
| `AuditLog` | Record of administrative actions (deferred) |

## Supabase setup

A dedicated Supabase project named **figma-screen-navigator** is used for persistence. Drizzle migrations are tracked in `drizzle/migrations/`.

### Local environment

Create `.env.local` with the values from your Supabase project (do not commit it):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
DATABASE_URL=<pooled-connection-string>
DATABASE_DIRECT_URL=<direct-connection-string>
DATA_SOURCE=database

# Deferred
FIGMA_ACCESS_TOKEN=
FIGMA_WEBHOOK_SECRET=
ADMIN_EMAILS=
```

- `DATABASE_URL` is the pooled connection used by the application runtime.
- `DATABASE_DIRECT_URL` is the direct connection used by Drizzle migrations.
- Only `NEXT_PUBLIC_*` values are exposed to the browser.
- `.env.example` contains names and descriptions only.

### Migration workflow

```bash
# Generate a new migration from drizzle/schema.ts
npm run db:generate

# Apply pending migrations to the Supabase project
npm run db:migrate
```

Always inspect generated migration SQL before applying it. Do not use `drizzle-kit push` as the only source of truth.

### Seeding

```bash
# Seed representative development data. Safe to re-run.
npm run db:seed
```

The seed is idempotent; re-running it does not create duplicates.

## Repository and search

Database access is provided through a server-only repository layer in `src/lib/repositories/`:

- `products`: `listProducts`, `getProductBySlug`
- `modules`: `listModules`, `getModuleBySlug`, `listModulesWithCounts`
- `figma-pages`: `listPages`, `listPagesByModule`, `getPageById`
- `breakpoints`: `listBreakpoints`, `getBreakpointById`
- `screens`: `listScreens`, `getScreenById`, `listScreensByModule`, `listRelatedScreens`, `listResponsiveVariants`, `searchScreens`

The public data API in `src/lib/data/index.ts` switches between database and mock mode based on `DATA_SOURCE`.

### Search behavior

The PostgreSQL-backed search in `src/lib/repositories/screens.ts` is deterministic:

- Splits queries on `/`, `-`, `–`, whitespace, and punctuation
- Searches display name, original name, semantic fields, module, page, breakpoint, keywords, and description
- Uses `ILIKE` partial matching and a weighted `CASE` expression for ranking
- Ranks full display-name matches highest, then module/page, then semantic metadata, then keywords/description
- Supports multiple terms, case-insensitive matching, and all UI filters

There is no AI, vector, or external search service.

## Local installation

```bash
cd /Users/lisandroalvo/Desktop/figma-screen-navigator
npm install
```

## Development commands

```bash
npm run dev          # Start the Next.js development server
npm run lint         # Run ESLint
npx tsc --noEmit     # Run TypeScript validation
npm test             # Run Vitest
npm run build        # Build for production
npm run db:generate  # Generate Drizzle migration
npm run db:migrate   # Apply Drizzle migrations
npm run db:seed      # Seed development data
npm run db:smoke     # Quick database integration verification
```

## Mock data

`src/lib/data/mock.ts` contains the original 19-screen representative dataset. It remains available as an explicit test fixture and as `DATA_SOURCE=mock` fallback. It is no longer the default production data source.

## Deployment workflow

The intended flow is:

```text
local feature branch → GitHub PR → Vercel preview → review/approval → merge main → Vercel production
```

No direct pushes to `main`, no history rewrites, no production deploys, and no external service creation will happen without explicit approval.

## Deferred work

- Supabase Authentication and role-based access control
- Figma REST API integration and synchronization
- Sync-job/proposed-change review workflow
- Audit logging in the UI
- GitHub repository and Vercel project setup
- Production deployment
