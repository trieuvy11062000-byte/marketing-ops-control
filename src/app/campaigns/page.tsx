import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { QuickFilterChips } from "@/components/ui/QuickFilterChips";
import { CampaignStatusBadge } from "@/components/ui/badges";
import { getCampaignProgress, listCampaigns, listCampaignsForMonth, type CampaignWithStatus } from "@/lib/queries/campaigns";
import type { CampaignStatus } from "@/lib/db/status";
import type { ActivationType } from "@/lib/db/types";
import { getLang, ts } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

const STATUS_FILTERS: (CampaignStatus | "ALL")[] = ["LIVE", "UPCOMING", "COMPLETED", "ENDING SOON", "ALL"];
const TYPE_FILTERS: (ActivationType | "ALL")[] = ["ALL", "CORE_CAMPAIGN", "COMMERCIAL_PROGRAMME", "TACTICAL_ACTIVATION"];
const VIEWS = ["BOARD", "TIMELINE", "LIST"] as const;
type View = (typeof VIEWS)[number];

const TYPE_LABEL: Record<ActivationType, string> = {
  CORE_CAMPAIGN: "CORE CAMPAIGN",
  COMMERCIAL_PROGRAMME: "COMMERCIAL",
  TACTICAL_ACTIVATION: "TACTICAL",
};

const TYPE_COLOR: Record<ActivationType, string> = {
  CORE_CAMPAIGN: "var(--green)",
  COMMERCIAL_PROGRAMME: "var(--blue-grey)",
  TACTICAL_ACTIVATION: "var(--amber)",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase();
}

