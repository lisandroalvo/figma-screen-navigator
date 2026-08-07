"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchBox({
  initialQuery,
  isPending,
}: {
  initialQuery: string;
  isPending: boolean;
}) {
  const [value, setValue] = useState(initialQuery);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const handleChange = (next: string) => {
    setValue(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim().length > 0) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor="search">
        Search screens
      </label>
      <div className="relative">
        <input
          id="search"
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="e.g. pension calculation retro early or contact accordion open"
          className="w-full rounded border border-zinc-300 px-4 py-3 text-lg shadow-sm"
          disabled={isPending}
        />
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          </div>
        )}
      </div>
      {isPending && (
        <p className="text-sm text-zinc-600" aria-live="polite">
          Searching screens...
        </p>
      )}
    </div>
  );
}
