import Link from "next/link";
import { search } from "@/lib/queries/search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const groups = search(q);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-5">
      <h1 className="text-[22px] font-semibold">
        Search: <span className="text-foreground-muted">{q}</span>
      </h1>
      {groups.length === 0 && <div className="glass rounded-2xl px-4 py-8 text-center text-[13px] text-foreground-muted">No matches</div>}
      {groups.map((g) => (
        <section key={g.label} className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-glass-border font-mono-tag text-[11px] uppercase text-foreground-muted">{g.label}</div>
          {g.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between px-4 py-2.5 border-b border-glass-border/60 last:border-b-0 hover:bg-glass-surface transition-colors"
            >
              <span className="text-[13px]">{item.title}</span>
              {item.subtitle && <span className="font-mono-tag text-[11px] text-foreground-muted">{item.subtitle}</span>}
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
