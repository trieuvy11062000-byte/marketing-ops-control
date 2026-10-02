import Link from "next/link";
import { compareServiceYears, listServiceCategories, listServiceYears, listServices, listCoverageTerms } from "@/lib/queries/master";
import { getLang } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

const STATUS_COLOR: Record<string, string> = {
  CURRENT: "var(--green)",
  HISTORICAL: "var(--grey)",
  "NEEDS VERIFICATION": "var(--amber)",
};

function PriceCell({ value }: { value: string | null }) {
  return <span className="font-mono-tag">{value ?? "—"}</span>;
}

function ServiceTable({ category, year, lang }: { category: string; year: number; lang: Lang }) {
  const rows = listServices({ year, category });
  if (rows.length === 0) return null;
  return (
    <details id={`svc-${category.replace(/[^a-z0-9]/gi, "-")}`} className="group glass rounded-2xl overflow-hidden">
      <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none hover:bg-glass-surface transition-colors">
        <span className="text-[13px] font-semibold">{category}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono-tag text-[10px] text-foreground-muted">{rows.length} service{rows.length === 1 ? "" : "s"}</span>
          <span className="text-foreground-muted text-[11px] transition-transform group-open:rotate-180">▾</span>
        </div>
      </summary>
      <div className="border-t border-glass-border">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[9%]" />
              <col className="w-[34%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[13%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                <th className="px-3 py-2 font-medium">Service</th>
                <th className="px-3 py-2 font-medium">Package</th>
                <th className="px-3 py-2 font-medium">Description / Mô tả</th>
                <th className="px-3 py-2 font-medium">GBP</th>
                <th className="px-3 py-2 font-medium">USD</th>
                <th className="px-3 py-2 font-medium">EUR</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border/60">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-glass-surface transition-colors align-top">
                  <td className="px-3 py-2.5 font-medium break-words">{r.service_name}</td>
                  <td className="px-3 py-2.5 text-foreground-muted break-words">{r.package ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-foreground leading-relaxed">{r.description}</div>
                    {lang === "vi" && r.description_vi && <div className="text-foreground-muted leading-relaxed mt-1 italic">{r.description_vi}</div>}
                  </td>
                  <td className="px-3 py-2.5"><PriceCell value={r.price_gbp} /></td>
                  <td className="px-3 py-2.5"><PriceCell value={r.price_usd} /></td>
                  <td className="px-3 py-2.5"><PriceCell value={r.price_eur} /></td>
                  <td className="px-3 py-2.5 font-mono-tag text-foreground-muted leading-relaxed">{r.coverage_raw ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono-tag text-[9.5px] uppercase rounded px-1.5 py-0.5 inline-block" style={{ background: "var(--glass-surface)", color: STATUS_COLOR[r.status] }}>
                      {r.status}
                    </span>
                    {r.notes && <div className="text-[10.5px] text-foreground-muted mt-1 leading-relaxed">{r.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function ComparisonView() {
  const rows = compareServiceYears(2027, 2026);
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
              <th className="px-3 py-2 font-medium">Service</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">2026 GBP</th>
              <th className="px-3 py-2 font-medium">2027 GBP</th>
              <th className="px-3 py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border/60">
            {rows.map((r, i) => {
              const gbp2026 = r.b?.price_gbp ?? null;
              const gbp2027 = r.a?.price_gbp ?? null;
              const parse = (s: string | null) => (s ? parseInt(s.replace(/[^\d]/g, ""), 10) : null);
              const n2026 = parse(gbp2026);
              const n2027 = parse(gbp2027);
              const delta = n2026 != null && n2027 != null ? n2027 - n2026 : null;
              return (
                <tr key={i} className="hover:bg-glass-surface transition-colors">
                  <td className="px-3 py-2 font-medium">{r.service_name}</td>
                  <td className="px-3 py-2 text-foreground-muted">{r.category}</td>
                  <td className="px-3 py-2 font-mono-tag text-foreground-muted">{gbp2026 ?? "—"}</td>
                  <td className="px-3 py-2 font-mono-tag">{gbp2027 ?? "—"}</td>
                  <td className="px-3 py-2 font-mono-tag" style={{ color: delta == null ? undefined : delta > 0 ? "var(--amber)" : delta < 0 ? "var(--green)" : undefined }}>
                    {delta == null ? "—" : delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}£${delta}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ year?: string; category?: string; compare?: string }> }) {
  const params = await searchParams;
  const years = listServiceYears();
  const compare = params.compare === "1";
  const year = compare ? undefined : params.year ? parseInt(params.year, 10) : years[0];
  const categories = listServiceCategories(year);
  const coverageTerms = year ? listCoverageTerms(year) : [];
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/master" className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground">← Master</Link>
          <h1 className="text-[22px] font-semibold mt-1">Services & Rate Card</h1>
          <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">Marketing & In-store Promotion Services — stable reference rates, not execution records</div>
        </div>
        <div className="flex items-center gap-1.5">
          {years.map((y) => (
            <Link
              key={y}
              href={`/master/services?year=${y}`}
              className={`font-mono-tag text-[12px] rounded-full px-3 py-1.5 ${!compare && year === y ? "bg-glass-surface-strong border border-glass-border" : "text-foreground-muted hover:bg-glass-surface"}`}
            >
              {y}
            </Link>
          ))}
          <Link
            href="/master/services?compare=1"
            className={`font-mono-tag text-[12px] rounded-full px-3 py-1.5 ${compare ? "bg-glass-surface-strong border border-glass-border" : "text-foreground-muted hover:bg-glass-surface"}`}
          >
            COMPARE 2026 / 2027
          </Link>
        </div>
      </div>

      {compare ? (
        <ComparisonView />
      ) : (
        <>
          {!params.category && categories.map((c) => <ServiceTable key={c} category={c} year={year!} lang={lang} />)}
          {params.category && <ServiceTable category={params.category} year={year!} lang={lang} />}

          {coverageTerms.length > 0 && (
            <section>
              <h2 className="text-[13px] font-semibold mb-2">Coverage Terms ({year})</h2>
              <div className="glass rounded-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-glass-border/60">
                {[...new Set(coverageTerms.map((t) => t.term_type))].map((type) => (
                  <div key={type} className="px-4 py-3 sm:border-r sm:border-glass-border/60 last:border-r-0">
                    <div className="font-mono-tag text-[10px] uppercase text-foreground-muted mb-1">{type}</div>
                    <div className="text-[12.5px] text-foreground-muted">{coverageTerms.filter((t) => t.term_type === type).map((t) => t.term_value).join(" / ")}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
