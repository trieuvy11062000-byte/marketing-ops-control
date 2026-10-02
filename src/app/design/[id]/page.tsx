import Link from "next/link";
import { notFound } from "next/navigation";
import { getDesignAsset, getDesignAssetProducts } from "@/lib/queries/designBriefs";
import { DesignAssetAuditPanel } from "@/components/design/DesignAssetAuditPanel";
import type { AuditField } from "@/lib/queries/designBriefs";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="text-[13px] whitespace-pre-line mt-0.5">{value}</div>
    </div>
  );
}

export default async function DesignAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = getDesignAsset(decodeURIComponent(id));
  if (!asset) notFound();

  const products = getDesignAssetProducts(asset.id);
  const auditInitial: Record<AuditField, "TO CHECK" | "DONE" | "ISSUE"> = {
    brief_complete: asset.brief_complete,
    sku_complete: asset.sku_complete,
    promotion_verified: asset.promotion_verified,
    timeline_verified: asset.timeline_verified,
    content_verified: asset.content_verified,
    branding_verified: asset.branding_verified,
    design_output_received: asset.design_output_received,
    final_output_audited: asset.final_output_audited,
    ready_to_publish: asset.ready_to_publish,
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-5">
      <div>
        <Link href="/design" className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground">← Design Assets</Link>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <h1 className="text-[22px] font-semibold">
            {asset.asset_type}
            {asset.variant_label && <span className="text-foreground-muted"> — {asset.variant_label}</span>}
          </h1>
          {asset.confidence !== "HIGH" && (
            <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>
              {asset.confidence}
            </span>
          )}
          {asset.reusable_template === 1 && (
            <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--blue-grey-bg)", color: "var(--blue-grey)" }}>
              REUSABLE TEMPLATE
            </span>
          )}
        </div>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
          {asset.month_label ?? "—"}
          {asset.portfolio_name && ` · ${asset.portfolio_name}`}
          {asset.brand_name && ` · ${asset.brand_name}`}
          {asset.activity_label && ` · ${asset.activity_label}`} · {asset.channel}
          {asset.channel_subtype && ` / ${asset.channel_subtype}`}
        </div>
        <div className="font-mono-tag text-[11px] text-foreground-muted mt-0.5">
          {asset.brief_campaign_name ?? asset.campaign_name_linked ?? "No linked campaign"}
          {asset.category_name && ` · Category: ${asset.category_name}`}
        </div>
      </div>

      <section className="glass rounded-2xl px-4 py-4 flex flex-col gap-3">
        <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted border-b border-glass-border/60 pb-1.5">Identity</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Month" value={asset.month_label} />
          <Field label="Portfolio / Supplier" value={asset.portfolio_name} />
          <Field label="Brand" value={asset.brand_name} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Activity Type" value={asset.activity_type} />
          <Field label="Activity" value={asset.activity_label} />
          <Field label="Category" value={asset.category_name} />
        </div>

        <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted border-b border-glass-border/60 pb-1.5 pt-2">Creative</div>
        <Field label="Headline" value={asset.headline} />
        <Field label="Secondary Message" value={asset.secondary_message} />
        <Field label="CTA" value={asset.cta} />
        <Field label="Full Content (source, unmodified)" value={asset.content_raw} />
        <Field label="Branding / Logo Requirement" value={asset.branding_requirement} />
        <Field label="Theme Ref" value={asset.theme_ref} />
        <Field label="Design Note / Instruction" value={asset.design_note} />

        <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted border-b border-glass-border/60 pb-1.5 pt-2">Commercial Context</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Promotion Mechanic" value={asset.promotion_mechanic} />
          <Field label="Promotion Channel" value={asset.promotion_channel} />
          <Field label="Promotion Cross-link" value={asset.promotion_conflict === 1 ? "PROMOTION CONFLICT — source text differs from linked Promotion record" : asset.promotion_id ? "Linked — matches Promotion record" : null} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Valid From" value={asset.valid_from} />
          <Field label="Valid Until" value={asset.valid_until} />
          <Field label="Design Deadline" value={asset.design_deadline} />
        </div>
        <Field label="Fixture Parent" value={asset.fixture_parent} />

        <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted border-b border-glass-border/60 pb-1.5 pt-2">Control</div>
        <div className="font-mono-tag text-[10.5px] text-foreground-muted">
          Source: {asset.source_sheet} — {asset.source_row_ref} · File: {asset.source_file} · Format: {asset.format_raw ?? "—"}
        </div>
      </section>

      {products.length > 0 && (
        <section className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-glass-border flex items-center gap-2">
            <h2 className="text-[13.5px] font-semibold">Products / SKUs</h2>
            <span className="font-mono-tag text-[11px] text-foreground-muted">{products.length}</span>
          </div>
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Group</th>
                  <th className="px-3 py-2 font-medium">Promotion (per-SKU)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border/60">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-mono-tag">{p.product_code ?? "—"}</td>
                    <td className="px-3 py-2">{p.product_name ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground-muted">{p.product_group ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground-muted">{p.role_note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <DesignAssetAuditPanel assetId={asset.id} initial={auditInitial} evidenceLink={asset.evidence_link} />
    </div>
  );
}
