"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const [value, setValue] = useState(initialQuery);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (next: string) => {
    setValue(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim().length > 0) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor="search">
        Search screens
      </label>
      <input
        id="search"
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="e.g. pension calculation retro early or contact accordion open"
        className="w-full rounded border border-zinc-300 px-4 py-3 text-lg shadow-sm"
      />
    </div>
  );
}
