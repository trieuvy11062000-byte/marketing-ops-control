import Link from "next/link";
import { notFound } from "next/navigation";
import { getWeeklyDemoReportDetail } from "@/lib/queries/demoReports";
import { WeeklyNotesWidget } from "@/components/demo/WeeklyNotesWidget";
import type { DemoActionCategory } from "@/lib/db/types";

const ACTION_COLOR: Record<DemoActionCategory, { bg: string; fg: string }> = {
  START: { bg: "var(--green-bg)", fg: "var(--green)" },
  STOP: { bg: "var(--red-bg)", fg: "var(--red)" },
  CONTINUE: { bg: "var(--blue-grey-bg)", fg: "var(--blue-grey)" },
};

const SOURCE_LABEL: Record<string, string> = {
  DEMO_RECORD_EXCEL: "Demo Record",
  POST_EVENT_EVALUATION_DOCX: "Post-Event Evaluation",
  POST_EVENT_EVALUATION_PDF: "Post-Event Evaluation (Deck)",
  SUMMARY: "Weekly Summary",
  SUPPORTING: "Supporting File",
};

function fmt1(n: number | null): string {
  return n == null ? "—" : n.toFixed(1);
}

function OverviewStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-xl px-3 py-2.5 flex flex-col items-start min-w-[110px]">
      <span className="font-mono-tag text-[18px] font-bold">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-foreground-muted">{label}</span>
      {sub && <span className="text-[9.5px] text-foreground-muted mt-0.5">{sub}</span>}
    </div>
  );
}

