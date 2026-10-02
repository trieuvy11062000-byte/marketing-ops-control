import Link from "next/link";
import { QuickFilterChips } from "@/components/ui/QuickFilterChips";
import { EmptyRow } from "@/components/ui/TaskRow";
import { DigitalMonthCalendar } from "@/components/digital/DigitalMonthCalendar";
import {
  getDigitalMonthData,
  getDigitalQuickCounts,
  getDigitalWeekSummary,
  getEmailLanes,
  getSocialPlanner,
  getWebsitePanel,
  listDigitalActivities,
  type DigitalQuickFilter,
} from "@/lib/queries/digital";
import { currentWeekCode } from "@/lib/db/weeks";
import { getLang, ts } from "@/lib/i18n";
import { td } from "@/lib/i18nDict";
import type { Lang } from "@/lib/i18n";

const VIEWS = ["CALENDAR", "SOCIAL", "EMAIL", "WEBSITE", "LIST"] as const;
type View = (typeof VIEWS)[number];

const QUICK_FILTERS: DigitalQuickFilter[] = ["ALL", "SOCIAL", "WEBSITE", "EMAIL", "VIDEO", "RETAIL", "WHOLESALE", "NEED INFO", "NEED AUDIT"];

const SUBTYPE_COLOR: Record<string, string> = {
  Social: "var(--blue-grey)",
  Website: "var(--green)",
  Email: "var(--amber)",
  Video: "var(--red)",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase();
}

