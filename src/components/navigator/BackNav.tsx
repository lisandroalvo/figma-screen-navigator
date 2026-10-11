"use client";

import { useRouter } from "next/navigation";

/**
 * Prominent back control. Uses real browser history when the user came from
 * inside the app (returns to their exact previous view — search results,
 * scroll position — instant via the router cache). Falls back to the parent
 * level for direct/landed visits (external referrer or new tab).
 */
export default function BackNav({
  fallback,
  label,
}: {
  fallback: string;
  label: string;
}) {
  const router = useRouter();

  const goBack = () => {
    if (document.referrer.startsWith(window.location.origin)) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={`Back to ${label}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-surface px-2.5 py-1.5 text-sm font-medium text-primary shadow-sm hover:border-primary/50 hover:bg-brandbg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      ← Back to {label}
    </button>
  );
}
