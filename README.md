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
  - Figma REST API for production synchronization (Phase 4)
  - Figma MCP for read-only development inspection
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
| `SyncJob` | Record of a Figma scan operation |
| `ProposedChange` | Staged change awaiting admin approval |
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

# Figma (server-only)
FIGMA_ACCESS_TOKEN=<read-only-token-with-file_content:read+file_metadata:read>
FIGMA_PENSION_CALCULATION_FILE_KEY=<file-key-between-/design/-and-next-/>
FIGMA_WEBHOOK_SECRET=

# Admin (deferred)
ADMIN_EMAILS=
```

- `DATABASE_URL` is the pooled connection used by the application runtime.
- `DATABASE_DIRECT_URL` is the direct connection used by Drizzle migrations.
- Only `NEXT_PUBLIC_*` values are exposed to the browser.
- `.env.example` contains names and descriptions only.

### Figma token permissions

The Figma personal access token must have these read-only scopes:

- `file_content:read`
- `file_metadata:read`

No write scopes are requested or used. The token is server-only and never exposed to the browser.

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

## Figma integration

### Architecture

All Figma API calls are isolated in `src/lib/figma/client.ts`. That module is server-only, stores the token in environment variables only, and uses bounded exponential backoff for 429 and 5xx errors.

`src/lib/figma/parser.ts` turns a Figma document tree into `FigmaScreenCandidate` objects. It:

- Ignores prototype, documentation, and cover pages
- Detects breakpoint frames by name pattern and dimensions (`XL`, `LG`, `MD`, `SM` plus a pixel dimension)
- Recurses through page trees and identifies leaf wireframes
- Ignores tiny, generic, decorative, and internal component frames
- Splits wireframe names on delimiters and classifies segments using controlled dictionaries
- Flags ambiguous metadata (duplicate states, duplicate behaviors, unclassified segments)

`src/lib/figma/sync.ts` runs a read-only scan for the configured `Pension Calculation` file. It:

- Fetches the file through the REST API
- Parses the hierarchy and detects candidates
- Compares discovered Figma node IDs with existing database records
- Creates one `sync_jobs` row and one `proposed_changes` row per candidate
- Does **not** modify published `screens` records
- Does **not** delete missing records; it creates `missing` proposals for review

### Synchronization proposal workflow

1. An administrator visits `/admin/sync`.
2. The page is clearly labeled as an internal prototype with no authentication.
3. Running the scan creates a `sync_jobs` row and `proposed_changes` rows.
4. The job detail page (`/admin/sync/[jobId]`) shows counts and a preview list.
5. Every proposal has a `before` snapshot, `after` snapshot, and a reason.
6. Changes are not published until a future approval flow is implemented.

### Preview images

The Figma REST API `/v1/images/{fileKey}` endpoint is used to request short-lived PNG URLs. These URLs are temporary and refreshed during approved synchronization. The application does not store image files permanently in this phase.

### Rate limits

The client retries 429 responses using the `Retry-After` header and 5xx responses with exponential backoff. Scan jobs are not run automatically on page load.

### Read-only guarantee

The integration only uses `GET` endpoints. No Figma `POST`, `PUT`, `PATCH`, or `DELETE` calls are made. No Figma node names, metadata, or contents are modified.

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
npm run figma:smoke  # Quick Figma integration verification
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

- Supabase Authentication and role-based access control for `/admin/*`
- Figma webhook / automatic scan scheduling
- Proposed-change approval and publish flow
- Audit logging in the UI
- GitHub repository and Vercel project setup
- Production deployment
