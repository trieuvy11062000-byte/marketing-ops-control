import type { ReactNode } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/ui/KpiCard";
import { TaskRow, EmptyRow } from "@/components/ui/TaskRow";
import { CalendarSection } from "@/components/calendar/CalendarSection";
import { QuickTasksWidget } from "@/components/quickTasks/QuickTasksWidget";
import { CampaignStatusBadge } from "@/components/ui/badges";
import { getControlSummary, getSupplyUpdates, getTasksByBucket } from "@/lib/queries/dashboard";
import { getMonthCalendarData } from "@/lib/queries/calendar";
import { listActiveQuickTasks } from "@/lib/queries/quickTasks";
import { getInStoreWeekSummary } from "@/lib/queries/inStore";
import { getDigitalWeekSummary } from "@/lib/queries/digital";
import { getApBrandDelivery } from "@/lib/queries/ap";
import { listCampaigns } from "@/lib/queries/campaigns";
import { listPromotions } from "@/lib/queries/promotions";
import { currentWeekCode } from "@/lib/db/weeks";
import { getWeek } from "@/lib/queries/weeks";
import { getLang, ts } from "@/lib/i18n";
import { td } from "@/lib/i18nDict";
import type { Lang } from "@/lib/i18n";

function greeting(lang: Lang): string {
  const h = new Date().getHours();
  if (h < 12) return ts(lang, "Good morning", "Chào buổi sáng");
  if (h < 18) return ts(lang, "Good afternoon", "Chào buổi chiều");
  return ts(lang, "Good evening", "Chào buổi tối");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase();
}

function Section({ title, bucket, href, lang }: { title: string; bucket: Parameters<typeof getTasksByBucket>[0]; href: string; lang: Lang }) {
  const tasks = getTasksByBucket(bucket).slice(0, 8);
  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <Link href={href} className="text-[11.5px] text-foreground-muted hover:text-foreground font-mono-tag">
          {td(lang, "View All")} →
        </Link>
      </div>
      <div>{tasks.length === 0 ? <EmptyRow label={td(lang, "Nothing here — all clear")} /> : tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
    </section>
  );
}

function WidgetChip({ label, value, accent }: { label: string; value: number | string; accent?: "red" | "amber" }) {
  return (
    <div className="flex flex-col items-start min-w-[76px]">
      <span className="font-mono-tag text-[16px] font-bold" style={{ color: accent === "red" ? "var(--red)" : accent === "amber" ? "var(--amber)" : undefined }}>
        {value}
      </span>
      <span className="text-[9.5px] uppercase tracking-wide text-foreground-muted">{label}</span>
    </div>
  );
}

