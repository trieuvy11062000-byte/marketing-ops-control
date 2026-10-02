import Link from "next/link";
import {
  getAdjacentMonth,
  getCampaignAssetMatrix,
  getCampaignAssetSummary,
  getDesignAssetQuickCounts,
  getLatestMonth,
  getMonth,
  getMonthlyControlAssets,
  getMonthlyControlFacets,
  listMonths,
  listPortfolios,
  listProductMapping,
  type MonthlyControlFilters,
} from "@/lib/queries/designBriefs";

const VIEWS = ["CONTROL", "SUMMARY", "MATRIX", "PRODUCTS"] as const;
type View = (typeof VIEWS)[number];

const PRIMARY_FILTERS = ["ALL", "CAMPAIGN", "IN-STORE", "DIGITAL", "WEBSITE", "SOCIAL", "EMAIL", "DEMO", "FIXTURE/BRANDING", "PROMOTION SUPPORT", "OTHER"];

const CHANNEL_COLOR: Record<string, string> = {
  "IN-STORE": "var(--green)",
  DIGITAL: "var(--red)",
  WEBSITE: "var(--blue-grey)",
  SOCIAL: "var(--amber)",
  EMAIL: "var(--amber)",
  DEMO: "var(--green)",
  "FIXTURE/BRANDING": "var(--blue-grey)",
  "PROMOTION SUPPORT": "var(--grey)",
  OTHER: "var(--grey)",
};

