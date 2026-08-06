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

## Authentication

The application uses **Supabase Auth** with two sign-in methods on the login page:

- **Password** — the primary, recommended production method.
- **Magic link** — secondary; intended for local development and rare recovery use.

### Important: Magic Link in production

Supabase’s built-in email provider has a low project-wide sending rate limit. In production, the Magic link tab will quickly hit this limit and show:

> “Too many sign-in emails were requested. Use Password sign-in or try again later.”

To use Magic Link reliably in production you must configure a **custom SMTP provider** in Supabase (e.g. Resend, SendGrid, AWS SES). Without a custom SMTP provider, the Password tab should be the default sign-in method.

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
| `ScreenVariant` | Exact responsive Figma node under a logical `Screen` |

## Logical screens and responsive variants

A `Screen` is the conceptual, searchable QA reference. A `ScreenVariant` is an exact Figma node for a specific breakpoint (XL, LG, MD, SM, XS). One logical screen may have several responsive variants.

- The parser groups Figma nodes by module, page, and semantic metadata.
- Each logical screen has one primary variant, selected by breakpoint priority: XL, LG, MD, SM, XS.
- Public search returns one logical screen card, not one card per responsive Figma node.
- The screen detail page can switch between exact variants using `?variant=<breakpoint>`.
- `source` distinguishes `figma`, `mock`, and `manual` records. Mock records are excluded from public search by default.
- Same-breakpoint collisions are flagged and must be resolved manually.

## Proposed versus published data

Figma synchronization creates `sync_jobs` and `proposed_changes`. Public QA routes read only published `screens` and `screen_variants`. Admin review routes may read `proposed_changes`. Proposals are not published automatically.

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

## Authentication and roles

Authentication uses **Supabase Auth** with email magic links.

- Users sign in at `/login` and receive a magic link by email.
- The callback at `/login/callback` exchanges the auth code for a session.
- `profiles` stores the user's role:
  - `qa_viewer` — can search and view published screens and variants
  - `design_administrator` — can review, approve, reject, publish, and refresh previews
- The first administrator is bootstrapped via `ADMIN_EMAILS` (server-side, comma-separated, normalized).
- After the first login, the `profiles` role is the source of truth.
- `ADMIN_EMAILS` is only used for bootstrapping; it is never exposed to the browser.

### Protected routes

QA viewer:
- `/`
- `/modules`
- `/modules/[moduleSlug]`
- `/screens/[screenId]`

Design administrator (also includes QA routes):
- `/admin/sync/[jobId]`

All admin server actions (`approveProposal`, `rejectProposal`, `markNeedsReview`, `publishApprovedProposal`) require an authenticated `design_administrator` and derive the actor from the session. The browser cannot supply an actor identity.

### Adding users

1. Invite or have the user sign in with the email magic link.
2. The `profiles` record is created automatically with `qa_viewer`.
3. To make a user an administrator, update their `profiles.role` to `design_administrator` directly in the database (until an admin user-management UI is built).

### Supabase redirect URLs

Configure in Supabase Auth:

- Site URL: `http://localhost:3000` for local development
- Additional redirect URLs:
  - `http://localhost:3000/login/callback`
  - `https://<vercel-preview-domain>/login/callback`
  - `https://<vercel-production-domain>/login/callback`

Do not allow unrestricted redirect domains.

### RLS

Row-level security is intended to be enabled on `profiles`. Application reads use service-role or the authenticated session; mutations happen through server actions. Do not disable RLS for convenience.

## CI / CD

GitHub Actions runs on every push and pull request to `main`:

- `npm ci`
- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`

Live Figma smoke tests are not run in CI unless `FIGMA_ACCESS_TOKEN` and `FIGMA_PENSION_CALCULATION_FILE_KEY` are securely provided.

The Vercel project is connected to the `figma-screen-navigator` GitHub repository. Production deploys from `main`.

## Known limitations

- Magic-link auth only; no password or SSO.
- No admin user-management UI yet.
- Preview images use short-lived Figma CDN URLs; permanent object storage is a post-MVP enhancement.
- Same-breakpoint collision comparison UI is not implemented.
- Only the pilot logical screens are published; the remaining 55 groups are pending review.

## Row-level security

RLS is enabled on all application tables:

- `products`, `modules`, `figma_pages`, `breakpoints` — readable by any authenticated user
- `screens`, `screen_variants` — readable by any authenticated user when `status = 'qa_ready'` and `source = 'figma'`
- `sync_jobs`, `proposed_changes`, `audit_logs`, `screen_relationships` — readable by `design_administrator` only
- `profiles` — users may read their own profile; administrators may read all profiles

No direct client-side write policies are granted. Mutations run through server-side actions using a privileged database role.

Run the RLS smoke test:

```bash
npm run db:rls-smoke
```

This verifies that all required tables have RLS enabled. Supabase Auth policies rely on `auth.uid()` and a `current_user_role()` helper in the public schema.

## Preview refresh

Administrators can refresh Figma previews for individual published screens from the sync job detail page. The button is visible only on published proposals and requires `design_administrator` access.

## GitHub and Vercel setup

1. Install the GitHub CLI: `brew install gh` (or `gh` from official installers)
2. Authenticate: `gh auth login`
3. Create the repository: `gh repo create figma-screen-navigator --private --source=. --push`
4. Install the Vercel CLI: `npm install --global vercel` (or `npx vercel`)
5. Authenticate: `vercel login`
6. Create and link the project: `vercel --confirm`
7. Add environment variables in the Vercel dashboard or via `vercel env add`

## Current published scope

- 12 published Figma screens
- 16 published variants
- 9 mock screens (excluded from public search)
- 55 logical groups pending review

## Known limitations

- Magic-link auth only.
- No admin user-management UI.
- Preview images use Figma CDN URLs; no permanent object storage.
- Same-breakpoint collision comparison UI not built.
- Only the pilot batch is published.