export default async function WeeklyDemoReportPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const weekCode = decodeURIComponent(week).toUpperCase();
  const detail = getWeeklyDemoReportDetail(weekCode);
  if (!detail) notFound();

  const startActions = detail.actions.filter((a) => a.category === "START");
  const stopActions = detail.actions.filter((a) => a.category === "STOP");
  const continueActions = detail.actions.filter((a) => a.category === "CONTINUE");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-5">
      <div>
        <Link href="/in-store" className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground">← In-store</Link>
        <h1 className="text-[22px] font-semibold mt-2">{weekCode} Weekly Demo Report</h1>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
          Marketing activation performance — not a sales management dashboard
        </div>
      </div>

      {/* Overview */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <h2 className="text-[13.5px] font-semibold">Overview</h2>
        </div>
        <div className="p-3 flex flex-wrap gap-2.5">
          <OverviewStat label="Sessions" value={String(detail.overview.sessionsCount)} />
          <OverviewStat label="Stores" value={String(detail.overview.storesCount)} />
          <OverviewStat label="Brands" value={String(detail.overview.brandsCount)} />
          <OverviewStat label="Demo-day Sales" value={String(detail.overview.unitsSold)} sub="units sold on the demo date" />
          {detail.overview.salesDemoWeekTotal != null && (
            <OverviewStat label="Demo-week Sales" value={String(detail.overview.salesDemoWeekTotal)} sub="full week, not demo-day" />
          )}
          <OverviewStat label="Historical Baseline" value={fmt1(detail.overview.metrics.typicalDailyBaseline)} sub="typical units/day (6mo avg ÷ 7)" />
          <OverviewStat label="Sales Uplift" value={detail.overview.metrics.uplift != null ? `${fmt1(detail.overview.metrics.uplift)}x` : "—"} sub="demo-day ÷ typical-day baseline" />
          <OverviewStat label="FOC Distributed" value={String(detail.overview.focDistributed)} />
          {detail.overview.metrics.unitsPerFoc != null && <OverviewStat label="Units / FOC" value={fmt1(detail.overview.metrics.unitsPerFoc)} sub="sampling efficiency" />}
        </div>
        {(detail.reportedUnitsSold != null || detail.reportedUplift != null) && (
          <div className="px-4 py-2 border-t border-glass-border font-mono-tag text-[10.5px] text-foreground-muted">
            Report-stated: {detail.reportedUnitsSold ?? "—"} units · {detail.reportedUplift ?? "—"}x uplift · {detail.reportedFoc ?? "—"} FOC
          </div>
        )}
      </section>

      {detail.executiveSummary && (
        <section className="glass rounded-2xl px-4 py-4">
          <h2 className="text-[13.5px] font-semibold mb-2">Executive Summary</h2>
          <ul className="flex flex-col gap-1.5">
            {detail.executiveSummary.split("\n").filter(Boolean).map((line, i) => {
              const m = line.match(/^(\w+):\s*(.+)$/);
              return (
                <li key={i} className="text-[12.5px] text-foreground-muted leading-relaxed">
                  {m ? <><span className="text-foreground font-medium">{m[1]}:</span> {m[2]}</> : line}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Store Performance */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <h2 className="text-[13.5px] font-semibold">Store Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                <th className="px-4 py-2 font-medium">Store</th>
                <th className="px-4 py-2 font-medium">Sessions</th>
                <th className="px-4 py-2 font-medium">Sales</th>
                <th className="px-4 py-2 font-medium">FOC</th>
                <th className="px-4 py-2 font-medium">Units/FOC</th>
                <th className="px-4 py-2 font-medium">Uplift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border/60">
              {detail.storePerformance.map((s) => (
                <tr key={s.location}>
                  <td className="px-4 py-2 font-medium">{s.location}</td>
                  <td className="px-4 py-2 font-mono-tag text-foreground-muted">{s.sessionsCount}</td>
                  <td className="px-4 py-2 font-mono-tag">{s.sales}</td>
                  <td className="px-4 py-2 font-mono-tag text-foreground-muted">{s.foc}</td>
                  <td className="px-4 py-2 font-mono-tag text-foreground-muted">{fmt1(s.metrics.unitsPerFoc)}</td>
                  <td className="px-4 py-2 font-mono-tag">{s.metrics.uplift != null ? `${fmt1(s.metrics.uplift)}x` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Session / Brand / Product Performance */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <h2 className="text-[13.5px] font-semibold">Brand / Session Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                <th className="px-4 py-2 font-medium">Store</th>
                <th className="px-4 py-2 font-medium">Brand</th>
                <th className="px-4 py-2 font-medium">Session</th>
                <th className="px-4 py-2 font-medium">Sales</th>
                <th className="px-4 py-2 font-medium">Uplift</th>
                <th className="px-4 py-2 font-medium">Est. CVS</th>
                <th className="px-4 py-2 font-medium">Real CVS</th>
                <th className="px-4 py-2 font-medium">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border/60">
              {detail.sessionPerformance.map((s, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">{s.location}</td>
                  <td className="px-4 py-2 font-medium">{s.brandName ?? "—"}</td>
                  <td className="px-4 py-2 font-mono-tag text-foreground-muted">{s.sessionLabel ?? "—"}</td>
                  <td className="px-4 py-2 font-mono-tag">{s.sales}</td>
                  <td className="px-4 py-2 font-mono-tag text-foreground-muted">{s.metrics.uplift != null ? `${fmt1(s.metrics.uplift)}x` : "—"}</td>
                  <td className="px-4 py-2 font-mono-tag text-foreground-muted">{s.metrics.estCvsRate != null ? `${(s.metrics.estCvsRate * 100).toFixed(1)}%` : "—"}</td>
                  <td className="px-4 py-2 font-mono-tag text-foreground-muted">{s.metrics.realCvsRate != null ? `${(s.metrics.realCvsRate * 100).toFixed(1)}%` : "—"}</td>
                  <td className="px-4 py-2 font-mono-tag" style={{ color: s.metrics.cvsVariancePp != null ? (s.metrics.cvsVariancePp >= 0 ? "var(--green)" : "var(--amber)") : undefined }}>
                    {s.metrics.cvsVariancePp != null ? `${s.metrics.cvsVariancePp >= 0 ? "+" : ""}${fmt1(s.metrics.cvsVariancePp)}pp` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Product Performance */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <h2 className="text-[13.5px] font-semibold">Product Performance</h2>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border sticky top-0 bg-surface">
                <th className="px-4 py-2 font-medium">Brand</th>
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Store</th>
                <th className="px-4 py-2 font-medium">Promotion</th>
                <th className="px-4 py-2 font-medium">Sales</th>
                <th className="px-4 py-2 font-medium">FOC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border/60">
              {detail.productPerformance.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-foreground-muted">{p.brandName ?? "—"}</td>
                  <td className="px-4 py-2">{p.skuName ?? "—"}</td>
                  <td className="px-4 py-2 text-foreground-muted">{p.location}</td>
                  <td className="px-4 py-2 text-foreground-muted">{p.promotionMechanic ?? "—"}</td>
                  <td className="px-4 py-2 font-mono-tag">{p.sales}</td>
                  <td className="px-4 py-2 font-mono-tag text-foreground-muted">{p.foc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Shopper / Product Feedback */}
      {detail.feedback.length > 0 && (
        <section className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-glass-border">
            <h2 className="text-[13.5px] font-semibold">Shopper / Product Feedback</h2>
          </div>
          <div className="divide-y divide-glass-border/60">
            {detail.feedback.map((f, i) => (
              <div key={i} className="px-4 py-2.5">
                <div className="font-mono-tag text-[10.5px] text-foreground-muted">{f.location} · {f.sessionLabel} · {f.brandName}</div>
                {f.customerReaction && <div className="text-[12.5px] mt-0.5">&ldquo;{f.customerReaction}&rdquo;</div>}
                {f.staffFeedback && <div className="text-[12.5px] text-foreground-muted mt-0.5">{f.staffFeedback}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* START / STOP / CONTINUE */}
      {detail.actions.length > 0 && (
        <section className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-glass-border">
            <h2 className="text-[13.5px] font-semibold">START / STOP / CONTINUE</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-glass-border/60">
            {([["START", startActions], ["STOP", stopActions], ["CONTINUE", continueActions]] as const).map(([cat, items]) => (
              <div key={cat} className="p-3 flex flex-col gap-2">
                <span className="font-mono-tag text-[10.5px] uppercase tracking-wide rounded-md px-1.5 py-0.5 self-start" style={{ background: ACTION_COLOR[cat].bg, color: ACTION_COLOR[cat].fg }}>
                  {cat}
                </span>
                {items.map((a) => (
                  <div key={a.id} className="rounded-lg bg-glass-surface px-3 py-2">
                    <div className="text-[12px] leading-snug">
                      <span className="font-semibold">{a.title}</span>
                      {a.description && <span className="text-foreground-muted"> — {a.description}.</span>}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="text-[11.5px] text-foreground-muted">None recorded</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Weekly Notes (user-generated) */}
      <WeeklyNotesWidget weekCode={weekCode} initialNotes={detail.notes} />

      {/* Sources */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <h2 className="text-[13.5px] font-semibold">Sources</h2>
        </div>
        <div className="divide-y divide-glass-border/60">
          {detail.sources.map((s) => (
            <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[12px] truncate">{s.file_name}</span>
              <span className="font-mono-tag text-[10.5px] text-foreground-muted whitespace-nowrap">{SOURCE_LABEL[s.source_type] ?? s.source_type}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
