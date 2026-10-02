import Link from "next/link";
import { listBrands } from "@/lib/queries/brands";
import { getLang, ts } from "@/lib/i18n";

export default async function BrandsPage() {
  const brands = listBrands();
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-5">
      <h1 className="text-[22px] font-semibold">{ts(lang, "Brands", "Thương hiệu")}</h1>
      <div className="glass rounded-2xl overflow-hidden">
        {brands.map((b) => (
          <Link
            key={b.id}
            href={`/brands/${encodeURIComponent(b.id)}`}
            className="flex items-center justify-between gap-3 px-4 py-3 border-b border-glass-border/60 last:border-b-0 hover:bg-glass-surface transition-colors"
          >
            <span className="text-[13.5px] font-medium">{b.name}</span>
            <div className="flex items-center gap-4 font-mono-tag text-[11.5px] text-foreground-muted">
              <span>{b.demoSessions} {ts(lang, "demo sessions", "buổi demo")}</span>
              <span>{b.apPackages} {ts(lang, "A&P packages", "gói A&P")}</span>
              <span style={{ color: b.outstandingControls > 0 ? "var(--amber)" : undefined }}>{b.outstandingControls} {ts(lang, "outstanding", "chưa xong")}</span>
              <span style={{ color: b.atRisk > 0 ? "var(--red)" : undefined }}>{b.atRisk} {ts(lang, "at risk", "rủi ro")}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
