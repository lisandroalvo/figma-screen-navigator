export function HierarchyPreview() {
  const items = [
    "NBF",
    "Pension Calculation",
    "Estimate Detail",
    "XL – 1280px",
    "50% J&S",
    "Retro",
    "Early",
  ];

  return (
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Future hierarchy preview
      </h2>
      <ul className="space-y-2">
        {items.map((label, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <span className="w-4 text-zinc-300">
              {index > 0 ? "→" : ""}
            </span>
            <span
              className="text-zinc-800"
              style={{ paddingLeft: `${index * 0.75}rem` }}
            >
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
