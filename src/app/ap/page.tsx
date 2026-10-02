import Link from "next/link";
import { QuickFilterChips } from "@/components/ui/QuickFilterChips";
import { getApBrandDelivery, listApPackages, type ApQuickFilter } from "@/lib/queries/ap";
import { getLang, ts } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

const QUICK_FILTERS: ApQuickFilter[] = [
  "ACTIVE PACKAGE",
  "REPORT DUE",
  "MISSING DATA",
  "AWAITING EVIDENCE",
  "READY TO REPORT",
  "REPORTED",
  "ALL",
];

const VIEWS = ["BRAND", "PACKAGE"] as const;
type View = (typeof VIEWS)[number];

function ViewTabs({ active }: { active: View }) {
  return (
    <div className="flex items-center gap-1.5">
      {VIEWS.map((v) => (
        <Link
          key={v}
          href={`/ap?view=${v}`}
          className={`font-mono-tag text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 transition-colors ${
            active === v ? "bg-glass-surface-strong border border-glass-border text-foreground" : "text-foreground-muted hover:bg-glass-surface"
          }`}
        >
          {v}
        </Link>
      ))}
    </div>
  );
}

function BrandDeliveryView({ lang }: { lang: Lang }) {
  const rows = getApBrandDelivery();
  return (
    <div className="px-6 py-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => (
          <Link
            key={r.brand_id}
            href={`/brands/${encodeURIComponent(r.brand_id)}`}
            className="glass rounded-2xl px-4 py-3.5 hover:bg-glass-surface-strong transition-colors flex flex-col gap-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-[13.5px] font-medium truncate">{r.brand_name ?? "—"}</div>
              <span
                className="font-mono-tag text-[10px] uppercase rounded-md px-1.5 py-0.5 shrink-0"
                style={{
                  background: r.status === "COMPLETED" ? "var(--green-bg)" : r.status === "AWAITING PROPOSAL" ? "var(--grey-bg)" : "var(--blue-grey-bg)",
                  color: r.status === "COMPLETED" ? "var(--green)" : r.status === "AWAITING PROPOSAL" ? "var(--grey)" : "var(--blue-grey)",
                }}
              >
                {r.status}
              </span>
            </div>
            <div className="font-mono-tag text-[11px] text-foreground-muted">
              {r.package_count} {ts(lang, "package", "gói")}{r.package_count !== 1 ? "s" : ""} · {r.reported_count}/{r.line_count} {ts(lang, "reported", "đã báo cáo")}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {r.missing_delivery > 0 && (
                <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
                  {r.missing_delivery} MISSING DELIVERY
                </span>
              )}
              {r.missing_data > 0 && (
                <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>
                  {r.missing_data} MISSING DATA
                </span>
              )}
              {r.missing_delivery === 0 && r.missing_data === 0 && (
                <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--green-bg)", color: "var(--green)" }}>
                  ON TRACK
                </span>
              )}
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="col-span-full px-4 py-6 text-center text-[12.5px] text-foreground-muted">{ts(lang, "No brand A&P packages imported", "Chưa nhập gói A&P nào theo thương hiệu")}</div>
        )}
      </div>
    </div>
  );
}

function PackageView({ quick, lang }: { quick: ApQuickFilter; lang: Lang }) {
  const packages = listApPackages(quick);
  return (
    <>
      <QuickFilterChips options={QUICK_FILTERS} active={quick} hrefFor={(o) => `/ap?view=PACKAGE&quick=${encodeURIComponent(o)}`} />
      <div className="px-6 py-5">
        <div className="glass rounded-2xl overflow-hidden">
          {packages.map((p) => (
            <Link
              key={p.id}
              href={`/ap/${encodeURIComponent(p.id)}`}
              className="flex items-center justify-between gap-3 px-4 py-3 border-b border-glass-border/60 last:border-b-0 hover:bg-glass-surface transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate">{p.name}</div>
                <div className="font-mono-tag text-[11px] text-foreground-muted mt-0.5">
                  {p.period_start} → {p.period_end}
                  {p.total_value != null && ` · $${p.total_value.toLocaleString()}`}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono-tag text-[11px] text-foreground-muted">
                  {p.reported_count}/{p.line_count} {ts(lang, "reported", "đã báo cáo")}
                </span>
                <span
                  className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5"
                  style={{
                    background: p.status === "COMPLETED" ? "var(--green-bg)" : p.status === "AWAITING PROPOSAL" ? "var(--grey-bg)" : "var(--blue-grey-bg)",
                    color: p.status === "COMPLETED" ? "var(--green)" : p.status === "AWAITING PROPOSAL" ? "var(--grey)" : "var(--blue-grey)",
                  }}
                >
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
          {packages.length === 0 && (
            <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">{ts(lang, "No packages match this filter", "Không có gói nào khớp bộ lọc này")}</div>
          )}
        </div>
      </div>
    </>
  );
}

export default async function ApPackagesPage({ searchParams }: { searchParams: Promise<{ view?: string; quick?: string }> }) {
  const params = await searchParams;
  const view = ((params.view ?? "BRAND").toUpperCase() as View) in { BRAND: 1, PACKAGE: 1 } ? ((params.view ?? "BRAND").toUpperCase() as View) : "BRAND";
  const quick = (params.quick as ApQuickFilter) ?? "ACTIVE PACKAGE";
  const lang = await getLang();

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-8 pb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">A&amp;P</h1>
          <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
            {ts(lang, "Commercial commitment reconciliation — auto-aggregated agreed vs delivered vs evidence vs reported, never manually ticked", "Đối soát cam kết thương mại — tự động tổng hợp Agreed vs Delivered vs Evidence vs Reported, không tick thủ công")}
          </div>
        </div>
        <ViewTabs active={view} />
      </div>

      {view === "BRAND" && <BrandDeliveryView lang={lang} />}
      {view === "PACKAGE" && <PackageView quick={quick} lang={lang} />}
    </div>
  );
}
