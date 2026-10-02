"use client";

import Link from "next/link";
import type { DayCellSummary } from "@/lib/queries/calendar";

const RISK_COLOR: Record<string, string> = {
  RED: "var(--red)",
  AMBER: "var(--amber)",
};

function DayCell({
  cell,
  dayNum,
  isToday,
  isSelected,
  onSelect,
}: {
  cell: DayCellSummary | undefined;
  dayNum: number;
  isToday: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  if (!cell) return <div />;
  const preview = cell.previewItems.slice(0, 3);
  const overflow = Math.max(0, cell.previewItems.length - 3);

  return (
    <button
      onClick={onSelect}
      className={`flex flex-col items-stretch text-left rounded-xl p-2 min-h-[92px] border transition-colors ${
        isSelected ? "bg-glass-surface-strong border-glass-border" : "border-transparent hover:bg-glass-surface"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`font-mono-tag text-[11.5px] ${isToday ? "rounded-full px-1.5 font-semibold" : "text-foreground-muted"}`}
          style={isToday ? { background: "var(--green-bg)", color: "var(--green)" } : undefined}
        >
          {dayNum}
        </span>
        <div className="flex items-center gap-1">
          {cell.redCount > 0 && <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--red)" }} />}
          {cell.amberCount > 0 && <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--amber)" }} />}
        </div>
      </div>

      <div className="flex flex-col gap-0.5 mt-1.5">
        {preview.map((item, i) => (
          <div key={i} className="flex items-center gap-1 text-[10.5px] leading-tight truncate">
            {item.type === "CONTROL" && (
              <span
                className="h-[5px] w-[5px] rounded-full shrink-0"
                style={{ background: item.risk && RISK_COLOR[item.risk] ? RISK_COLOR[item.risk] : "var(--blue-grey)" }}
              />
            )}
            {item.type === "EXECUTION" && <span className="h-[5px] w-[5px] rounded-full shrink-0 bg-foreground" />}
            {item.type === "QUICKTASK" && <span className="h-[5px] w-[5px] shrink-0 rounded-[1px] border border-foreground-muted" />}
            {item.type === "ACTIVE" && <span className="h-[2px] w-[8px] shrink-0 rounded-full" style={{ background: "var(--grey)" }} />}
            <span className="truncate text-foreground-muted">{item.label}</span>
          </div>
        ))}
        {overflow > 0 && <div className="text-[10px] text-foreground-muted font-mono-tag mt-0.5">+{overflow} more</div>}
      </div>
    </button>
  );
}

export function MonthGrid({
  year,
  month,
  days,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  days: DayCellSummary[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = firstOfMonth.getUTCDay(); // 0=Sun
  const todayIso = new Date().toISOString().slice(0, 10);

  const cellByDate = new Map(days.map((d) => [d.date, d]));

  // Group days into weeks so we can show a week-code gutter per row.
  const rows: { weekCode: string | null; dayNums: (number | null)[] }[] = [];
  let cursor = 1 - firstWeekday;
  while (cursor <= days.length) {
    const dayNums: (number | null)[] = [];
    let weekCode: string | null = null;
    for (let i = 0; i < 7; i++) {
      const dn = cursor + i;
      if (dn >= 1 && dn <= days.length) {
        dayNums.push(dn);
        if (!weekCode) weekCode = days[dn - 1].weekCode;
      } else {
        dayNums.push(null);
      }
    }
    rows.push({ weekCode, dayNums });
    cursor += 7;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-1 px-1">
        <div />
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <div key={d} className="font-mono-tag text-[10px] text-foreground-muted text-center">
            {d}
          </div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-[40px_repeat(7,1fr)] gap-1">
          {row.weekCode ? (
            <Link
              href={`/week/${row.weekCode}`}
              className="flex items-center justify-center font-mono-tag text-[10px] text-foreground-muted hover:text-foreground rounded-lg hover:bg-glass-surface"
            >
              {row.weekCode}
            </Link>
          ) : (
            <div />
          )}
          {row.dayNums.map((dn, ci) =>
            dn == null ? (
              <div key={ci} />
            ) : (
              <DayCell
                key={ci}
                dayNum={dn}
                cell={cellByDate.get(`${year}-${String(month).padStart(2, "0")}-${String(dn).padStart(2, "0")}`)}
                isToday={`${year}-${String(month).padStart(2, "0")}-${String(dn).padStart(2, "0")}` === todayIso}
                isSelected={`${year}-${String(month).padStart(2, "0")}-${String(dn).padStart(2, "0")}` === selectedDate}
                onSelect={() => onSelectDate(`${year}-${String(month).padStart(2, "0")}-${String(dn).padStart(2, "0")}`)}
              />
            )
          )}
        </div>
      ))}
    </div>
  );
}
