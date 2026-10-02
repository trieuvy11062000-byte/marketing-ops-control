import Link from "next/link";
import { notFound } from "next/navigation";
import { getPromotion, getRelatedPromotions } from "@/lib/queries/promotions";
import { PromotionStatusBadge } from "@/components/ui/badges";

const CHANNEL_LABEL: Record<string, string> = {
  "IN-STORE": "In-store",
  "ONLINE-RETAIL": "Online — Retail",
  "ONLINE-WHOLESALE": "Online — Wholesale",
  "LAST MILE": "Last Mile",
  OTHER: "Other",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="text-[13.5px] mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

export default async function PromotionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const promotion = getPromotion(decodeURIComponent(id));
  if (!promotion) notFound();

  const related = getRelatedPromotions(promotion.sku_code, promotion.id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 flex flex-col gap-6">
      <div>
        <div className="font-mono-tag text-[11.5px] text-foreground-muted">{CHANNEL_LABEL[promotion.channel] ?? promotion.channel}</div>
        <h1 className="text-[22px] font-bold tracking-tight">{promotion.sku_name ?? promotion.sku_code}</h1>
        <div className="flex items-center gap-2 mt-2">
          <PromotionStatusBadge status={promotion.status} />
          {promotion.brand_name && <span className="text-[12.5px] text-foreground-muted">{promotion.brand_name}</span>}
        </div>
      </div>

      <section className="glass rounded-2xl px-5 py-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
        <Field label="Brand" value={promotion.brand_name} />
        <Field label="SKU" value={promotion.sku_code} />
        <Field label="Channel" value={CHANNEL_LABEL[promotion.channel] ?? promotion.channel} />
        <Field label="Customer Type" value={promotion.customer_type} />
        <Field label="Mechanic" value={promotion.mechanic ?? promotion.discount_label} />
        <Field label="Normal Price" value={promotion.normal_price != null ? `£${promotion.normal_price.toFixed(2)}` : null} />
        <Field label="Promotion Price" value={promotion.promotion_price != null ? `£${promotion.promotion_price.toFixed(2)}` : null} />
        <Field label="Start" value={promotion.start_date} />
        <Field label="End" value={promotion.end_date} />
        <Field label="Stores / Platform" value={promotion.stores_platform} />
        <Field label="Stock" value={promotion.stock_status} />
        <Field label="Setup" value={promotion.setup_status} />
        <Field label="Audit" value={promotion.audit_status} />
      </section>

      {promotion.campaign_id && (
        <section className="glass rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted">Related Campaign</div>
            <div className="text-[13.5px] mt-0.5">{promotion.campaign_name}</div>
          </div>
          <Link
            href={`/campaigns/${encodeURIComponent(promotion.campaign_id)}`}
            className="font-mono-tag text-[11.5px] rounded-lg px-3 py-1.5 glass hover:bg-glass-surface-strong transition-colors"
          >
            View Campaign →
          </Link>
        </section>
      )}

      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <h2 className="text-[14px] font-semibold">Related Promotions — same SKU</h2>
          <div className="text-[11.5px] text-foreground-muted mt-0.5">
            Channel differences are tracked as separate records, never merged
          </div>
        </div>
        {related.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">No other channel records for this SKU</div>
        ) : (
          <div className="divide-y divide-glass-border/60">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/promotions/${encodeURIComponent(r.id)}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-glass-surface transition-colors"
              >
                <div>
                  <div className="font-mono-tag text-[10.5px] uppercase text-foreground-muted">{CHANNEL_LABEL[r.channel] ?? r.channel}</div>
                  <div className="text-[13px] mt-0.5">{r.mechanic ?? r.discount_label ?? "—"}</div>
                </div>
                <PromotionStatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
