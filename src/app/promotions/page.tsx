import { QuickFilterChips } from "@/components/ui/QuickFilterChips";
import { PromotionRow } from "@/components/ui/PromotionRow";
import { EmptyRow } from "@/components/ui/TaskRow";
import { getPromotionQuickCounts, getPromotionTopSummary, listPromotions, type PromotionQuickFilter } from "@/lib/queries/promotions";
import { getLang, ts } from "@/lib/i18n";
import { td } from "@/lib/i18nDict";
import type { Lang } from "@/lib/i18n";

const QUICK_FILTERS: PromotionQuickFilter[] = ["LIVE NOW", "UPCOMING", "ENDING SOON", "EXPIRED", "AT RISK", "ALL"];
const CHANNELS = ["IN-STORE", "ONLINE-RETAIL", "ONLINE-WHOLESALE", "LAST MILE", "OTHER"];

function TopSummaryStrip({ lang }: { lang: Lang }) {
  const s = getPromotionTopSummary();
  const chips: { label: string; value: number; accent?: "amber" }[] = [
    { label: td(lang, "Live"), value: s.live },
    { label: td(lang, "Ending Soon"), value: s.endingSoon, accent: s.endingSoon > 0 ? "amber" : undefined },
    { label: ts(lang, "Stock Issue", "Vấn đề tồn kho"), value: s.stockIssue, accent: s.stockIssue > 0 ? "amber" : undefined },
    { label: ts(lang, "Audit Issue", "Vấn đề kiểm tra"), value: s.auditIssue, accent: s.auditIssue > 0 ? "amber" : undefined },
  ];
  return (
    <div className="px-6 pt-1 pb-3 flex flex-wrap gap-2.5">
      {chips.map((c) => (
        <div key={c.label} className="glass rounded-xl px-3 py-2 flex flex-col items-start min-w-[92px]">
          <span className="font-mono-tag text-[18px] font-bold" style={{ color: c.accent === "amber" ? "var(--amber)" : undefined }}>
            {c.value}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string; channel?: string; sku?: string; campaignId?: string; brandId?: string }>;
}) {
  const params = await searchParams;
  const quick = (params.quick as PromotionQuickFilter) ?? (params.campaignId || params.brandId ? "ALL" : "LIVE NOW");
  const channel = params.channel;
  const lang = await getLang();

  const counts = getPromotionQuickCounts();
  const promotions = listPromotions({ quick, channel, sku: params.sku, campaignId: params.campaignId, brandId: params.brandId });

  const qs = (overrides: Record<string, string | undefined>) => {
    const merged = { quick, channel, sku: params.sku, campaignId: params.campaignId, brandId: params.brandId, ...overrides };
    const sp = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => v && sp.set(k, v));
    return `/promotions?${sp.toString()}`;
  };

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-8 pb-3">
        <h1 className="text-[22px] font-semibold">{td(lang, "Promotions")}</h1>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
          {ts(lang, "Commercial offers by SKU and channel — In-store, Online Retail and Online Wholesale are tracked separately", "Ưu đãi thương mại theo SKU và kênh — In-store, Online Retail và Online Wholesale được theo dõi riêng biệt")}
        </div>
      </div>

      <TopSummaryStrip lang={lang} />

      <QuickFilterChips options={QUICK_FILTERS} active={quick} hrefFor={(o) => qs({ quick: o })} counts={counts} />

      <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto">
        <span className="font-mono-tag text-[10.5px] uppercase text-foreground-muted shrink-0">{ts(lang, "Channel", "Kênh")}</span>
        <a
          href={qs({ channel: undefined })}
          className={`shrink-0 font-mono-tag text-[11px] rounded-md px-2 py-1 ${!channel ? "bg-glass-surface-strong" : "text-foreground-muted hover:bg-glass-surface"}`}
        >
          {td(lang, "All")}
        </a>
        {CHANNELS.map((c) => (
          <a
            key={c}
            href={qs({ channel: c })}
            className={`shrink-0 font-mono-tag text-[11px] rounded-md px-2 py-1 ${channel === c ? "bg-glass-surface-strong" : "text-foreground-muted hover:bg-glass-surface"}`}
          >
            {c}
          </a>
        ))}
      </div>

      <div className="px-6 pb-8">
        <div className="glass rounded-2xl overflow-hidden">
          {promotions.length === 0 ? (
            <EmptyRow label={ts(lang, "No promotions match this filter", "Không có khuyến mãi nào khớp bộ lọc này")} />
          ) : (
            promotions.slice(0, 200).map((p) => <PromotionRow key={p.id} promotion={p} />)
          )}
        </div>
        {promotions.length > 200 && (
          <div className="text-center text-[11.5px] text-foreground-muted mt-2">{ts(lang, "Showing first 200 of", "Hiển thị 200 trong tổng số")} {promotions.length}</div>
        )}
      </div>
    </div>
  );
}