function ViewTabs({ active, monthId }: { active: View; monthId?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {VIEWS.map((v) => (
        <Link
          key={v}
          href={`/design?view=${v}${monthId ? `&month=${monthId}` : ""}`}
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

function TopSummary() {
  const s = getDesignAssetQuickCounts();
  const chips = [
    { label: "Total Assets", value: s.total },
    { label: "To Check", value: s.toCheck, accent: s.toCheck > 0 },
    { label: "Needs Mapping", value: s.needsMapping, accent: s.needsMapping > 0 },
    { label: "Promotion Conflicts", value: s.promotionConflicts, accent: s.promotionConflicts > 0 },
  ];
  return (
    <div className="flex flex-wrap gap-2.5">
      {chips.map((c) => (
        <div key={c.label} className="glass rounded-xl px-3 py-2 flex flex-col items-start min-w-[110px]">
          <span className="font-mono-tag text-[18px] font-bold" style={{ color: c.accent ? "var(--amber)" : undefined }}>
            {c.value}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso; // raw non-ISO text (e.g. "20/4") — preserved as-is
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase();
}

interface ControlParams {
  month?: string;
  primary?: string;
  portfolio?: string;
  brand?: string;
  activityType?: string;
  assetType?: string;
  needsMapping?: string;
  search?: string;
}

function hrefFor(params: ControlParams, overrides: Partial<ControlParams>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  qs.set("view", "CONTROL");
  if (merged.month) qs.set("month", merged.month);
  if (merged.primary && merged.primary !== "ALL") qs.set("primary", merged.primary);
  if (merged.portfolio) qs.set("portfolio", merged.portfolio);
  if (merged.brand) qs.set("brand", merged.brand);
  if (merged.activityType) qs.set("activityType", merged.activityType);
  if (merged.assetType) qs.set("assetType", merged.assetType);
  if (merged.needsMapping) qs.set("needsMapping", merged.needsMapping);
  if (merged.search) qs.set("search", merged.search);
  return `/design?${qs.toString()}`;
}

function MonthNav({ params }: { params: ControlParams }) {
  const months = listMonths();
  if (months.length === 0) {
    return <div className="font-mono-tag text-[12px] text-foreground-muted">No months imported yet</div>;
  }
  const current = (params.month ? getMonth(params.month) : undefined) ?? getLatestMonth()!;
  const prev = getAdjacentMonth(current.id, -1);
  const next = getAdjacentMonth(current.id, 1);
  return (
    <div className="flex items-center gap-2 font-mono-tag text-[12px]">
      {prev ? (
        <Link href={hrefFor(params, { month: prev.id })} className="rounded-md px-2 py-1 text-foreground-muted hover:bg-glass-surface">
          ← {prev.month_label}
        </Link>
      ) : (
        <span className="rounded-md px-2 py-1 text-foreground-muted/40">← Previous Month</span>
      )}
      <span className="rounded-md px-3 py-1 bg-glass-surface-strong border border-glass-border uppercase font-semibold">{current.month_label}</span>
      {next ? (
        <Link href={hrefFor(params, { month: next.id })} className="rounded-md px-2 py-1 text-foreground-muted hover:bg-glass-surface">
          {next.month_label} →
        </Link>
      ) : (
        <span className="rounded-md px-2 py-1 text-foreground-muted/40">Next Month →</span>
      )}
    </div>
  );
}

function ControlView({ params }: { params: ControlParams }) {
  const months = listMonths();
  const monthId = (params.month ? getMonth(params.month) : undefined) ? params.month : getLatestMonth()?.id;
  const portfolios = listPortfolios();

  const filters: MonthlyControlFilters = {
    monthId,
    primary: params.primary ?? "ALL",
    portfolioId: params.portfolio,
    brandId: params.brand,
    activityType: params.activityType,
    assetType: params.assetType,
    needsMappingOnly: params.needsMapping === "1",
    search: params.search,
  };
  const rows = getMonthlyControlAssets(filters);
  const facets = getMonthlyControlFacets(monthId, params.primary ?? "ALL");

  if (months.length === 0) {
    return <div className="glass rounded-2xl px-4 py-8 text-center text-foreground-muted">No design briefs imported yet — upload one from Import.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <MonthNav params={params} />

      <div className="flex flex-wrap gap-1.5 px-1">
        {PRIMARY_FILTERS.map((p) => (
          <Link
            key={p}
            href={hrefFor(params, { month: monthId, primary: p === "ALL" ? undefined : p })}
            className={`font-mono-tag text-[11px] rounded-md px-2 py-1 ${
              (params.primary ?? "ALL") === p ? "bg-glass-surface-strong" : "text-foreground-muted hover:bg-glass-surface"
            }`}
          >
            {p}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <form method="get" action="/design" className="flex items-center gap-1">
          <input type="hidden" name="view" value="CONTROL" />
          {monthId && <input type="hidden" name="month" value={monthId} />}
          {params.primary && params.primary !== "ALL" && <input type="hidden" name="primary" value={params.primary} />}
          <input
            type="text"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Search Brand / Campaign / SKU / Asset…"
            className="font-mono-tag text-[11.5px] rounded-md px-2.5 py-1.5 bg-glass-surface border border-glass-border min-w-[220px]"
          />
        </form>

        {portfolios.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Link
              href={hrefFor(params, { portfolio: undefined })}
              className={`font-mono-tag text-[11px] rounded-md px-2 py-1 ${!params.portfolio ? "bg-glass-surface-strong" : "text-foreground-muted hover:bg-glass-surface"}`}
            >
              All Portfolios
            </Link>
            {portfolios.map((p) => (
              <Link
                key={p.id}
                href={hrefFor(params, { portfolio: p.id })}
                className={`font-mono-tag text-[11px] rounded-md px-2 py-1 ${params.portfolio === p.id ? "bg-glass-surface-strong" : "text-foreground-muted hover:bg-glass-surface"}`}
              >
                {p.name} ({p.brand_count})
              </Link>
            ))}
          </div>
        )}

        {facets.brands.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Link
              href={hrefFor(params, { brand: undefined })}
              className={`font-mono-tag text-[11px] rounded-md px-2 py-1 ${!params.brand ? "bg-glass-surface-strong" : "text-foreground-muted hover:bg-glass-surface"}`}
            >
              All Brands
            </Link>
            {facets.brands.slice(0, 14).map((b) => (
              <Link
                key={b.id}
                href={hrefFor(params, { brand: b.id })}
                className={`font-mono-tag text-[11px] rounded-md px-2 py-1 ${params.brand === b.id ? "bg-glass-surface-strong" : "text-foreground-muted hover:bg-glass-surface"}`}
              >
                {b.name}
              </Link>
            ))}
          </div>
        )}

        <Link
          href={hrefFor(params, { needsMapping: params.needsMapping === "1" ? undefined : "1" })}
          className="font-mono-tag text-[11px] rounded-md px-2 py-1"
          style={params.needsMapping === "1" ? { background: "var(--amber-bg)", color: "var(--amber)" } : undefined}
        >
          NEEDS MAPPING ONLY
        </Link>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Activity</th>
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Variant</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Products</th>
                <th className="px-3 py-2 font-medium">Promotion</th>
                <th className="px-3 py-2 font-medium">Deadline</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border/60">
              {rows.map((a) => (
                <tr key={a.asset_id} className="hover:bg-glass-surface transition-colors">
                  <td className="px-3 py-2">
                    <Link href={`/design/${encodeURIComponent(a.asset_id)}`} className="hover:underline font-medium">
                      {a.brand_name ?? "NEEDS MAPPING"}
                    </Link>
                    {a.portfolio_name && <div className="font-mono-tag text-[9.5px] text-foreground-muted">{a.portfolio_name}</div>}
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">
                    {a.activity_label ?? "—"}
                    {a.activity_type && <div className="font-mono-tag text-[9.5px] text-foreground-muted/70">{a.activity_type}</div>}
                  </td>
                  <td className="px-3 py-2 font-medium">{a.asset_type}</td>
                  <td className="px-3 py-2 text-foreground-muted">{a.variant_label ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono-tag text-[10px] uppercase" style={{ color: CHANNEL_COLOR[a.channel] }}>
                      {a.channel}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono-tag text-foreground-muted">{a.product_count}</td>
                  <td className="px-3 py-2 text-foreground-muted truncate max-w-[160px]">{a.promotion_mechanic ?? "—"}</td>
                  <td className="px-3 py-2 font-mono-tag text-foreground-muted whitespace-nowrap">{formatDate(a.design_deadline)}</td>
                  <td className="px-3 py-2">
                    {a.confidence !== "HIGH" ? (
                      <span className="font-mono-tag text-[10px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>
                        {a.confidence}
                      </span>
                    ) : (
                      <span className="font-mono-tag text-[10px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--green-bg)", color: "var(--green)" }}>
                        READY
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-foreground-muted">No design assets match this filter</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryView() {
  const rows = getCampaignAssetSummary();
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
              <th className="px-3 py-2 font-medium">Campaign</th>
              <th className="px-3 py-2 font-medium">Brand</th>
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 font-medium">Deadline</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">In-store</th>
              <th className="px-3 py-2 font-medium">Digital</th>
              <th className="px-3 py-2 font-medium">Demo</th>
              <th className="px-3 py-2 font-medium">Other</th>
              <th className="px-3 py-2 font-medium">Needs Mapping</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border/60">
            {rows.map((r) => (
              <tr key={r.design_brief_id} className="hover:bg-glass-surface transition-colors">
                <td className="px-3 py-2 font-medium">{r.campaign_name ?? "—"}</td>
                <td className="px-3 py-2 text-foreground-muted">{r.brand_name ?? "—"}</td>
                <td className="px-3 py-2 font-mono-tag text-foreground-muted">
                  {formatDate(r.period_start)} – {formatDate(r.period_end)}
                </td>
                <td className="px-3 py-2 font-mono-tag text-foreground-muted">{formatDate(r.design_deadline)}</td>
                <td className="px-3 py-2 font-mono-tag">{r.total_assets}</td>
                <td className="px-3 py-2 font-mono-tag text-foreground-muted">{r.in_store}</td>
                <td className="px-3 py-2 font-mono-tag text-foreground-muted">{r.digital}</td>
                <td className="px-3 py-2 font-mono-tag text-foreground-muted">{r.demo}</td>
                <td className="px-3 py-2 font-mono-tag text-foreground-muted">{r.other}</td>
                <td className="px-3 py-2 font-mono-tag" style={{ color: r.needs_mapping > 0 ? "var(--amber)" : undefined }}>{r.needs_mapping}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-foreground-muted">No design briefs imported yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatrixView() {
  const { rows, columns } = getCampaignAssetMatrix();
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="text-left font-mono-tag text-[9.5px] uppercase text-foreground-muted border-b border-glass-border">
              <th className="px-3 py-2 font-medium sticky left-0 bg-surface">Campaign</th>
              {columns.map((c) => (
                <th key={c} className="px-2 py-2 font-medium text-center whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border/60">
            {rows.map((r) => (
              <tr key={r.design_brief_id} className="hover:bg-glass-surface transition-colors">
                <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 bg-surface">{r.campaign_name ?? "—"}</td>
                {columns.map((c) => (
                  <td key={c} className="px-2 py-2 text-center" style={{ color: r.assetTypes.includes(c) ? "var(--green)" : "var(--foreground-muted)" }}>
                    {r.assetTypes.includes(c) ? "✓" : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductsView() {
  const rows = listProductMapping();
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
              <th className="px-3 py-2 font-medium">Campaign</th>
              <th className="px-3 py-2 font-medium">Asset</th>
              <th className="px-3 py-2 font-medium">Variant/Group</th>
              <th className="px-3 py-2 font-medium">Product Code</th>
              <th className="px-3 py-2 font-medium">Product Name</th>
              <th className="px-3 py-2 font-medium">Promotion Channel</th>
              <th className="px-3 py-2 font-medium">Promotion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border/60">
            {rows.map((r, i) => (
              <tr key={`${r.asset_id}-${i}`} className="hover:bg-glass-surface transition-colors">
                <td className="px-3 py-2">
                  <Link href={`/design/${encodeURIComponent(r.asset_id)}`} className="hover:underline">{r.campaign_name ?? "—"}</Link>
                </td>
                <td className="px-3 py-2 text-foreground-muted">{r.asset_type}</td>
                <td className="px-3 py-2 text-foreground-muted">{r.product_group ?? r.variant_label ?? "—"}</td>
                <td className="px-3 py-2 font-mono-tag">{r.product_code ?? "—"}</td>
                <td className="px-3 py-2">{r.product_name ?? "—"}</td>
                <td className="px-3 py-2 font-mono-tag text-foreground-muted">{r.promotion_channel ?? "—"}</td>
                <td className="px-3 py-2 text-foreground-muted">{r.promotion_mechanic ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-foreground-muted">No products mapped yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function DesignAssetsPage({
  searchParams,
}: {
  searchParams: Promise<ControlParams & { view?: string }>;
}) {
  const params = await searchParams;
  const view = ((params.view ?? "CONTROL").toUpperCase() as View) in { CONTROL: 1, SUMMARY: 1, MATRIX: 1, PRODUCTS: 1 }
    ? ((params.view ?? "CONTROL").toUpperCase() as View)
    : "CONTROL";

  const monthLabel = (params.month ? getMonth(params.month) : undefined)?.month_label ?? getLatestMonth()?.month_label ?? null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">
            Design Assets{monthLabel ? ` — ${monthLabel.toUpperCase()}` : ""}
          </h1>
          <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
            Monthly control view — Portfolio → Brand → Activity → Asset → Product, auto-extracted, Leader audit tracked separately
          </div>
        </div>
        <ViewTabs active={view} monthId={params.month} />
      </div>

      <TopSummary />

      {view === "CONTROL" && <ControlView params={params} />}
      {view === "SUMMARY" && <SummaryView />}
      {view === "MATRIX" && <MatrixView />}
      {view === "PRODUCTS" && <ProductsView />}
    </div>
  );
}