function ViewTabs({ active, year, month }: { active: View; year: number; month: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {VIEWS.map((v) => (
        <Link
          key={v}
          href={`/campaigns?view=${v}&year=${year}&month=${month}`}
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

function MonthNav({ view, year, month }: { view: View; year: number; month: number }) {
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 w-fit">
      <Link href={`/campaigns?view=${view}&year=${prev.year}&month=${prev.month}`} className="p-1.5 rounded-lg hover:bg-glass-surface-strong text-foreground-muted">
        <ChevronLeft size={16} />
      </Link>
      <span className="font-mono-tag text-[13px] font-semibold min-w-[110px] text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Link href={`/campaigns?view=${view}&year=${next.year}&month=${next.month}`} className="p-1.5 rounded-lg hover:bg-glass-surface-strong text-foreground-muted">
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}

function CampaignCard({ c }: { c: CampaignWithStatus }) {
  const progress = getCampaignProgress(c.id);
  return (
    <Link href={`/campaigns/${encodeURIComponent(c.id)}`} className="block rounded-xl px-3 py-2.5 bg-glass-surface hover:bg-glass-surface-strong transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-[12.5px] font-medium truncate">
          {c.brand_name && <span className="text-foreground-muted">{c.brand_name} · </span>}
          {c.name}
        </div>
        <CampaignStatusBadge status={c.status} />
      </div>
      <div className="font-mono-tag text-[10.5px] text-foreground-muted mt-1 flex items-center gap-2">
        <span>
          {formatDate(c.start_date)} – {formatDate(c.end_date)}
        </span>
        {progress.total > 0 && <span>{progress.done}/{progress.total} exec</span>}
      </div>
    </Link>
  );
}

function BoardView({ year, month, lang }: { year: number; month: number; lang: Lang }) {
  const campaigns = listCampaignsForMonth(year, month);
  const groups: { type: ActivationType; items: CampaignWithStatus[] }[] = [
    { type: "CORE_CAMPAIGN", items: campaigns.filter((c) => c.activation_type === "CORE_CAMPAIGN") },
    { type: "COMMERCIAL_PROGRAMME", items: campaigns.filter((c) => c.activation_type === "COMMERCIAL_PROGRAMME") },
    { type: "TACTICAL_ACTIVATION", items: campaigns.filter((c) => c.activation_type === "TACTICAL_ACTIVATION") },
  ];
  return (
    <div className="flex flex-col gap-4">
      <MonthNav view="BOARD" year={year} month={month} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {groups.map((g) => (
          <section key={g.type} className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-glass-border flex items-center gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: TYPE_COLOR[g.type] }}>
                {TYPE_LABEL[g.type]}
              </h2>
              <span className="font-mono-tag text-[11px] text-foreground-muted">{g.items.length}</span>
            </div>
            <div className="p-2.5 flex flex-col gap-1.5 max-h-[560px] overflow-y-auto">
              {g.items.length === 0 ? (
                <div className="px-2 py-4 text-center text-[12px] text-foreground-muted">{ts(lang, "None this month", "Không có trong tháng này")}</div>
              ) : (
                g.items.map((c) => <CampaignCard key={c.id} c={c} />)
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function TimelineView({ year, month, lang }: { year: number; month: number; lang: Lang }) {
  const campaigns = listCampaignsForMonth(year, month);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = Date.UTC(year, month - 1, 1);
  const dayMs = 86400000;

  const barStyle = (c: CampaignWithStatus) => {
    const start = Math.max(0, Math.round((new Date(c.start_date + "T00:00:00Z").getTime() - monthStart) / dayMs));
    const end = Math.min(lastDay - 1, Math.round((new Date(c.end_date + "T00:00:00Z").getTime() - monthStart) / dayMs));
    const span = Math.max(1, end - start + 1);
    return { left: `${(start / lastDay) * 100}%`, width: `${(span / lastDay) * 100}%` };
  };

  return (
    <div className="flex flex-col gap-4">
      <MonthNav view="TIMELINE" year={year} month={month} />
      <section className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[220px_1fr] border-b border-glass-border">
          <div />
          <div className="relative h-6 px-1">
            {Array.from({ length: lastDay }, (_, i) => i + 1)
              .filter((d) => d === 1 || d % 5 === 0)
              .map((d) => (
                <span key={d} className="absolute font-mono-tag text-[9.5px] text-foreground-muted" style={{ left: `${((d - 1) / lastDay) * 100}%` }}>
                  {d}
                </span>
              ))}
          </div>
        </div>
        <div className="divide-y divide-glass-border/60">
          {campaigns.map((c) => (
            <div key={c.id} className="grid grid-cols-[220px_1fr] items-center min-h-[42px]">
              <Link href={`/campaigns/${encodeURIComponent(c.id)}`} className="px-3 py-2 min-w-0 hover:underline">
                <div className="text-[11.5px] font-medium truncate">{c.name}</div>
                <div className="font-mono-tag text-[9.5px] text-foreground-muted">{TYPE_LABEL[c.activation_type]}</div>
              </Link>
              <div className="relative h-full px-1 py-2">
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-4 rounded-full"
                  style={{ ...barStyle(c), background: TYPE_COLOR[c.activation_type], opacity: 0.85 }}
                  title={`${formatDate(c.start_date)} – ${formatDate(c.end_date)}`}
                />
              </div>
            </div>
          ))}
          {campaigns.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">{ts(lang, "No activations this month", "Không có chiến dịch trong tháng này")}</div>}
        </div>
      </section>
    </div>
  );
}

function ListView({ quick, type, lang }: { quick: CampaignStatus | "ALL"; type: ActivationType | "ALL"; lang: Lang }) {
  const all = listCampaigns();
  const campaigns = all.filter((c) => quick === "ALL" || c.status === quick).filter((c) => type === "ALL" || c.activation_type === type);

  const qs = (overrides: { quick?: string; type?: string }) => {
    const merged = { quick, type, ...overrides };
    return `/campaigns?view=LIST&quick=${encodeURIComponent(merged.quick)}&type=${encodeURIComponent(merged.type)}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <QuickFilterChips options={TYPE_FILTERS} active={type} hrefFor={(o) => qs({ type: o })} />
        <QuickFilterChips options={STATUS_FILTERS} active={quick} hrefFor={(o) => qs({ quick: o })} />
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        {campaigns.map((c) => {
          const progress = getCampaignProgress(c.id);
          return (
            <Link
              key={c.id}
              href={`/campaigns/${encodeURIComponent(c.id)}`}
              className="flex items-center justify-between gap-3 px-4 py-3 border-b border-glass-border/60 last:border-b-0 hover:bg-glass-surface transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px]">
                  {c.brand_name && <span className="font-medium">{c.brand_name}</span>}
                  <span className="text-foreground-muted truncate">{c.name}</span>
                </div>
                <div className="font-mono-tag text-[11px] text-foreground-muted mt-0.5 flex items-center gap-2">
                  <span style={{ color: TYPE_COLOR[c.activation_type] }}>{TYPE_LABEL[c.activation_type]}</span>
                  <span>
                    {formatDate(c.start_date)} – {formatDate(c.end_date)}
                  </span>
                  {progress.total > 0 && <span>{progress.done}/{progress.total} {ts(lang, "executed", "đã thực hiện")}</span>}
                  {c.driver && <span>{ts(lang, "driver", "động lực")}: {c.driver}</span>}
                </div>
              </div>
              <CampaignStatusBadge status={c.status} />
            </Link>
          );
        })}
        {campaigns.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">{ts(lang, "No activations match this filter", "Không có chiến dịch nào khớp bộ lọc này")}</div>}
      </div>
    </div>
  );
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; quick?: string; type?: string; year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const view = ((params.view ?? "BOARD").toUpperCase() as View) in { BOARD: 1, TIMELINE: 1, LIST: 1 } ? ((params.view ?? "BOARD").toUpperCase() as View) : "BOARD";
  const quick = (params.quick as CampaignStatus | "ALL") ?? "LIVE";
  const type = (params.type as ActivationType | "ALL") ?? "ALL";
  const todayIso = new Date().toISOString().slice(0, 10);
  const [todayYear, todayMonth] = todayIso.split("-").map(Number);
  const year = params.year ? parseInt(params.year, 10) : todayYear;
  const month = params.month ? parseInt(params.month, 10) : todayMonth;
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">{ts(lang, "Activations", "Chiến dịch")}</h1>
          <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
            {ts(lang, "Core Campaign · Commercial Programme · Tactical Activation — the orchestration parent; Promotion/Demo/A&P link out, never duplicated", "Core Campaign · Commercial Programme · Tactical Activation — lớp điều phối chính; Promotion/Demo/A&P liên kết ra ngoài, không trùng lặp")}
          </div>
        </div>
        <ViewTabs active={view} year={year} month={month} />
      </div>

      {view === "BOARD" && <BoardView year={year} month={month} lang={lang} />}
      {view === "TIMELINE" && <TimelineView year={year} month={month} lang={lang} />}
      {view === "LIST" && <ListView quick={quick} type={type} lang={lang} />}
    </div>
  );
}
