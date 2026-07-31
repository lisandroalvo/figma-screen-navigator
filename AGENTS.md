<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Figma Screen Navigator — Agent Rules

- Never commit or print secrets. `.env.local` is ignored; keep it that way.
- Never modify another project or repository outside this one.
- Never push to GitHub, deploy to Vercel, or connect to remote services unless explicitly authorized for that task.
- Figma is read-only unless explicitly authorized. Do not modify Figma files, pages, or nodes.
- Use tracked Drizzle migrations (`drizzle/migrations/`). Do not apply destructive migrations (`DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`, bulk deletes) to hosted databases automatically.
- Mock data (`DATA_SOURCE=mock`) must never silently replace failed production database connections.
- Database code lives in server-only modules. Do not import `drizzle-orm` queries or `getDb()` into client components.
