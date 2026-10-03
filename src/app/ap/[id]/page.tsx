import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getApCampaignReport,
  getApDeliveryLines,
  getApLinkedProducts,
  getApPackage,
  getApReportSummary,
  listDealTracker,
} from "@/lib/queries/ap";

const STATUS_COLOR: Record<string, string> = {
  DELIVERED: "var(--green)",
  "IN DELIVERY": "var(--blue-grey)",
  PENDING: "var(--amber)",
};

const EVIDENCE_COLOR: Record<string, string> = {
  COMPLETE: "var(--green)",
  PARTIAL: "var(--amber)",
  PENDING: "var(--grey)",
};

const DEAL_STATUS_COLOR: Record<string, string> = {
  AGREED: "var(--green)",
  DISCUSSED: "var(--blue-grey)",
  PENDING: "var(--amber)",
  WAITING: "var(--amber)",
};

type Tab = "PROPOSAL" | "DEAL_TRACKER" | "REPORT";

function TabLink({ id, tab, active, label }: { id: string; tab: Tab; active: boolean; label: string }) {
  return (
    <Link
      href={`/ap/${encodeURIComponent(id)}?tab=${tab}`}
      className={`font-mono-tag text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 transition-colors ${
        active ? "bg-glass-surface-strong border border-glass-border text-foreground" : "text-foreground-muted hover:bg-glass-surface"
      }`}
    >
      {label}
    </Link>
  );
}

