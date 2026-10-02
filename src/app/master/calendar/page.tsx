import Link from "next/link";
import { listCalendarMonths, listCalendarYears } from "@/lib/queries/master";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function AnnualCalendarPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: yearParam } = await searchParams;
  const years = listCalendarYears();
  const year = yearParam ? parseInt(yearParam, 10) : years[0];
  const months = year ? listCalendarMonths(year) : [];
  const byMonth = new Map(months.map((m) => [m.month_number, m]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/master" className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground">← Master</Link>
          <h1 className="text-[22px] font-semibold mt-1">Annual Campaign Calendar</h1>
          <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
            Reference calendar knowledge — theme, timing and hero category per month. Separate from live execution (see Calendar / Activations for what&apos;s actually running).
          </div>
        </div>
        {years.length > 0 && (
          <div className="flex items-center gap-1.5">
            {years.map((y) => (
              <Link key={y} href={`/master/calendar?year=${y}`} className={`font-mono-tag text-[12px] rounded-full px-3 py-1.5 ${year === y ? "bg-glass-surface-strong border border-glass-border" : "text-foreground-muted hover:bg-glass-surface"}`}>
                {y}
              </Link>
            ))}
          </div>
        )}
      </div>

      {years.length === 0 ? (
        <div className="glass rounded-2xl px-4 py-8 text-center text-[12.5px] text-foreground-muted">
          No annual campaign calendar knowledge has been loaded yet. Supply the Theme / Campaign Type / Campaign Name / Planning Date / Start / End / Hero Category / Special Dates
          reference for each month (e.g. Q4 2026) and it will populate here — this view never invents calendar content from execution records.
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">Theme</th>
                  <th className="px-3 py-2 font-medium">Campaign Type</th>
                  <th className="px-3 py-2 font-medium">Campaign Name</th>
                  <th className="px-3 py-2 font-medium">Planning Date</th>
                  <th className="px-3 py-2 font-medium">Start</th>
                  <th className="px-3 py-2 font-medium">End</th>
                  <th className="px-3 py-2 font-medium">Hero Category</th>
                  <th className="px-3 py-2 font-medium">Special Dates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border/60">
                {MONTH_NAMES.map((label, i) => {
                  const m = byMonth.get(i + 1);
                  return (
                    <tr key={i} className="hover:bg-glass-surface transition-colors">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{label}</td>
                      <td className="px-3 py-2 text-foreground-muted">{m?.theme ?? "—"}</td>
                      <td className="px-3 py-2 text-foreground-muted">{m?.campaign_type ?? "—"}</td>
                      <td className="px-3 py-2">{m?.campaign_name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono-tag text-foreground-muted">{m?.planning_date ?? "—"}</td>
                      <td className="px-3 py-2 font-mono-tag text-foreground-muted">{m?.start_date ?? "—"}</td>
                      <td className="px-3 py-2 font-mono-tag text-foreground-muted">{m?.end_date ?? "—"}</td>
                      <td className="px-3 py-2 text-foreground-muted">{m?.hero_category ?? "—"}</td>
                      <td className="px-3 py-2 text-foreground-muted">{m?.special_dates ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
