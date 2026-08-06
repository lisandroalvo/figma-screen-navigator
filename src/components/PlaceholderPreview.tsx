export function PlaceholderPreview({ label }: { label?: string }) {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded border-2 border-dashed border-zinc-300 bg-zinc-100 p-2 text-center text-zinc-500">
      <span className="text-sm font-medium">Preview placeholder</span>
      {label && (
        <span className="max-w-full truncate text-xs">{label}</span>
      )}
    </div>
  );
}
