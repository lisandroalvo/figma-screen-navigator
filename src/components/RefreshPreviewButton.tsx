"use client";

import { useState } from "react";
import { refreshPreviewsForScreen } from "@/lib/actions/preview-actions";

export function RefreshPreviewButton({
  screenId,
  jobId,
}: {
  screenId: string;
  jobId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await refreshPreviewsForScreen(screenId, jobId);
      setMessage(`Refreshed ${result.updated} previews`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
      >
        {loading ? "Refreshing..." : "Refresh preview"}
      </button>
      {message && (
        <p
          className={`mt-1 text-sm ${
            message.includes("failed") ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
