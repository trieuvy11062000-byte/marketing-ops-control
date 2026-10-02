import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCampaign,
  getCampaignApPackages,
  getCampaignDeliverables,
  getCampaignDigitalSummary,
  getCampaignPromotionSummary,
} from "@/lib/queries/campaigns";
import { CampaignStatusBadge, StatusBadge } from "@/components/ui/badges";
import type { CampaignStatus } from "@/lib/db/status";

const STAGES = ["PLAN", "PREPARE", "REVIEW", "APPROVE", "EXECUTE", "VERIFY", "EVIDENCE", "REPORT", "CLOSE"];

const STAGE_BY_STATUS: Record<CampaignStatus, number> = {
  UPCOMING: 0,
  PREPARING: 1,
  LIVE: 4,
  "ENDING SOON": 5,
  COMPLETED: 8,
  CANCELLED: 8,
};

const CHANNEL_LABEL: Record<string, string> = {
  "IN-STORE": "In-store",
  "ONLINE-RETAIL": "Online Retail",
  "ONLINE-WHOLESALE": "Online Wholesale",
  "LAST MILE": "Last Mile",
  OTHER: "Other",
};

function ModuleCard({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  const body = (
    <div className="glass rounded-2xl px-4 py-4 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {href && <span className="font-mono-tag text-[10.5px] text-foreground-muted">→</span>}
      </div>
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="hover:bg-glass-surface-strong transition-colors rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaignId = decodeURIComponent(id);
  const campaign = getCampaign(campaignId);
  if (!campaign) notFound();

  const promotionSummary = getCampaignPromotionSummary(campaignId);
  const digitalSummary = getCampaignDigitalSummary(campaignId);
  const deliverables = getCampaignDeliverables(campaignId);
  const apPackages = getCampaignApPackages(campaign.brand_id);
  const currentStage = STAGE_BY_STATUS[campaign.status];
  const sources: { file: string; sheet: string }[] = campaign.source_files ? JSON.parse(campaign.source_files) : [];

  const deliverablesBySubtype = new Map<string, { count: number; done: number }>();
  for (const d of deliverables) {
    const entry = deliverablesBySubtype.get(d.subtype) ?? { count: 0, done: 0 };
    entry.count++;
    if (["DELIVERED", "CLOSED", "APPROVED"].includes(d.status)) entry.done++;
    deliverablesBySubtype.set(d.subtype, entry);
  }
  const totalPromotions = promotionSummary.reduce((n, p) => n + p.count, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-6">
      <div>
        <div className="font-mono-tag text-[11.5px] text-foreground-muted">{campaign.campaign_type ?? "Campaign"}</div>
        <h1 className="text-[24px] font-bold tracking-tight">
          {campaign.brand_name ? `${campaign.brand_name} — ` : ""}
          {campaign.name}
        </h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <CampaignStatusBadge status={campaign.status} />
          <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5 bg-glass-surface text-foreground-muted">
            {campaign.activation_type.replace(/_/g, " ")}
          </span>
          {campaign.driver && (
            <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5 bg-glass-surface text-foreground-muted">
              driver: {campaign.driver}
            </span>
          )}
          {campaign.start_date && (
            <span className="font-mono-tag text-[11.5px] text-foreground-muted">
              {campaign.start_date} → {campaign.end_date ?? "—"}
            </span>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl px-4 py-4 overflow-x-auto">
        <div className="flex items-center min-w-[640px]">
          {STAGES.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full border"
                  style={{
                    background: i < currentStage ? "var(--green)" : i === currentStage ? "var(--foreground)" : "transparent",
                    borderColor: i <= currentStage ? "var(--foreground)" : "var(--glass-border)",
                    boxShadow: i === currentStage ? "0 0 0 4px rgba(215,226,234,0.15)" : undefined,
                  }}
                />
                <span
                  className="font-mono-tag text-[9.5px] uppercase whitespace-nowrap"
                  style={{ color: i <= currentStage ? "var(--foreground)" : "var(--foreground-muted)" }}
                >
                  {s}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex-1 h-px mx-1" style={{ background: i < currentStage ? "var(--green)" : "var(--glass-border)" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Connected operational modules — each links to its OWN detail module. Campaign never replaces them. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <ModuleCard title="Promotion" href={totalPromotions > 0 ? `/promotions?campaignId=${encodeURIComponent(campaignId)}` : undefined}>
          {totalPromotions === 0 ? (
            <div className="text-[12px] text-foreground-muted">No linked promotions</div>
          ) : (
            <div className="flex flex-col gap-1">
              {promotionSummary.map((p) => (
                <div key={p.channel} className="flex items-center justify-between text-[12px]">
                  <span className="text-foreground-muted">{CHANNEL_LABEL[p.channel] ?? p.channel}</span>
                  <span className="font-mono-tag">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </ModuleCard>

        {[...deliverablesBySubtype.entries()].map(([subtype, s]) => (
          <ModuleCard key={subtype} title={subtype} href="/in-store">
            <div className="font-mono-tag text-[20px] font-bold">
              {s.done}/{s.count}
            </div>
            <div className="text-[11px] text-foreground-muted">executed</div>
          </ModuleCard>
        ))}

        {digitalSummary.length > 0 && (
          <ModuleCard title="Digital" href={`/digital?campaignId=${encodeURIComponent(campaignId)}`}>
            <div className="flex flex-col gap-1">
              {digitalSummary.map((d) => (
                <div key={d.subtype} className="flex items-center justify-between text-[12px]">
                  <span className="text-foreground-muted">{d.subtype}</span>
                  <span className="font-mono-tag">{d.count}</span>
                </div>
              ))}
            </div>
          </ModuleCard>
        )}

        <ModuleCard title="A&P">
          {apPackages.length === 0 ? (
            <div className="text-[12px] text-foreground-muted">No linked A&P package</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {apPackages.map((p) => (
                <Link key={p.id} href={`/ap/${encodeURIComponent(p.id)}`} className="flex items-center justify-between text-[12px] hover:underline">
                  <span className="truncate">{p.name}</span>
                  <span className="font-mono-tag text-foreground-muted">{p.status}</span>
                </Link>
              ))}
            </div>
          )}
        </ModuleCard>
      </div>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Deliverables</h2>
          <span className="font-mono-tag text-[11px] text-foreground-muted">{deliverables.length}</span>
        </div>
        {deliverables.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">No connected deliverables</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left font-mono-tag text-[10.5px] uppercase text-foreground-muted border-b border-glass-border">
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Subtype</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">PIC</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border/60">
                {deliverables.slice(0, 100).map((d, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 truncate max-w-[220px]">{d.sku_name ?? d.sku_code ?? "—"}</td>
                    <td className="px-4 py-2 text-foreground-muted">{d.subtype}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={d.status as never} />
                    </td>
                    <td className="px-4 py-2 font-mono-tag text-foreground-muted">{d.pic_role ?? "—"}</td>
                    <td className="px-4 py-2 font-mono-tag text-foreground-muted">{d.execution_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deliverables.length > 100 && <div className="px-4 py-2 text-[11.5px] text-foreground-muted">+{deliverables.length - 100} more</div>}
          </div>
        )}
      </section>

      <section className="glass rounded-2xl px-4 py-3">
        <h2 className="text-[13px] font-semibold mb-2">Source Files</h2>
        <div className="flex flex-col gap-1">
          {sources.map((s, i) => (
            <div key={i} className="font-mono-tag text-[11px] text-foreground-muted">
              {s.file.split("\\").pop()} → {s.sheet}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
