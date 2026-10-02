"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MonthGrid } from "./MonthGrid";
import { DayControlPanel } from "./DayControlPanel";
import type { CalendarWorkstream, DayDetail, MonthCalendarData } from "@/lib/queries/calendar";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FILTERS: ("ALL" | CalendarWorkstream)[] = ["ALL", "Retail/In-store", "Digital", "Promotion", "A&P", "Project/Management"];

function filterDetail(detail: DayDetail, filter: string): DayDetail {
  if (filter === "ALL") return detail;
  return {
    ...detail,
    myControl: detail.myControl.filter((i) => i.workstream === filter),
    todaysExecution: detail.todaysExecution.filter((i) => i.workstream === filter),
    activeToday: detail.activeToday.filter((i) => i.workstream === filter),
  };
}

export function CalendarSection({
  data,
  todayIso,
  currentWeekCode,
  initialDate,
  basePath = "/",
  initialFilter = "ALL",
  extraParams = "",
}: {
  data: MonthCalendarData;
  todayIso: string;
  currentWeekCode: string;
  initialDate?: string;
  basePath?: string;
  initialFilter?: "ALL" | CalendarWorkstream;
  extraParams?: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate && data.days.some((d) => d.date === initialDate)) return initialDate;
    const inThisMonth = data.days.some((d) => d.date === todayIso);
    return inThisMonth ? todayIso : data.days[0]?.date ?? todayIso;
  });
  const [filter, setFilter] = useState<"ALL" | CalendarWorkstream>(initialFilter);

  const detail = data.details[selectedDate];
  const filteredDetail = useMemo(() => (detail ? filterDetail(detail, filter) : undefined), [detail, filter]);

  function goToMonth(year: number, month: number) {
    router.push(`${basePath}?year=${year}&month=${month}${extraParams}`);
  }

  function prevMonth() {
    const m = data.month === 1 ? 12 : data.month - 1;
    const y = data.month === 1 ? data.year - 1 : data.year;
    goToMonth(y, m);
  }
  function nextMonth() {
    const m = data.month === 12 ? 1 : data.month + 1;
    const y = data.month === 12 ? data.year + 1 : data.year;
    goToMonth(y, m);
  }
  function goToday() {
    const [y, m] = todayIso.split("-").map(Number);
    goToMonth(y, m);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="glass rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-glass-surface-strong text-foreground-muted">
            <ChevronLeft size={16} />
          </button>
          <span className="text-[15px] font-semibold min-w-[150px] text-center">
            {MONTH_NAMES[data.month - 1]} {data.year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-glass-surface-strong text-foreground-muted">
            <ChevronRight size={16} />
          </button>
        </div>

        <button onClick={goToday} className="font-mono-tag text-[11px] rounded-lg px-2.5 py-1.5 glass hover:bg-glass-surface-strong transition-colors">
          TODAY
        </button>
        <Link href={`/week/${currentWeekCode}`} className="font-mono-tag text-[11px] rounded-lg px-2.5 py-1.5 glass hover:bg-glass-surface-strong transition-colors">
          THIS WEEK →
        </Link>

        <input
          type="date"
          className="font-mono-tag text-[11px] rounded-lg px-2 py-1.5 glass bg-transparent [color-scheme:dark]"
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m] = e.target.value.split("-").map(Number);
            if (y === data.year && m === data.month) {
              setSelectedDate(e.target.value);
            } else {
              goToMonth(y, m);
            }
          }}
        />

        <div className="flex items-center gap-1.5 ml-auto overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 font-mono-tag text-[10.5px] uppercase tracking-wide rounded-full px-2.5 py-1 transition-colors ${
                filter === f ? "bg-glass-surface-strong border border-glass-border text-foreground" : "text-foreground-muted hover:bg-glass-surface"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-3 items-start">
        <div className="glass rounded-2xl px-3 py-3">
          <MonthGrid year={data.year} month={data.month} days={data.days} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </div>
        {filteredDetail && <DayControlPanel key={selectedDate} detail={filteredDetail} />}
      </div>
    </section>
  );
}
