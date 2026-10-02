"use client";

import { useState } from "react";
import Link from "next/link";
import type { DigitalDayItem, DigitalMonthData } from "@/lib/queries/digital";

const STATUS_COLOR: Record<string, string> = {
  Live: "var(--green)",
  Posted: "var(--green)",
  Scheduled: "var(--blue-grey)",
  Draft: "var(--grey)",
  Test: "var(--amber)",
};

function statusColor(status: string | null): string {
  if (!status) return "var(--grey)";
  for (const [k, v] of Object.entries(STATUS_COLOR)) {
    if (status.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "var(--blue-grey)";
}

function tagFor(item: DigitalDayItem): string {
  if (item.platform) {
    const p = item.platform.toLowerCase();
    if (p.includes("facebook")) return "FB";
    if (p.includes("insta") || p.includes("tiktok")) return item.platform.slice(0, 2).toUpperCase();
    if (p.includes("youtube")) return "YT";
  }
  const map: Record<string, string> = { Social: "SOC", Website: "WEB", Email: "EML", Video: "VID" };
  return map[item.subtype] ?? item.subtype.slice(0, 3).toUpperCase();
}

export function DigitalMonthCalendar({ data, todayIso }: { data: DigitalMonthData; todayIso: string }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(
    Object.keys(data.days).includes(todayIso) ? todayIso : null
  );

  const firstOfMonth = new Date(Date.UTC(data.year, data.month - 1, 1));
  const firstWeekday = firstOfMonth.getUTCDay();
  const lastDay = new Date(Date.UTC(data.year, data.month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");

  const cells: (number | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: lastDay }, (_, i) => i + 1)];

  const selectedItems = selectedDate ? data.days[selectedDate] ?? [] : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 items-start">
      <div className="glass rounded-2xl px-3 py-3">
        <div className="grid grid-cols-7 gap-1 px-1 mb-1">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
            <div key={d} className="font-mono-tag text-[10px] text-foreground-muted text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((dayNum, i) => {
            if (dayNum == null) return <div key={i} />;
            const date = `${data.year}-${pad(data.month)}-${pad(dayNum)}`;
            const items = data.days[date] ?? [];
            const preview = items.slice(0, 3);
            const overflow = items.length - preview.length;
            const isToday = date === todayIso;
            const isSelected = date === selectedDate;
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-stretch text-left rounded-xl p-1.5 min-h-[78px] border transition-colors ${
                  isSelected ? "bg-glass-surface-strong border-glass-border" : "border-transparent hover:bg-glass-surface"
                }`}
              >
                <span
                  className={`font-mono-tag text-[11px] self-start ${isToday ? "rounded-full px-1.5 font-semibold" : "text-foreground-muted"}`}
                  style={isToday ? { background: "var(--green-bg)", color: "var(--green)" } : undefined}
                >
                  {dayNum}
                </span>
                <div className="flex flex-col gap-0.5 mt-1">
                  {preview.map((item) => (
                    <div key={item.id} className="flex items-center gap-1 text-[9.5px] leading-tight truncate">
                      <span className="font-mono-tag shrink-0" style={{ color: statusColor(item.status) }}>
                        {tagFor(item)}
                      </span>
                      <span className="truncate text-foreground-muted">{item.title}</span>
                    </div>
                  ))}
                  {overflow > 0 && <div className="text-[9px] text-foreground-muted font-mono-tag">+{overflow} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border">
          <div className="text-[13px] font-semibold">{selectedDate ?? "Select a date"}</div>
          <div className="font-mono-tag text-[11px] text-foreground-muted">{selectedItems.length} items</div>
        </div>
        <div className="divide-y divide-glass-border/60 max-h-[420px] overflow-y-auto">
          {selectedItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-foreground-muted">Nothing planned</div>
          ) : (
            selectedItems.map((item) => (
              <Link key={item.id} href={`/digital/${encodeURIComponent(item.id)}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-glass-surface transition-colors">
                <span className="font-mono-tag text-[10px] uppercase rounded px-1.5 py-0.5 shrink-0" style={{ background: "var(--glass-surface)", color: statusColor(item.status) }}>
                  {tagFor(item)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] truncate">
                    {item.brand_name && <span className="font-medium">{item.brand_name} · </span>}
                    {item.title}
                  </div>
                  <div className="font-mono-tag text-[10.5px] text-foreground-muted">{item.channel_scope}{item.status ? ` · ${item.status}` : ""}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
