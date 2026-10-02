import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarSection } from "@/components/calendar/CalendarSection";
import { RiskDot } from "@/components/ui/badges";
import { getInStoreWeekSummary, getInStoreWeekDemo, IN_STORE_WEEKDAY_RULES } from "@/lib/queries/inStore";
import { getDemoCommitmentSummary, getDemoSessionsByWeek } from "@/lib/queries/demo";
import { getMonthCalendarData } from "@/lib/queries/calendar";
import { getWeek, getAdjacentWeek } from "@/lib/queries/weeks";
import { currentWeekCode } from "@/lib/db/weeks";
import { StatusBadge } from "@/components/ui/badges";
import { listWeeklyDemoReports } from "@/lib/queries/demoReports";
import type { ControlStatus, RiskLevel } from "@/lib/db/types";
import { getLang, ts } from "@/lib/i18n";
import { td } from "@/lib/i18nDict";
import type { Lang } from "@/lib/i18n";

function WeeklyDemoReportsSection({ lang }: { lang: Lang }) {
  const reports = listWeeklyDemoReports();
  if (reports.length === 0) return null;

  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-glass-border flex items-center gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-foreground-muted">{ts(lang, "Weekly Demo Reports", "Báo cáo Demo hàng tuần")}</span>
        <span className="font-mono-tag text-[10.5px] text-foreground-muted">{reports.length}</span>
      </div>
      <div className="flex flex-wrap gap-3 p-3">
        {reports.map((r) => (
          <Link
            key={r.weekCode}
            href={`/in-store/demo-report/${r.weekCode}`}
            className="flex-1 min-w-[260px] max-w-[340px] rounded-xl px-4 py-3 bg-glass-surface hover:bg-glass-surface-strong transition-colors flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-tag text-[13px] font-semibold">{r.weekCode}</span>
              <span className="text-[11px] text-foreground-muted">→</span>
            </div>
            <div className="font-mono-tag text-[10.5px] text-foreground-muted">
              {r.sessionsCount} Sessions · {r.brandsCount} Brands · {r.storesCount} Stores
            </div>
            <div className="font-mono-tag text-[12px]">
              <span className="font-semibold">{r.unitsSold}</span> Units
              {r.metrics.uplift != null && <> · <span className="font-semibold">{r.metrics.uplift.toFixed(1)}x</span> uplift</>}
              {" · "}<span className="font-semibold">{r.focDistributed}</span> FOC
            </div>
            {r.keyLearningSnippet && (
              <div className="text-[11px] text-foreground-muted line-clamp-2">
                {r.keyLearningSnippet}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

const VIEWS = ["WEEK", "MONTH", "LIST"] as const;

function ViewTabs({ active, week }: { active: string; week: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {VIEWS.map((v) => (
        <Link
          key={v}
          href={`/in-store?view=${v}&week=${week}`}
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

function SummaryChip({ label, value, accent }: { label: string; value: number | string; accent?: "red" | "amber" }) {
  return (
    <div className="glass rounded-xl px-3 py-2 flex flex-col items-start min-w-[92px]">
      <span className="font-mono-tag text-[18px] font-bold" style={{ color: accent === "red" ? "var(--red)" : accent === "amber" ? "var(--amber)" : undefined }}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-foreground-muted">{label}</span>
    </div>
  );
}

function WeekView({ weekCode, lang }: { weekCode: string; lang: Lang }) {
  const week = getWeek(weekCode);
  const summary = getInStoreWeekSummary(weekCode);
  const demoRows = getInStoreWeekDemo(weekCode);
  const prev = getAdjacentWeek(weekCode, -1);
  const next = getAdjacentWeek(weekCode, 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
        <Link href={`/in-store?view=WEEK&week=${prev?.week_code ?? weekCode}`} className="p-1.5 rounded-lg hover:bg-glass-surface-strong text-foreground-muted">
          <ChevronLeft size={16} />
        </Link>
        <span className="font-mono-tag text-[13px] font-semibold min-w-[140px] text-center">
          {weekCode} · {week?.start_date} – {week?.end_date}
        </span>
        <Link href={`/in-store?view=WEEK&week=${next?.week_code ?? weekCode}`} className="p-1.5 rounded-lg hover:bg-glass-surface-strong text-foreground-muted">
          <ChevronRight size={16} />
        </Link>
        <Link href={`/week/${weekCode}`} className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground hover:underline ml-2">
          {ts(lang, "Full Week Control", "Điều khiển cả tuần")} →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <SummaryChip label={ts(lang, "Demo Sessions", "Buổi Demo")} value={summary.demoSessions} />
        <SummaryChip label={ts(lang, "Demo At Risk", "Demo có rủi ro")} value={summary.demoAtRisk} accent={summary.demoAtRisk > 0 ? "red" : undefined} />
        <SummaryChip label={ts(lang, "POSM Due", "POSM đến hạn")} value={summary.posmDue} />
        <SummaryChip label={ts(lang, "TVC Changes", "TVC thay đổi")} value={summary.tvcChanges} />
        <SummaryChip label={ts(lang, "Evidence Missing", "Thiếu bằng chứng")} value={summary.evidenceMissing} accent={summary.evidenceMissing > 0 ? "amber" : undefined} />
        <SummaryChip label={ts(lang, "Need My Review", "Cần tôi xem lại")} value={summary.needMyReview} accent={summary.needMyReview > 0 ? "amber" : undefined} />
      </div>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-glass-border text-[11.5px] font-semibold uppercase tracking-wide text-foreground-muted">
          {ts(lang, "Weekly Operating Rhythm", "Nhịp vận hành hàng tuần")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-glass-border/60">
          {IN_STORE_WEEKDAY_RULES.map((d) => (
            <div key={d.day} className="px-3 py-2.5">
              <div className="font-mono-tag text-[10.5px] font-semibold mb-1">{d.day}</div>
              <ul className="flex flex-col gap-0.5">
                {d.items.map((item, i) => (
                  <li key={i} className="text-[10.5px] text-foreground-muted leading-tight">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <WeeklyDemoReportsSection lang={lang} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <section className="glass rounded-2xl overflow-hidden lg:col-span-1">
          <div className="px-4 py-3 border-b border-glass-border flex items-center gap-2">
            <h2 className="text-[13.5px] font-semibold">{ts(lang, "Demo / Tasting", "Demo / Dùng thử")}</h2>
            <span className="font-mono-tag text-[11px] text-foreground-muted">{demoRows.length}</span>
          </div>
          <div className="divide-y divide-glass-border/60 max-h-[420px] overflow-y-auto">
            {demoRows.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-foreground-muted">{ts(lang, "No demo sessions this week", "Tuần này không có buổi demo")}</div>
            ) : (
              demoRows.map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-start gap-2">
                  <RiskDot level={r.risk_level as RiskLevel} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate">
                      {r.brand_name} — {r.location}
                    </div>
                    <div className="font-mono-tag text-[10.5px] text-foreground-muted">
                      {r.session_label} · {r.sku_name}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="glass rounded-2xl overflow-hidden lg:col-span-1">
          <div className="px-4 py-3 border-b border-glass-border">
            <h2 className="text-[13.5px] font-semibold">POSM</h2>
          </div>
          <div className="px-4 py-6 text-center text-[12px] text-foreground-muted">
            {ts(lang, "NEEDS MAPPING — POSM26 sheet not present in the current source file (see Master → Data Coverage).", "CẦN ÁNH XẠ — chưa có sheet POSM26 trong file nguồn hiện tại (xem Master → Data Coverage).")}
          </div>
        </section>

        <section className="glass rounded-2xl overflow-hidden lg:col-span-1">
          <div className="px-4 py-3 border-b border-glass-border">
            <h2 className="text-[13.5px] font-semibold">TVC</h2>
          </div>
          <div className="px-4 py-6 text-center text-[12px] text-foreground-muted">
            {ts(lang, "NEEDS MAPPING — TVC26 sheet not present in the current source file (see Master → Data Coverage).", "CẦN ÁNH XẠ — chưa có sheet TVC26 trong file nguồn hiện tại (xem Master → Data Coverage).")}
          </div>
        </section>
      </div>
    </div>
  );
}

function MonthView({ year, month, weekCode }: { year: number; month: number; weekCode: string }) {
  const calendarData = getMonthCalendarData(year, month);
  const todayIso = new Date().toISOString().slice(0, 10);
  return (
    <CalendarSection
      data={calendarData}
      todayIso={todayIso}
      currentWeekCode={weekCode}
      basePath="/in-store"
      initialFilter="Retail/In-store"
      extraParams="&view=MONTH"
    />
  );
}

function ListView({ lang }: { lang: Lang }) {
  const commitments = getDemoCommitmentSummary();
  const sessionsByWeek = getDemoSessionsByWeek();
  const weeks = Object.keys(sessionsByWeek).sort();

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <h2 className="text-[14px] font-semibold">{ts(lang, "Demo External Commitment — Agreed vs Executed", "Cam kết Demo bên ngoài — Đã thỏa thuận vs Đã thực hiện")}</h2>
        </div>
        <div className="divide-y divide-glass-border/60">
          {commitments.map((c) => {
            const pct = c.agreed_quantity > 0 ? Math.min(100, Math.round((c.executed_quantity / c.agreed_quantity) * 100)) : 0;
            return (
              <div key={c.brand_id} className="px-4 py-3 flex items-center gap-4">
                <div className="w-40 shrink-0">
                  <div className="text-[13px] font-medium truncate">{c.brand_name}</div>
                  <div className="font-mono-tag text-[10.5px] text-foreground-muted truncate">{c.reasons ?? "—"}</div>
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-glass-border overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--green)" : "var(--blue-grey)" }} />
                </div>
                <span className="font-mono-tag text-[11px] text-foreground-muted w-14 text-right">
                  {c.executed_quantity}/{c.agreed_quantity}
                </span>
              </div>
            );
          })}
          {commitments.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">{ts(lang, "No commitments imported", "Chưa nhập cam kết nào")}</div>}
        </div>
      </section>

      {weeks.map((week) => (
        <section key={week} className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-glass-border flex items-center gap-2">
            <h2 className="font-mono-tag text-[13px] font-semibold">{week}</h2>
            <span className="font-mono-tag text-[11px] text-foreground-muted">{sessionsByWeek[week].length} {ts(lang, "sessions", "buổi")}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left font-mono-tag text-[10.5px] uppercase text-foreground-muted border-b border-glass-border">
                  <th className="px-4 py-2 font-medium">{ts(lang, "Area", "Khu vực")}</th>
                  <th className="px-4 py-2 font-medium">{ts(lang, "Session (ca)", "Buổi (ca)")}</th>
                  <th className="px-4 py-2 font-medium">{td(lang, "Brand")}</th>
                  <th className="px-4 py-2 font-medium">{ts(lang, "Theme", "Chủ đề")}</th>
                  <th className="px-4 py-2 font-medium">{ts(lang, "Operated By", "Người thực hiện")}</th>
                  <th className="px-4 py-2 font-medium">{td(lang, "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border/60">
                {sessionsByWeek[week].map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2">{s.location ?? "—"}</td>
                    <td className="px-4 py-2 font-mono-tag text-foreground-muted">{s.session_label ?? "—"}</td>
                    <td className="px-4 py-2 font-medium">{s.brand_name ?? "—"}</td>
                    <td className="px-4 py-2 text-foreground-muted">{s.sku_name ?? "—"}</td>
                    <td className="px-4 py-2 text-foreground-muted">{s.raw_owner ?? "—"}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={s.status as ControlStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export default async function InStorePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const view = (params.view ?? "WEEK").toUpperCase();
  const weekCode = params.week ?? currentWeekCode();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [todayYear, todayMonth] = todayIso.split("-").map(Number);
  const year = params.year ? parseInt(params.year, 10) : todayYear;
  const month = params.month ? parseInt(params.month, 10) : todayMonth;
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">{ts(lang, "In-store", "Tại cửa hàng")}</h1>
          <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">Demo / Tasting · POSM · TVC · {ts(lang, "Store Display", "Trưng bày cửa hàng")}</div>
        </div>
        <ViewTabs active={view} week={weekCode} />
      </div>

      {view === "WEEK" && <WeekView weekCode={weekCode} lang={lang} />}
      {view === "MONTH" && <MonthView year={year} month={month} weekCode={weekCode} />}
      {view === "LIST" && <ListView lang={lang} />}
    </div>
  );
}