function ProposalTab({ pkg }: { pkg: NonNullable<ReturnType<typeof getApPackage>> }) {
  const lines = getApDeliveryLines(pkg.id);
  const products = getApLinkedProducts(pkg.brand_id);

  return (
    <div className="flex flex-col gap-5">
      <section className="glass rounded-2xl px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Supplier</div>
          <div className="text-[14px] font-semibold mt-1">{pkg.brand_name ?? pkg.name}</div>
        </div>
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Agreement Period</div>
          <div className="text-[13px] mt-1">{pkg.period_start && pkg.period_end ? `${pkg.period_start} → ${pkg.period_end}` : "—"}</div>
        </div>
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Status</div>
          <div className="text-[13px] mt-1">{pkg.status}</div>
        </div>
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Total Marketing Value</div>
          <div className="font-mono-tag text-[16px] font-bold mt-1">{pkg.total_value != null ? `$${pkg.total_value.toLocaleString()}` : "—"}</div>
        </div>
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Supplier Investment</div>
          <div className="font-mono-tag text-[16px] font-bold mt-1">{pkg.brand_investment != null ? `$${pkg.brand_investment.toLocaleString()}` : "—"}</div>
        </div>
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">LGD Investment</div>
          <div className="font-mono-tag text-[16px] font-bold mt-1">{pkg.lgd_fund != null ? `$${pkg.lgd_fund.toLocaleString()}` : "—"}</div>
        </div>
      </section>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <h2 className="text-[14px] font-semibold">Activity</h2>
          <div className="text-[11.5px] text-foreground-muted mt-0.5">Agreed vs Delivered vs Evidence vs Reported — click a line for detail</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left font-mono-tag text-[10.5px] uppercase text-foreground-muted border-b border-glass-border">
                <th className="px-4 py-2 font-medium">Activity</th>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Fee</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border/60">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-glass-surface transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/ap/delivery/${encodeURIComponent(l.id)}`} className="hover:underline font-medium">
                      {l.deliverable_type}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-foreground-muted">{l.agreed_label ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono-tag">{l.agreed_quantity ?? l.delivered_quantity ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono-tag">{l.agreed_value != null ? `$${l.agreed_value}` : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--glass-surface)", color: STATUS_COLOR[l.status] }}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono-tag text-[10.5px] uppercase" style={{ color: EVIDENCE_COLOR[l.evidence_status] }}>{l.evidence_status}</span>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-foreground-muted">No activity lines yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {products.length > 0 && (
        <details className="glass rounded-2xl overflow-hidden">
          <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
            <span className="text-[12.5px] font-medium">Products / SKU ({products.length})</span>
            <span className="text-foreground-muted text-[11px]">▾</span>
          </summary>
          <table className="w-full text-[12px] border-t border-glass-border">
            <tbody className="divide-y divide-glass-border/60">
              {products.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-1.5 font-mono-tag text-foreground-muted w-[100px]">{p.product_code ?? "—"}</td>
                  <td className="px-2 py-1.5">{p.product_name}</td>
                  <td className="px-2 py-1.5 text-foreground-muted">{p.product_group ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function DealTrackerTab({ packageId }: { packageId: string }) {
  const deals = listDealTracker(packageId);
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-glass-border">
        <h2 className="text-[14px] font-semibold">Deal Tracker</h2>
        <div className="text-[11.5px] text-foreground-muted mt-0.5">What was agreed, what&apos;s pending, invoice/payment, POSM supply, product confirmation — separate from execution tasks</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left font-mono-tag text-[10.5px] uppercase text-foreground-muted border-b border-glass-border">
              <th className="px-4 py-2 font-medium">Deal Point</th>
              <th className="px-4 py-2 font-medium">Deal Type</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">PIC</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Discussion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border/60">
            {deals.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5 font-medium">{d.deal_point}</td>
                <td className="px-4 py-2.5 text-foreground-muted">{d.deal_type ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono-tag">{d.amount != null ? `${d.currency ?? ""} ${d.amount}` : "—"}</td>
                <td className="px-4 py-2.5 text-foreground-muted">{d.pic ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--glass-surface)", color: DEAL_STATUS_COLOR[d.status] }}>{d.status}</span>
                </td>
                <td className="px-4 py-2.5 text-foreground-muted">{d.discussion ?? "—"}</td>
              </tr>
            ))}
            {deals.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">No deal points tracked yet for this supplier — add them as commercial discussions happen.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportTab({ pkg }: { pkg: NonNullable<ReturnType<typeof getApPackage>> }) {
  const report = getApCampaignReport(pkg.id);
  const summary = getApReportSummary(pkg.brand_id);

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-2xl px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Report Deadline</div>
          <div className="text-[13px] mt-1">{report?.report_deadline ?? "—"}</div>
        </div>
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Applied Period</div>
          <div className="text-[13px] mt-1">{report?.applied_period_start && report?.applied_period_end ? `${report.applied_period_start} → ${report.applied_period_end}` : "—"}</div>
        </div>
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Status</div>
          <div className="text-[13px] mt-1">{report?.status ?? "COLLECTING"}</div>
        </div>
      </section>

      <div className="font-mono-tag text-[11px] text-foreground-muted px-1">
        Report pulls and summarises data already in Campaign / Demo / Digital / In-store / Promotion — it never duplicates it.
      </div>

      <details className="glass rounded-2xl overflow-hidden" open={summary.campaigns.length > 0}>
        <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
          <span className="text-[12.5px] font-medium">Campaigns ({summary.campaigns.length})</span>
          <span className="text-foreground-muted text-[11px]">▾</span>
        </summary>
        <div className="divide-y divide-glass-border/60 border-t border-glass-border">
          {summary.campaigns.map((c) => (
            <div key={c.id} className="px-4 py-2 flex items-center justify-between text-[12px]">
              <Link href={`/campaigns/${encodeURIComponent(c.id)}`} className="hover:underline">{c.name}</Link>
              <span className="font-mono-tag text-foreground-muted">{c.start_date ?? "—"} → {c.end_date ?? "—"}</span>
            </div>
          ))}
          {summary.campaigns.length === 0 && <div className="px-4 py-3 text-center text-[12px] text-foreground-muted">No linked campaigns for this brand yet</div>}
        </div>
      </details>

      <details className="glass rounded-2xl overflow-hidden" open={summary.designActivities.length > 0}>
        <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
          <span className="text-[12.5px] font-medium">Digital / POSM / Planogram — Design Activities ({summary.designActivities.length})</span>
          <span className="text-foreground-muted text-[11px]">▾</span>
        </summary>
        <div className="divide-y divide-glass-border/60 border-t border-glass-border">
          {summary.designActivities.map((a) => (
            <div key={a.id} className="px-4 py-2 flex items-center justify-between text-[12px]">
              <span>{a.activity_label}</span>
              <span className="font-mono-tag text-foreground-muted">{a.activity_type} · {a.month_label ?? "—"}</span>
            </div>
          ))}
          {summary.designActivities.length === 0 && <div className="px-4 py-3 text-center text-[12px] text-foreground-muted">No linked design activities yet</div>}
        </div>
      </details>

      <details className="glass rounded-2xl overflow-hidden" open={summary.demoSessions.length > 0}>
        <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
          <span className="text-[12.5px] font-medium">Demo ({summary.demoSessions.length})</span>
          <span className="text-foreground-muted text-[11px]">▾</span>
        </summary>
        <div className="divide-y divide-glass-border/60 border-t border-glass-border">
          {summary.demoSessions.map((d, i) => (
            <div key={i} className="px-4 py-2 flex items-center justify-between text-[12px]">
              <span>{d.location}{d.session_label && ` · ${d.session_label}`}</span>
              <Link href={`/in-store/demo-report/${encodeURIComponent(d.week_code)}`} className="font-mono-tag text-foreground-muted hover:underline">{d.week_code}</Link>
            </div>
          ))}
          {summary.demoSessions.length === 0 && <div className="px-4 py-3 text-center text-[12px] text-foreground-muted">No linked demo sessions yet</div>}
        </div>
      </details>

      <details className="glass rounded-2xl overflow-hidden" open={summary.promotions.length > 0}>
        <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
          <span className="text-[12.5px] font-medium">Promotion / FOC ({summary.promotions.length})</span>
          <span className="text-foreground-muted text-[11px]">▾</span>
        </summary>
        <div className="divide-y divide-glass-border/60 border-t border-glass-border">
          {summary.promotions.map((p) => (
            <div key={p.id} className="px-4 py-2 flex items-center justify-between text-[12px]">
              <span>{p.mechanic ?? "—"}</span>
              <span className="font-mono-tag text-foreground-muted">{p.channel} {p.sku_code ? `· ${p.sku_code}` : ""}</span>
            </div>
          ))}
          {summary.promotions.length === 0 && <div className="px-4 py-3 text-center text-[12px] text-foreground-muted">No linked promotions yet</div>}
        </div>
      </details>

      <details className="glass rounded-2xl overflow-hidden">
        <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
          <span className="text-[12.5px] font-medium">Sales / Exposure / Evidence / Comments</span>
          <span className="text-foreground-muted text-[11px]">▾</span>
        </summary>
        <div className="px-4 py-3 border-t border-glass-border text-[12px] text-foreground-muted">
          {report?.comments ?? "No sales/exposure data or comments recorded yet."}
        </div>
      </details>
    </div>
  );
}

export default async function ApPackageDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const pkg = getApPackage(decodeURIComponent(id));
  if (!pkg) notFound();

  const tab: Tab = tabParam === "DEAL_TRACKER" ? "DEAL_TRACKER" : tabParam === "REPORT" ? "REPORT" : "PROPOSAL";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono-tag text-[11.5px] text-foreground-muted">A&amp;P</div>
          <h1 className="text-[24px] font-bold tracking-tight">{pkg.name}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <TabLink id={pkg.id} tab="PROPOSAL" active={tab === "PROPOSAL"} label="Proposal" />
          <TabLink id={pkg.id} tab="DEAL_TRACKER" active={tab === "DEAL_TRACKER"} label="Deal Tracker" />
          <TabLink id={pkg.id} tab="REPORT" active={tab === "REPORT"} label="Report / Evidence" />
        </div>
      </div>

      {tab === "PROPOSAL" && <ProposalTab pkg={pkg} />}
      {tab === "DEAL_TRACKER" && <DealTrackerTab packageId={pkg.id} />}
      {tab === "REPORT" && <ReportTab pkg={pkg} />}
    </div>
  );
}