function WidgetCard({ title, href, children, lang }: { title: string; href: string; children: ReactNode; lang: Lang }) {
  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <Link href={href} className="text-[11px] text-foreground-muted hover:text-foreground font-mono-tag">
          {td(lang, "Open")} →
        </Link>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function InStoreWidget({ weekCode, lang }: { weekCode: string; lang: Lang }) {
  const s = getInStoreWeekSummary(weekCode);
  return (
    <WidgetCard title={ts(lang, "In-store", "Tại cửa hàng")} href="/in-store" lang={lang}>
      <div className="flex flex-wrap gap-4">
        <WidgetChip label={ts(lang, "Demo Sessions", "Buổi Demo")} value={s.demoSessions} />
        <WidgetChip label={td(lang, "At Risk")} value={s.demoAtRisk} accent={s.demoAtRisk > 0 ? "red" : undefined} />
        <WidgetChip label={ts(lang, "Evidence Missing", "Thiếu bằng chứng")} value={s.evidenceMissing} accent={s.evidenceMissing > 0 ? "amber" : undefined} />
        <WidgetChip label={ts(lang, "Need Review", "Cần xem lại")} value={s.needMyReview} accent={s.needMyReview > 0 ? "amber" : undefined} />
      </div>
    </WidgetCard>
  );
}

function DigitalWidget({ weekCode, lang }: { weekCode: string; lang: Lang }) {
  const s = getDigitalWeekSummary(weekCode);
  return (
    <WidgetCard title="Digital" href="/digital" lang={lang}>
      <div className="flex flex-wrap gap-4">
        <WidgetChip label={ts(lang, "Social", "Social")} value={s.social} />
        <WidgetChip label={ts(lang, "Retail Email", "Email Retail")} value={s.retailEmail} />
        <WidgetChip label={ts(lang, "Wholesale Email", "Email Wholesale")} value={s.wholesaleEmail} />
        <WidgetChip label={ts(lang, "Website", "Website")} value={s.website} />
        <WidgetChip label={ts(lang, "Need Audit", "Cần kiểm tra")} value={s.needAudit} accent={s.needAudit > 0 ? "amber" : undefined} />
        <WidgetChip label={ts(lang, "Waiting Info", "Chờ thông tin")} value={s.waitingInfo} accent={s.waitingInfo > 0 ? "amber" : undefined} />
      </div>
    </WidgetCard>
  );
}

function ApReportingWidget({ lang }: { lang: Lang }) {
  const rows = getApBrandDelivery();
  const missingDelivery = rows.reduce((n, r) => n + r.missing_delivery, 0);
  const missingData = rows.reduce((n, r) => n + r.missing_data, 0);
  const brandsWithIssues = rows.filter((r) => r.missing_delivery > 0 || r.missing_data > 0).length;
  return (
    <WidgetCard title={ts(lang, "A&P / Reporting", "A&P / Báo cáo")} href="/ap" lang={lang}>
      <div className="flex flex-wrap gap-4">
        <WidgetChip label={ts(lang, "Brands w/ Issues", "Thương hiệu có vấn đề")} value={brandsWithIssues} accent={brandsWithIssues > 0 ? "amber" : undefined} />
        <WidgetChip label={ts(lang, "Missing Delivery", "Thiếu bàn giao")} value={missingDelivery} accent={missingDelivery > 0 ? "red" : undefined} />
        <WidgetChip label={ts(lang, "Missing Data", "Thiếu dữ liệu")} value={missingData} accent={missingData > 0 ? "amber" : undefined} />
        <WidgetChip label={ts(lang, "Total Brands", "Tổng thương hiệu")} value={rows.length} />
      </div>
    </WidgetCard>
  );
}

function InfoSupplyWidget({ lang }: { lang: Lang }) {
  const updates = getSupplyUpdates(5);
  return (
    <WidgetCard title={ts(lang, "Info / Supply Updates", "Thông tin / Cập nhật hàng hóa")} href="/import?tab=DATA_HEALTH" lang={lang}>
      {updates.length === 0 ? (
        <div className="text-[12px] text-foreground-muted py-1">{ts(lang, "No container/stock signals due in the next 21 days", "Không có container/hàng hóa nào sắp đến trong 21 ngày tới")}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {updates.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate">
                {u.supplier ?? u.product_label ?? u.container_no ?? "Container"}
                {u.container_no && u.supplier ? ` · ${u.container_no}` : ""}
              </span>
              <span className="font-mono-tag text-[10.5px] text-foreground-muted whitespace-nowrap shrink-0">
                {formatDate(u.eta)} {u.status ? `· ${u.status}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

function LiveActivationsWidget({ lang }: { lang: Lang }) {
  const live = listCampaigns().filter((c) => c.status === "LIVE" || c.status === "ENDING SOON").slice(0, 5);
  return (
    <WidgetCard title={ts(lang, "Live Activations", "Chiến dịch đang chạy")} href="/campaigns?view=BOARD" lang={lang}>
      {live.length === 0 ? (
        <div className="text-[12px] text-foreground-muted py-1">{ts(lang, "No activations currently live", "Hiện không có chiến dịch nào đang chạy")}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {live.map((c) => (
            <Link key={c.id} href={`/campaigns/${encodeURIComponent(c.id)}`} className="flex items-center justify-between gap-2 text-[12px] hover:underline">
              <span className="truncate">
                {c.brand_name && <span className="text-foreground-muted">{c.brand_name} · </span>}
                {c.name}
              </span>
              <CampaignStatusBadge status={c.status} />
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

function PromotionWatchWidget({ lang }: { lang: Lang }) {
  const all = listPromotions({ quick: "ALL" });
  const exceptions = all
    .filter((p) => p.status === "ENDING SOON" || (p.stock_status && p.status === "LIVE"))
    .slice(0, 6);
  return (
    <WidgetCard title={ts(lang, "Promotion Watch", "Theo dõi khuyến mãi")} href="/promotions" lang={lang}>
      {exceptions.length === 0 ? (
        <div className="text-[12px] text-foreground-muted py-1">{ts(lang, "No promotion exceptions right now", "Hiện không có khuyến mãi bất thường")}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {exceptions.map((p) => (
            <Link key={p.id} href={`/promotions/${encodeURIComponent(p.id)}`} className="flex items-center justify-between gap-2 text-[12px] hover:underline">
              <span className="truncate">
                {p.brand_name && <span className="text-foreground-muted">{p.brand_name} · </span>}
                {p.sku_name ?? p.sku_code ?? "—"}
              </span>
              <span className="font-mono-tag text-[10.5px] text-foreground-muted whitespace-nowrap shrink-0">
                {p.stock_status ? ts(lang, "STOCK", "TỒN KHO") : p.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string; day?: string }> }) {
  const params = await searchParams;
  const todayIso = new Date().toISOString().slice(0, 10); // UTC — matches the rest of the app's date convention
  const [todayYear, todayMonth] = todayIso.split("-").map(Number);
  const year = params.year ? parseInt(params.year, 10) : todayYear;
  const month = params.month ? parseInt(params.month, 10) : todayMonth;
  const initialDate = params.day ? `${year}-${String(month).padStart(2, "0")}-${String(parseInt(params.day, 10)).padStart(2, "0")}` : undefined;

  const summary = getControlSummary();
  const week = currentWeekCode();
  const weekInfo = getWeek(week);
  const calendarData = getMonthCalendarData(year, month);
  const quickTasks = listActiveQuickTasks(7);
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-8">
      <div>
        <div className="text-[13px] text-foreground-muted">{greeting(lang)}</div>
        <h1 className="text-[30px] font-bold tracking-tight">{ts(lang, "Marketing Operations Control", "Điều hành Marketing")}</h1>
        <div className="font-mono-tag text-[12.5px] text-foreground-muted mt-1">
          {week} · {weekInfo?.month} {weekInfo?.year}
        </div>
      </div>

      {/* MY CONTROL */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard label={ts(lang, "Need My Review", "Cần tôi xem lại")} value={summary.needReview} href="/tasks?bucket=needReview" accent="amber" />
        <KpiCard label={td(lang, "Overdue")} value={summary.overdue} href="/tasks?bucket=overdue" accent="red" />
        <KpiCard label={td(lang, "At Risk")} value={summary.atRisk} href="/tasks?bucket=atRisk" accent="amber" />
        <KpiCard label={td(lang, "Blocked")} value={summary.blocked} href="/tasks?bucket=blocked" accent="red" />
        <KpiCard label={ts(lang, "External Due", "Hạn bên ngoài")} value={summary.externalDue} href="/tasks?bucket=externalDue" accent="green" />
      </div>

      {/* MONTH CALENDAR */}
      <CalendarSection data={calendarData} todayIso={todayIso} currentWeekCode={week} initialDate={initialDate} />

      {/* THIS WEEK */}
      <div className="flex flex-col gap-5">
        <Section title={td(lang, "This Week")} bucket="thisWeek" href="/tasks?bucket=thisWeek" lang={lang} />
        <Section title={td(lang, "Next 2 Weeks")} bucket="next2Weeks" href="/tasks?bucket=next2Weeks" lang={lang} />
      </div>

      {/* IN-STORE */}
      <InStoreWidget weekCode={week} lang={lang} />

      {/* DIGITAL */}
      <DigitalWidget weekCode={week} lang={lang} />

      {/* QUICK TASKS */}
      <QuickTasksWidget initialTasks={quickTasks} />

      {/* A&P / REPORTING */}
      <ApReportingWidget lang={lang} />

      {/* INFO / SUPPLY UPDATES */}
      <InfoSupplyWidget lang={lang} />

      {/* LIVE ACTIVATIONS */}
      <LiveActivationsWidget lang={lang} />

      {/* PROMOTION WATCH — exceptions only */}
      <PromotionWatchWidget lang={lang} />
    </div>
  );
}