function ViewTabs({ active }: { active: View }) {
  return (
    <div className="flex items-center gap-1.5">
      {VIEWS.map((v) => (
        <Link
          key={v}
          href={`/digital?view=${v}`}
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

function WeekSummaryStrip({ weekCode, lang }: { weekCode: string; lang: Lang }) {
  const s = getDigitalWeekSummary(weekCode);
  const chips: { label: string; value: number; accent?: "amber" }[] = [
    { label: ts(lang, "Social Posts", "Bài Social"), value: s.social },
    { label: ts(lang, "Retail Emails", "Email Retail"), value: s.retailEmail },
    { label: ts(lang, "Wholesale Emails", "Email Wholesale"), value: s.wholesaleEmail },
    { label: ts(lang, "Website Updates", "Cập nhật Website"), value: s.website },
    { label: ts(lang, "Videos", "Video"), value: s.video },
    { label: ts(lang, "Need Audit", "Cần kiểm tra"), value: s.needAudit, accent: s.needAudit > 0 ? "amber" : undefined },
    { label: ts(lang, "Waiting Info", "Chờ thông tin"), value: s.waitingInfo, accent: s.waitingInfo > 0 ? "amber" : undefined },
  ];
  return (
    <div className="flex flex-wrap gap-2.5">
      {chips.map((c) => (
        <div key={c.label} className="glass rounded-xl px-3 py-2 flex flex-col items-start min-w-[100px]">
          <span className="font-mono-tag text-[18px] font-bold" style={{ color: c.accent === "amber" ? "var(--amber)" : undefined }}>
            {c.value}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-foreground-muted">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function SocialView({ lang }: { lang: Lang }) {
  const rows = getSocialPlanner();
  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-glass-border">
        <h2 className="text-[14px] font-semibold">{ts(lang, "Social Content Planner", "Kế hoạch nội dung Social")}</h2>
        <div className="text-[11.5px] text-foreground-muted mt-0.5">{ts(lang, "Date-first — not grouped by brand", "Theo ngày — không nhóm theo thương hiệu")}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
              <th className="px-4 py-2 font-medium">{td(lang, "Date")}</th>
              <th className="px-4 py-2 font-medium">{ts(lang, "Platform", "Nền tảng")}</th>
              <th className="px-4 py-2 font-medium">{ts(lang, "Content", "Nội dung")}</th>
              <th className="px-4 py-2 font-medium">{ts(lang, "Supports", "Hỗ trợ")}</th>
              <th className="px-4 py-2 font-medium">{td(lang, "Brand")}</th>
              <th className="px-4 py-2 font-medium">{ts(lang, "Info", "Thông tin")}</th>
              <th className="px-4 py-2 font-medium">{td(lang, "Status")}</th>
              <th className="px-4 py-2 font-medium">{ts(lang, "Audit", "Kiểm tra")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border/60">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-glass-surface transition-colors">
                <td className="px-4 py-2 font-mono-tag text-foreground-muted whitespace-nowrap">{formatDate(r.planned_date)}</td>
                <td className="px-4 py-2 font-mono-tag">{r.platform ?? "—"}</td>
                <td className="px-4 py-2">
                  <Link href={`/digital/${encodeURIComponent(r.id)}`} className="hover:underline">
                    {r.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-foreground-muted">{r.campaign_name ?? "—"}</td>
                <td className="px-4 py-2 text-foreground-muted">{r.brand_name ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className="font-mono-tag text-[10px]" style={{ color: r.info_status === "READY" ? "var(--green)" : "var(--amber)" }}>
                    {r.info_status}
                  </span>
                </td>
                <td className="px-4 py-2 text-foreground-muted">{r.content_status}</td>
                <td className="px-4 py-2" style={{ color: r.audit === "✓" ? "var(--green)" : "var(--amber)" }}>
                  {r.audit}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-foreground-muted">
                  {ts(lang, "No social records", "Chưa có bản ghi Social")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmailLane({ title, rows, lang }: { title: string; rows: ReturnType<typeof getEmailLanes>["retail"]; lang: Lang }) {
  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-glass-border">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <span className="font-mono-tag text-[11px] text-foreground-muted">{rows.length}</span>
      </div>
      <div className="divide-y divide-glass-border/60 max-h-[420px] overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-foreground-muted">{ts(lang, "No records", "Chưa có bản ghi")}</div>
        ) : (
          rows.map((r) => (
            <Link key={r.id} href={`/digital/${encodeURIComponent(r.id)}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-glass-surface transition-colors">
              <div className="min-w-0">
                <div className="text-[12.5px] truncate">
                  {r.brand_name && <span className="font-medium">{r.brand_name} · </span>}
                  {r.title}
                </div>
                <div className="font-mono-tag text-[10.5px] text-foreground-muted">{formatDate(r.post_date)}</div>
              </div>
              <span className="font-mono-tag text-[10.5px] text-foreground-muted shrink-0">{r.status ?? "—"}</span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function EmailView({ lang }: { lang: Lang }) {
  const { retail, wholesale } = getEmailLanes();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <EmailLane title="Retail" rows={retail} lang={lang} />
      <EmailLane title="Wholesale" rows={wholesale} lang={lang} />
    </div>
  );
}

function WebsiteView({ lang }: { lang: Lang }) {
  const { recent, upcoming } = getWebsitePanel();
  const needCheck = [...recent, ...upcoming].filter((r) => r.needCheck);
  const groups = [
    { label: ts(lang, "Need Check", "Cần kiểm tra"), rows: needCheck, accent: "var(--amber)" },
    { label: ts(lang, "Upcoming", "Sắp tới"), rows: upcoming.filter((r) => !r.needCheck) },
    { label: ts(lang, "Recent", "Gần đây"), rows: recent.filter((r) => !r.needCheck) },
  ];
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <section key={g.label} className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-glass-border flex items-center gap-2">
            <h2 className="text-[13.5px] font-semibold">{g.label}</h2>
            <span className="font-mono-tag text-[11px] text-foreground-muted">{g.rows.length}</span>
          </div>
          <div className="divide-y divide-glass-border/60">
            {g.rows.length === 0 ? (
              <div className="px-4 py-4 text-center text-[12px] text-foreground-muted">{ts(lang, "None", "Không có")}</div>
            ) : (
              g.rows.map((r) => (
                <Link key={r.id} href={`/digital/${encodeURIComponent(r.id)}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-glass-surface transition-colors">
                  <div className="text-[12.5px]">{r.title}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-tag text-[10.5px] text-foreground-muted">{r.channel_scope}</span>
                    <span className="font-mono-tag text-[10.5px] text-foreground-muted">{formatDate(r.planned_date)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function ListView({ quick, campaignId, lang }: { quick: DigitalQuickFilter; campaignId?: string; lang: Lang }) {
  const counts = getDigitalQuickCounts();
  const activities = listDigitalActivities({ quick, campaignId });
  return (
    <div className="flex flex-col gap-3">
      <QuickFilterChips options={QUICK_FILTERS} active={quick} hrefFor={(o) => `/digital?view=LIST&quick=${encodeURIComponent(o)}`} counts={counts} />
      <div className="glass rounded-2xl overflow-hidden">
        {activities.length === 0 ? (
          <EmptyRow label={ts(lang, "No digital activities match this filter", "Không có hoạt động Digital nào khớp bộ lọc này")} />
        ) : (
          activities.map((a) => (
            <Link
              key={a.id}
              href={`/digital/${encodeURIComponent(a.id)}`}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 border-b border-glass-border/60 last:border-b-0 hover:bg-glass-surface transition-colors"
            >
              <span className="font-mono-tag text-[10px] uppercase rounded px-1.5 py-0.5 shrink-0" style={{ background: "var(--glass-surface)", color: SUBTYPE_COLOR[a.subtype] }}>
                {a.subtype}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px]">
                  {a.brand_name && <span className="font-medium">{a.brand_name}</span>}
                  <span className="text-foreground-muted truncate">{a.title}</span>
                </div>
                <div className="font-mono-tag text-[11px] text-foreground-muted mt-0.5">
                  {a.channel_scope} {a.platform ? `· ${a.platform}` : ""} {a.campaign_name ? `· ${a.campaign_name}` : ""}
                </div>
              </div>
              <span className="font-mono-tag text-[11px] text-foreground-muted whitespace-nowrap">{formatDate(a.planned_date)}</span>
              <span className="font-mono-tag text-[10.5px] text-foreground-muted whitespace-nowrap w-24 text-right truncate">{a.status ?? "—"}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export default async function DigitalPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; quick?: string; campaignId?: string; year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const view = ((params.view ?? "CALENDAR").toUpperCase() as View) in { CALENDAR: 1, SOCIAL: 1, EMAIL: 1, WEBSITE: 1, LIST: 1 } ? ((params.view ?? "CALENDAR").toUpperCase() as View) : "CALENDAR";
  const quick = (params.quick as DigitalQuickFilter) ?? "ALL";
  const weekCode = currentWeekCode();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [todayYear, todayMonth] = todayIso.split("-").map(Number);
  const year = params.year ? parseInt(params.year, 10) : todayYear;
  const month = params.month ? parseInt(params.month, 10) : todayMonth;
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Digital</h1>
          <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">{ts(lang, "Social · Email/eNews · Website · Video — supports Activations, Demo and Supply Signals", "Social · Email/eNews · Website · Video — hỗ trợ Chiến dịch, Demo và Thông tin hàng hóa")}</div>
        </div>
        <ViewTabs active={view} />
      </div>

      <WeekSummaryStrip weekCode={weekCode} lang={lang} />

      {view === "CALENDAR" && <DigitalMonthCalendar data={getDigitalMonthData(year, month, { quick })} todayIso={todayIso} />}
      {view === "SOCIAL" && <SocialView lang={lang} />}
      {view === "EMAIL" && <EmailView lang={lang} />}
      {view === "WEBSITE" && <WebsiteView lang={lang} />}
      {view === "LIST" && <ListView quick={quick} campaignId={params.campaignId} lang={lang} />}
    </div>
  );
}
