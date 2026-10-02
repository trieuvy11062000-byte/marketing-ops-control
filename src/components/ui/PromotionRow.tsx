import Link from "next/link";
import { PromotionStatusBadge } from "./badges";
import type { PromotionWithStatus } from "@/lib/queries/promotions";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase();
}

const CHANNEL_LABEL: Record<string, string> = {
  "IN-STORE": "In-store",
  "ONLINE-RETAIL": "Online — Retail",
  "ONLINE-WHOLESALE": "Online — Wholesale",
  "LAST MILE": "Last Mile",
  OTHER: "Other",
};

export function PromotionRow({ promotion }: { promotion: PromotionWithStatus }) {
  return (
    <Link
      href={`/promotions/${encodeURIComponent(promotion.id)}`}
      className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-glass-surface transition-colors border-b border-glass-border/60 last:border-b-0"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px]">
          {promotion.brand_name && <span className="font-medium text-foreground">{promotion.brand_name}</span>}
          <span className="text-foreground-muted truncate">{promotion.sku_name ?? promotion.sku_code ?? "—"}</span>
        </div>
        <div className="text-[12px] text-foreground-muted mt-0.5 truncate">
          {promotion.campaign_name ?? "—"} · {promotion.mechanic ?? promotion.discount_label ?? "—"}
        </div>
      </div>

      <div className="font-mono-tag text-[10.5px] text-foreground-muted whitespace-nowrap hidden sm:block rounded-md px-1.5 py-0.5 bg-glass-surface">
        {CHANNEL_LABEL[promotion.channel] ?? promotion.channel}
      </div>

      <div className="font-mono-tag text-[11.5px] text-foreground-muted whitespace-nowrap hidden md:block">
        {formatDate(promotion.start_date)} → {formatDate(promotion.end_date)}
      </div>

      <div className="font-mono-tag text-[11px] text-foreground-muted whitespace-nowrap w-16 text-right">
        {promotion.days_remaining != null && promotion.days_remaining >= 0 ? `${promotion.days_remaining}d left` : "—"}
      </div>

      <PromotionStatusBadge status={promotion.status} />
    </Link>
  );
}
