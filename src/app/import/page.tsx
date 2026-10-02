import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { DesignBriefUpload } from "@/components/import/DesignBriefUpload";
import { DemoReportUpload } from "@/components/import/DemoReportUpload";
import { getCoverageTotals, getDataCoverage } from "@/lib/queries/coverage";
import { getLang, ts } from "@/lib/i18n";

const DOMAINS = [
  { label: "Activations", href: "/campaigns", table: "campaigns" },
  { label: "Promotions", href: "/promotions", table: "promotions" },
  { label: "Digital", href: "/digital", table: "digital_activities" },
  { label: "Demo", href: "/in-store", table: "deliverables" },
  { label: "A&P", href: "/ap", table: "ap_packages" },
  { label: "Design Assets", href: "/design", table: "design_assets" },
  { label: "Supply Signals", href: "/import?tab=DATA_HEALTH", table: "supply_signals" },
];

const STATUS_COLOR: Record<string, string> = {
  MAPPED: "var(--green)",
  PARTIAL: "var(--amber)",
  "NOT USED": "var(--grey)",
};

function TabLink({ tab, active, label }: { tab: string; active: boolean; label: string }) {
  return (
    <Link
      href={`/import?tab=${tab}`}
      className={`font-mono-tag text-[11px] uppercase tracking-wide rounded-full px-3 py-1.5 transition-colors ${
        active ? "bg-glass-surface-strong border border-glass-border text-foreground" : "text-foreground-muted hover:bg-glass-surface"
      }`}
    >
      {label}
    </Link>
  );
}

function UploadTab() {
  const db = getDb();
  const batches = db.prepare("SELECT * FROM import_batches ORDER BY imported_at DESC").all() as {
    id: string;
    file_name: string;
    imported_at: string;
    deliverables_created: number;
  }[];

  return (
    <div className="flex flex-col gap-5">
      <div className="glass rounded-2xl px-4 py-6 text-[13px] text-foreground-muted">
        Core marketing data (Promotion Master File, Monthly Demo Plan, A&amp;P26 / Marketing Calendar) is loaded
        directly by the operations team and re-run via the import script for now. Design Brief workbooks can be
        uploaded directly below — future files need no re-explanation, the engine reads the structure itself.
      </div>

      <DesignBriefUpload />

      <DemoReportUpload />

      {batches.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          {batches.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-4 py-2.5 border-b border-glass-border/60 last:border-b-0 text-[12.5px]">
              <span>{b.file_name}</span>
              <span className="font-mono-tag text-foreground-muted">{b.deliverables_created} rows</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataHealthTab() {
  const db = getDb();
  const counts: Record<string, number> = {};
  for (const d of DOMAINS) {
    counts[d.table] = (db.prepare(`SELECT COUNT(*) c FROM ${d.table}`).get() as { c: number }).c;
  }
  const totals = getCoverageTotals();
  const coverage = getDataCoverage();

  return (
    <div className="flex flex-col gap-5">
      <div className="font-mono-tag text-[12px] text-foreground-muted">
        Diagnostic only — not primary navigation. For working knowledge (rates, rules, playbooks) see{" "}
        <Link href="/master" className="underline hover:text-foreground">Master</Link>.
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {DOMAINS.map((d) => (
          <Link key={d.label} href={d.href} className="glass rounded-2xl px-4 py-3.5 hover:bg-glass-surface-strong transition-colors">
            <div className="font-mono-tag text-[22px] font-bold">{counts[d.table]}</div>
            <div className="text-[10.5px] uppercase tracking-wide text-foreground-muted">{d.label}</div>
          </Link>
        ))}
      </div>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold">Data Coverage</h2>
            <div className="text-[11.5px] text-foreground-muted mt-0.5">
              Every sheet across all source files — re-scanned 2026-09-30.
            </div>
          </div>
          <div className="font-mono-tag text-[11px] text-foreground-muted whitespace-nowrap">
            {totals.mapped} mapped · {totals.partial} partial · {totals.notUsed} not used
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Function</th>
                <th className="px-4 py-2 font-medium">Destination</th>
                <th className="px-4 py-2 font-medium">Records</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border/60">
              {coverage.map((row, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 align-top">
                    <div className="font-medium">{row.sourceSheet}</div>
                    <div className="font-mono-tag text-[10px] text-foreground-muted mt-0.5">{row.sourceFile}</div>
                  </td>
                  <td className="px-4 py-2.5 align-top text-foreground-muted max-w-[220px]">
                    {row.businessFunction}
                    {row.reason && <div className="text-[10.5px] mt-1 italic">{row.reason}</div>}
                  </td>
                  <td className="px-4 py-2.5 align-top text-foreground-muted">{row.destination}</td>
                  <td className="px-4 py-2.5 align-top font-mono-tag">{row.records || "—"}</td>
                  <td className="px-4 py-2.5 align-top">
                    <span
                      className="font-mono-tag text-[10px] uppercase rounded px-1.5 py-0.5"
                      style={{ background: "var(--glass-surface)", color: STATUS_COLOR[row.status] }}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = tab === "DATA_HEALTH" ? "DATA_HEALTH" : "UPLOAD";
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[22px] font-semibold">{ts(lang, "Import", "Nhập liệu")}</h1>
        <div className="flex items-center gap-1.5">
          <TabLink tab="UPLOAD" active={active === "UPLOAD"} label={ts(lang, "Upload", "Tải lên")} />
          <TabLink tab="DATA_HEALTH" active={active === "DATA_HEALTH"} label={ts(lang, "Data Health", "Tình trạng dữ liệu")} />
        </div>
      </div>

      {active === "UPLOAD" ? <UploadTab /> : <DataHealthTab />}
    </div>
  );
}
