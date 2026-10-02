import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekWorkload } from "@/lib/queries/weeks";
import { currentWeekCode } from "@/lib/db/weeks";

function weekNum(code: string): number {
  return parseInt(code.replace(/^W/i, ""), 10);
}

function clampWeek(n: number): number {
  return Math.min(52, Math.max(1, n));
}

export function WeekNavigator({ selected }: { selected: string }) {
  const n = weekNum(selected);
  const from = clampWeek(n - 2);
  const to = clampWeek(n + 2);
  const workload = getWeekWorkload(`W${String(from).padStart(2, "0")}`, `W${String(to).padStart(2, "0")}`);
  const today = currentWeekCode();
  const maxCount = Math.max(1, ...workload.map((w) => w.count));

  return (
    <div className="glass rounded-2xl px-3 py-3 flex items-center gap-2">
      <Link
        href={`/week/W${String(clampWeek(n - 1)).padStart(2, "0")}`}
        className="p-1.5 rounded-lg hover:bg-glass-surface-strong text-foreground-muted"
      >
        <ChevronLeft size={16} />
      </Link>

      <div className="flex items-center gap-1.5 flex-1 justify-center">
        {workload.map((w) => {
          const active = w.week_code === selected;
          const isToday = w.week_code === today;
          const dots = Math.max(1, Math.round((w.count / maxCount) * 5));
          return (
            <Link
              key={w.week_code}
              href={`/week/${w.week_code}`}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 min-w-[64px] transition-colors ${
                active ? "bg-glass-surface-strong border border-glass-border" : "hover:bg-glass-surface"
              }`}
            >
              <span className={`font-mono-tag text-[12.5px] font-semibold ${active ? "text-foreground" : "text-foreground-muted"}`}>
                {w.week_code}
                {isToday && <span style={{ color: "var(--green)" }}>•</span>}
              </span>
              <span className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: i < dots ? "var(--blue-grey)" : "var(--glass-border)" }}
                  />
                ))}
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        href={`/week/W${String(clampWeek(n + 1)).padStart(2, "0")}`}
        className="p-1.5 rounded-lg hover:bg-glass-surface-strong text-foreground-muted"
      >
        <ChevronRight size={16} />
      </Link>

      <Link
        href={`/week/${today}`}
        className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground ml-1 shrink-0"
      >
        TODAY
      </Link>
    </div>
  );
}
