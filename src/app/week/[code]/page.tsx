import { notFound } from "next/navigation";
import { WeekNavigator } from "@/components/week/WeekNavigator";
import { WorkstreamGroup } from "@/components/week/WorkstreamGroup";
import { CollapsibleGroup } from "@/components/week/CollapsibleGroup";
import { PromotionRow } from "@/components/ui/PromotionRow";
import { EmptyRow } from "@/components/ui/TaskRow";
import { getWeekTasksByWorkstream, getWeekSummary, getWeekPromotions } from "@/lib/queries/weekView";
import { getWeek } from "@/lib/queries/weeks";

const WORKSTREAM_ORDER = ["Retail/In-store", "Digital", "A&P", "Project/Management"] as const;

export default async function WeekPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const weekCode = code.toUpperCase();
  const week = getWeek(weekCode);
  if (!week) notFound();

  const groups = getWeekTasksByWorkstream(weekCode);
  const summary = getWeekSummary(weekCode);
  const promotions = getWeekPromotions(weekCode);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight font-mono-tag">{weekCode}</h1>
        <div className="font-mono-tag text-[12.5px] text-foreground-muted mt-1">
          {new Date(week.start_date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })} –{" "}
          {new Date(week.end_date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })} ·{" "}
          {week.parity}
        </div>
      </div>

      <WeekNavigator selected={weekCode} />

      <div className="flex gap-4 font-mono-tag text-[12px]">
        <span>
          Need Review <b className="text-foreground">{summary.needReview}</b>
        </span>
        <span style={{ color: "var(--red)" }}>
          Overdue <b>{summary.overdue}</b>
        </span>
        <span style={{ color: "var(--amber)" }}>
          At Risk <b>{summary.atRisk}</b>
        </span>
        <span style={{ color: "var(--red)" }}>
          Blocked <b>{summary.blocked}</b>
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <WorkstreamGroup title="Retail/In-store" tasks={groups["Retail/In-store"] ?? []} />

        <CollapsibleGroup title="Promotion" count={promotions.length}>
          {promotions.length === 0 ? (
            <EmptyRow label="No promotions scheduled this week" />
          ) : (
            promotions.map((p) => <PromotionRow key={p.id} promotion={p} />)
          )}
        </CollapsibleGroup>

        <WorkstreamGroup title="Digital" tasks={groups["Digital"] ?? []} />
        <WorkstreamGroup title="A&P" tasks={groups["A&P"] ?? []} />
        <WorkstreamGroup title="Project/Management" tasks={groups["Project/Management"] ?? []} />
      </div>
    </div>
  );
}
