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
- **Authentication:** Supabase Auth
- **Figma integration:**
  - Figma REST API for production synchronization and indexing
  - Figma MCP for development-time inspection only
- **Testing:** Vitest
- **CI/CD:** GitHub + Vercel

## Current phase

**Phase 2 — Local domain and prototype**

This phase validates the data model and search behavior using local TypeScript types, a Drizzle schema definition, representative mock data, and a working UI. No external services are connected yet.

### What is implemented

- Domain types (`Product`, `Module`, `FigmaPage`, `Breakpoint`, `Screen`, `ScreenRelationship`, `SyncJob`, `ProposedChange`, `AuditLog`)
- Drizzle PostgreSQL schema for all planned tables
- 20+ representative mock screens across three modules
- Local search engine with tokenization, normalization, scoring, and filters
- Prototype UI: search, filters, module browser, module detail, screen detail
- Routes: `/`, `/modules`, `/modules/[moduleSlug]`, `/screens/[screenId]`
- Vitest unit tests for search

### What is deferred

- Supabase project connection
- Authentication and role-based access control
- Database migrations and real persistence
- Figma REST API integration
- Synchronization workflow and admin review
- GitHub repository creation
- Vercel project connection and deployment

## Domain model

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
| `AuditLog` | Record of administrative actions |

## Local mock data

The file `src/lib/data/mock.ts` contains:

- 1 product: NBF
- 3 modules: Pension Calculation, Pensioner Profile, Contract Maintenance
- 10 Figma pages
- 12 breakpoints (XL and MD where applicable)
- 20+ screens covering scenario matrices, component behaviors, states, and responsive variants

## Search behavior

`src/lib/search.ts` implements a local, deterministic search:

- Splits queries on `/`, `-`, `–`, whitespace, and punctuation
- Searches product, module, page, breakpoint, original name, display name, semantic fields, keywords, and description
- Ranks full display-name matches above partial metadata matches
- Ranks module and page matches above keyword-only matches
- Supports multiple terms in any order
- Supports filters: product, module, page, breakpoint, status, behavior, state, scenario

## Routes

| Route | Purpose |
|---|---|
| `/` | Search and filter all screens |
| `/modules` | Browse modules |
| `/modules/[moduleSlug]` | View all screens for a module |
| `/screens/[screenId]` | View a single screen's details |

## Local installation

```bash
cd /Users/lisandroalvo/Desktop/figma-screen-navigator
npm install
```

## Development commands

```bash
npm run dev        # Start the development server
npm run lint       # Run ESLint
npx tsc --noEmit   # Run TypeScript validation
npm test           # Run Vitest
npm run build      # Build for production
```

## Environment-variable requirements

All values are added by you in `.env.local`; secrets are never committed.

| Variable | Visibility | Phase | Status |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public (browser) | required later | deferred |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public (browser) | required later | deferred |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | required later | deferred |
| `DATABASE_URL` | server-only | required later | deferred |
| `FIGMA_ACCESS_TOKEN` | server-only | required later | deferred |
| `FIGMA_WEBHOOK_SECRET` | server-only | optional later | deferred |
| `ADMIN_EMAILS` | server-only | optional later | deferred |

## Security notes

- Figma tokens and Supabase service-role keys are **server-side only**.
- The Figma REST API runs on the server; it is never called from the browser.
- Figma MCP is used only for development-time inspection and is not the production data layer.
- Supabase Row Level Security (RLS) will enforce the QA viewer / design administrator role model once authentication is connected.

## Git and deployment workflow

The intended flow is:

```text
local feature branch → GitHub PR → Vercel preview → review/approval → merge main → Vercel production
```

No direct pushes to `main`, no history rewrites, no production deploys, and no external service creation will happen without explicit approval.

## Replacing mock data with database-backed data

When Supabase is connected, the plan is:

1. Run `drizzle-kit generate` to create migrations from `drizzle/schema.ts`.
2. Apply migrations to the Supabase project.
3. Replace `src/lib/data/mock.ts` with Drizzle queries through `src/lib/db/index.ts`.
4. Update `src/lib/search.ts` to query the database and use the `search_vector` column for full-text search.
5. Add the `pg_trgm` and `tsvector` migration documented in `drizzle/schema.ts`.
