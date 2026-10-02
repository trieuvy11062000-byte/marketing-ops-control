import Link from "next/link";

export function QuickFilterChips({
  options,
  active,
  hrefFor,
  counts,
}: {
  options: string[];
  active: string;
  hrefFor: (option: string) => string;
  counts?: Record<string, number>;
}) {
  return (
    <div className="sticky top-[57px] z-20 px-6 py-2.5 bg-background/80 backdrop-blur-xl border-b border-glass-border flex items-center gap-2 overflow-x-auto">
      {options.map((opt) => {
        const isActive = opt === active;
        return (
          <Link
            key={opt}
            href={hrefFor(opt)}
            className={`shrink-0 font-mono-tag text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 transition-colors ${
              isActive ? "bg-glass-surface-strong border border-glass-border text-foreground" : "text-foreground-muted hover:bg-glass-surface"
            }`}
          >
            {opt}
            {counts?.[opt] != null && <span className="ml-1.5 opacity-70">{counts[opt]}</span>}
          </Link>
        );
      })}
    </div>
  );
}
