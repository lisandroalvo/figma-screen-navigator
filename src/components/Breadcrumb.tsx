import type { ParentPathItem } from "@/types";

export function Breadcrumb({ path }: { path: ParentPathItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {path.map((item, index) => (
          <li key={item.id} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden="true">→</span>}
            <span className="text-zinc-800">{item.name}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
