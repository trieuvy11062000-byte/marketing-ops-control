import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBrand,
  getBrandApPackages,
  getBrandCampaigns,
  getBrandDemoSessions,
  getBrandPromotionCount,
} from "@/lib/queries/brands";
import { getBrandDemoPerformanceSummary, getBrandWeeklyTrend, getBrandProductPerformance } from "@/lib/queries/demoReports";
import { getBrandDesignActivities } from "@/lib/queries/designBriefs";
import { getLang, ts } from "@/lib/i18n";
import { td } from "@/lib/i18nDict";
import type { Lang } from "@/lib/i18n";

const ACTIVITY_TYPE_ORDER = ["CAMPAIGN", "PROMOTION", "IN-STORE", "DIGITAL", "A&P", "OTHER"] as const;

function BrandDesignActivitiesSection({ brandId, lang }: { brandId: string; lang: Lang }) {
  const activities = getBrandDesignActivities(brandId);
  if (activities.length === 0) return null;

  const byType = new Map<string, typeof activities>();
  for (const a of activities) {
    (byType.get(a.activity_type) ?? byType.set(a.activity_type, []).get(a.activity_type)!).push(a);
  }
  const orderedTypes = [...ACTIVITY_TYPE_ORDER.filter((t) => byType.has(t)), ...[...byType.keys()].filter((t) => !(ACTIVITY_TYPE_ORDER as readonly string[]).includes(t))];

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[13px] font-semibold">{ts(lang, "Design & Activities", "Design & Hoạt động")}</h2>
        <Link href={`/design?view=CONTROL&brand=${encodeURIComponent(brandId)}`} className="font-mono-tag text-[11px] text-foreground-muted hover:underline">
          {ts(lang, "Open in Design Assets", "Mở trong Design Assets")} →
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {orderedTypes.map((type) => (
          <div key={type} className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-glass-border text-[11px] font-mono-tag uppercase tracking-wide text-foreground-muted">{type}</div>
            <div className="divide-y divide-glass-border/60">
              {byType.get(type)!.map((a) => (
                <div key={a.activity_id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[13px]">{a.activity_label}</span>
                    {a.promotion_mechanic && <span className="font-mono-tag text-[10.5px] text-foreground-muted">{a.promotion_mechanic}</span>}
                  </div>
                  <div className="flex items-center gap-3 font-mono-tag text-[11px] text-foreground-muted shrink-0">
                    {a.month_label && <span>{a.month_label}</span>}
                    <span>{a.asset_count} asset{a.asset_count === 1 ? "" : "s"}</span>
                    <span>{a.product_count} SKU{a.product_count === 1 ? "" : "s"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function fmt1(n: number | null): string {
  return n == null ? "—" : n.toFixed(1);
}

function BrandDemoPerformanceSection({ brandId, lang }: { brandId: string; lang: Lang }) {
  const summary = getBrandDemoPerformanceSummary(brandId);
  if (summary.demoWeeksCount === 0) return null;

  const trend = getBrandWeeklyTrend(brandId);
  const { best, low } = getBrandProductPerformance(brandId);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[13px] font-semibold">{ts(lang, "Demo Performance", "Hiệu quả Demo")}</h2>
        <span className="font-mono-tag text-[10.5px] text-foreground-muted">{ts(lang, "Marketing activation effectiveness — not a sales dashboard", "Hiệu quả hoạt động Marketing — không phải báo cáo doanh số")}</span>
      </div>

      <div className="glass rounded-2xl px-4 py-3 flex flex-wrap gap-4 mb-3">
        <div className="flex flex-col"><span className="font-mono-tag text-[16px] font-bold">{summary.demoWeeksCount}</span><span className="text-[10px] uppercase text-foreground-muted">{ts(lang, "Demo Weeks", "Tuần Demo")}</span></div>
        <div className="flex flex-col"><span className="font-mono-tag text-[16px] font-bold">{summary.demoSessionsCount}</span><span className="text-[10px] uppercase text-foreground-muted">{ts(lang, "Demo Sessions", "Buổi Demo")}</span></div>
        <div className="flex flex-col"><span className="font-mono-tag text-[16px] font-bold">{summary.storesActivatedCount}</span><span className="text-[10px] uppercase text-foreground-muted">{ts(lang, "Stores Activated", "Cửa hàng kích hoạt")}</span></div>
        <div className="flex flex-col"><span className="font-mono-tag text-[16px] font-bold">{summary.demoPeriodSalesTotal}</span><span className="text-[10px] uppercase text-foreground-muted">{ts(lang, "Demo-period Sales", "Doanh số thời gian Demo")}</span></div>
        <div className="flex flex-col"><span className="font-mono-tag text-[16px] font-bold">{summary.avgUplift != null ? `${fmt1(summary.avgUplift)}x` : "—"}</span><span className="text-[10px] uppercase text-foreground-muted">{ts(lang, "Avg Uplift", "Tăng trưởng TB")}</span></div>
        <div className="flex flex-col"><span className="font-mono-tag text-[16px] font-bold">{summary.totalFoc}</span><span className="text-[10px] uppercase text-foreground-muted">FOC</span></div>
      </div>

      {trend.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden mb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                  <th className="px-4 py-2 font-medium">{td(lang, "Week")}</th>
                  <th className="px-4 py-2 font-medium">{td(lang, "Promotion")}</th>
                  <th className="px-4 py-2 font-medium">{ts(lang, "Sales", "Doanh số")}</th>
                  <th className="px-4 py-2 font-medium">{ts(lang, "vs Baseline", "so với Baseline")}</th>
                  <th className="px-4 py-2 font-medium">WoW</th>
                  <th className="px-4 py-2 font-medium">{ts(lang, "Top SKU", "SKU bán chạy")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border/60">
                {trend.map((t) => (
                  <tr key={t.weekCode}>
                    <td className="px-4 py-2 font-mono-tag font-medium">
                      <Link href={`/in-store/demo-report/${t.weekCode}`} className="hover:underline">{t.weekCode}</Link>
                    </td>
                    <td className="px-4 py-2 text-foreground-muted truncate max-w-[180px]">{t.promotionMechanics.join(", ") || ts(lang, "No Promotion", "Không có khuyến mãi")}</td>
                    <td className="px-4 py-2 font-mono-tag">{t.sales}</td>
                    <td className="px-4 py-2 font-mono-tag text-foreground-muted">{t.uplift != null ? `${fmt1(t.uplift)}x` : "—"}</td>
                    <td className="px-4 py-2 font-mono-tag" style={{ color: t.wowChangePct == null ? undefined : t.wowChangePct >= 0 ? "var(--green)" : "var(--amber)" }}>
                      {t.wowChangePct == null ? "—" : `${t.wowChangePct >= 0 ? "+" : ""}${fmt1(t.wowChangePct)}%`}
                    </td>
                    <td className="px-4 py-2 text-foreground-muted truncate max-w-[200px]">{t.topSku ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-glass-border text-[11.5px] font-semibold uppercase tracking-wide text-foreground-muted">{ts(lang, "Best-Selling SKUs", "SKU bán chạy nhất")}</div>
          <div className="divide-y divide-glass-border/60">
            {best.map((p) => (
              <div key={p.skuName} className="px-4 py-2 flex items-center justify-between gap-2">
                <span className="text-[12px] truncate">{p.skuName}</span>
                <span className="font-mono-tag text-[11.5px] text-foreground-muted shrink-0">{p.totalSales}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-glass-border text-[11.5px] font-semibold uppercase tracking-wide text-foreground-muted">{ts(lang, "Low-Selling SKUs", "SKU bán chậm nhất")}</div>
          <div className="divide-y divide-glass-border/60">
            {low.map((p) => (
              <div key={p.skuName} className="px-4 py-2 flex items-center justify-between gap-2">
                <span className="text-[12px] truncate">{p.skuName}</span>
                <span className="font-mono-tag text-[11.5px] text-foreground-muted shrink-0">{p.totalSales}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Link href="/in-store" className="font-mono-tag text-[11.5px] text-foreground-muted hover:underline mt-2 inline-block">
        {ts(lang, "View Weekly Reports", "Xem báo cáo hàng tuần")} →
      </Link>
    </section>
  );
}

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = getBrand(id);
  if (!brand) notFound();

  const campaigns = getBrandCampaigns(id);
  const demoSessions = getBrandDemoSessions(id);
  const apPackages = getBrandApPackages(id);
  const promotionCount = getBrandPromotionCount(id);
  const designActivityCount = getBrandDesignActivities(id).length;

  const demoByWeek = new Map<string, typeof demoSessions>();
  for (const d of demoSessions) {
    const key = d.week_code ?? "Unscheduled";
    (demoByWeek.get(key) ?? demoByWeek.set(key, []).get(key)!).push(d);
  }
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">{brand.name}</h1>
        <div className="flex gap-4 font-mono-tag text-[12px] text-foreground-muted mt-2">
          <span>
            {td(lang, "Campaigns")} <b className="text-foreground">{campaigns.length}</b>
          </span>
          <span>
            {td(lang, "Promotions")} <b className="text-foreground">{promotionCount}</b>
          </span>
          <span>
            {ts(lang, "Demo Sessions", "Buổi Demo")} <b className="text-foreground">{demoSessions.length}</b>
          </span>
          <span>
            {ts(lang, "A&P Packages", "Gói A&P")} <b className="text-foreground">{apPackages.length}</b>
          </span>
        </div>
      </div>

      {campaigns.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">{td(lang, "Campaigns")}</h2>
          <div className="glass rounded-2xl overflow-hidden">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${encodeURIComponent(c.id)}`}
                className="flex items-center justify-between px-4 py-3 border-b border-glass-border/60 last:border-b-0 hover:bg-glass-surface transition-colors"
              >
                <span className="text-[13px]">{c.name}</span>
                <span className="font-mono-tag text-[11px] text-foreground-muted">{c.campaign_type}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {promotionCount > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">{td(lang, "Promotions")}</h2>
          <Link
            href={`/promotions?brandId=${encodeURIComponent(id)}&quick=ALL`}
            className="glass rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-glass-surface-strong transition-colors"
          >
            <span className="text-[13px]">{promotionCount} {ts(lang, "promotions linked to this brand", "khuyến mãi liên kết với thương hiệu này")}</span>
            <span className="font-mono-tag text-[11px] text-foreground-muted">{td(lang, "View All")} →</span>
          </Link>
        </section>
      )}

      {demoSessions.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">{ts(lang, "Demo", "Demo")}</h2>
          <div className="glass rounded-2xl overflow-hidden divide-y divide-glass-border/60">
            {[...demoByWeek.entries()].map(([week, sessions]) => (
              <div key={week} className="px-4 py-3">
                <div className="font-mono-tag text-[11px] text-foreground-muted mb-1.5">{week}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                  {sessions.map((s, i) => (
                    <span key={i} className="text-foreground-muted">
                      {s.location} {s.session_label && `· ${s.session_label}`}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link href="/in-store" className="font-mono-tag text-[11.5px] text-foreground-muted hover:underline mt-2 inline-block">
            {ts(lang, "View Demo Events", "Xem sự kiện Demo")} →
          </Link>
        </section>
      )}

      <BrandDemoPerformanceSection brandId={id} lang={lang} />

      <BrandDesignActivitiesSection brandId={id} lang={lang} />

      {apPackages.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">A&amp;P</h2>
          <div className="glass rounded-2xl overflow-hidden">
            {apPackages.map((p) => (
              <Link
                key={p.id}
                href={`/ap/${encodeURIComponent(p.id)}`}
                className="flex items-center justify-between px-4 py-3 border-b border-glass-border/60 last:border-b-0 hover:bg-glass-surface transition-colors"
              >
                <span className="text-[13px]">{p.name}</span>
                <span className="font-mono-tag text-[11px] text-foreground-muted">
                  {p.reported_count}/{p.line_count} {ts(lang, "reported", "đã báo cáo")} · {p.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {campaigns.length === 0 && promotionCount === 0 && demoSessions.length === 0 && apPackages.length === 0 && designActivityCount === 0 && (
        <div className="glass rounded-2xl px-4 py-6 text-center text-[12.5px] text-foreground-muted">{ts(lang, "No connected records for this brand yet.", "Thương hiệu này chưa có bản ghi liên kết nào.")}</div>
      )}
    </div>
  );
}
