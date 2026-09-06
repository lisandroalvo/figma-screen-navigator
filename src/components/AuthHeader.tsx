import Link from "next/link";

/**
 * Public Navigator header. Shows only the product identity — no account,
 * role, Admin link, or Sign out. The Navigator is intentionally public, so
 * the same clean header is shown to anonymous and logged-in users alike.
 *
 * Authentication infrastructure is untouched: `/admin/*` still enforces
 * `requireAdmin`, and `/login` + sign-out still work; they are simply not
 * surfaced in the public navigation.
 */
export function AuthHeader() {
  return (
    <header className="border-b border-primary/10 bg-surface">
      <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-primary"
        >
          Figma Screen Navigator
        </Link>
      </div>
    </header>
  );
}
