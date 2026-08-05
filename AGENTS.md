<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Figma Screen Navigator — Agent Rules

- Never commit or print secrets. `.env.local` is ignored; keep it that way.
- Never modify another project or repository outside this one.
- Never push to GitHub, deploy to Vercel, or connect to remote services unless explicitly authorized for that task.
- Figma is **read-only**. Never make a Figma `POST`, `PUT`, `PATCH`, or `DELETE` request. Never rename, move, or delete Figma nodes or files.
- Figma API tokens are server-only. Never expose them in client components, logs, or the browser bundle.
- Never guess or print Figma tokens. If a token is missing, stop and explain how to create one with the required read-only scopes.
- Use tracked Drizzle migrations (`drizzle/migrations/`). Do not apply destructive migrations (`DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`, bulk deletes) to hosted databases automatically.
- Mock data (`DATA_SOURCE=mock`) must never silently replace failed production database connections.
- Database code lives in server-only modules. Do not import `drizzle-orm` queries or `getDb()` into client components.
- Synchronization scans are read-only. They create `sync_jobs` and `proposed_changes` for review. They do not publish, update, or delete approved `screens` records automatically.
- Missing Figma nodes must be proposed as `missing` for review, not deleted.
- Preserve original Figma names in `originalName`. Use `normalizedName` and `displayName` for derived forms.
- Use Figma node IDs as the primary identity for matching. Do not treat similarly named new nodes as the same record if the node ID changed.
- Flag ambiguity instead of guessing. Ambiguity flags are better than wrong metadata.
- Public QA search returns one logical screen per result, not one card per responsive Figma node.
- Mock records (`source = 'mock'`) are excluded from public search by default and must only be shown when an explicit `includeMock` or `source='mock'` filter is set.
- `screen_variants` stores exact responsive Figma nodes under a logical `screen`. Each logical screen has one primary variant.
- Same-breakpoint collisions must remain unresolved and flagged for manual review. Do not merge them automatically.
- Proposed logical groups in `proposed_changes` are not published records. Public routes must not read from `proposed_changes`.
- Publication is disabled until the review workflow is approved by a human.
