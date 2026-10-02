"use client";

import { useState } from "react";
import Link from "next/link";
import { RiskDot, StatusBadge } from "@/components/ui/badges";
import type { DayDetail, QuickTaskCalendarItem } from "@/lib/queries/calendar";

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-1.5">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide">{title}</h3>
      <span className="font-mono-tag text-[10.5px] text-foreground-muted">{count}</span>
    </div>
  );
}

export function DayControlPanel({ detail }: { detail: DayDetail }) {
  const d = new Date(detail.date + "T00:00:00Z");
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }).toUpperCase();
  const dateLabel = d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();

  const atRiskCount = detail.upcomingImpact.filter((i) => i.risk === "RED" || i.risk === "AMBER").length;

  // `key={selectedDate}` on the parent forces a remount on date change, so this
  // local state always starts fresh per day — no effect-based resync needed.
  const [quickTasks, setQuickTasks] = useState<QuickTaskCalendarItem[]>(detail.quickTasks);

  async function markQuickTaskDone(id: string) {
    setQuickTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/quick-tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
  }

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 py-4 border-b border-glass-border">
        <div className="font-mono-tag text-[12px] text-foreground-muted">{weekday}</div>
        <div className="text-[18px] font-bold">{dateLabel}</div>
        {detail.weekCode && (
          <Link href={`/week/${detail.weekCode}`} className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground hover:underline">
            {detail.weekCode} →
          </Link>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 font-mono-tag text-[11px]">
          <span>
            <b className="text-foreground">{detail.myControl.length}</b> NEED MY CONTROL
          </span>
          <span>
            <b className="text-foreground">{detail.activeToday.length}</b> RUNNING ACTIVITIES
          </span>
          <span>
            <b className="text-foreground">{detail.todaysExecution.length}</b> EXECUTIONS TODAY
          </span>
          {atRiskCount > 0 && (
            <span style={{ color: "var(--amber)" }}>
              <b>{atRiskCount}</b> AT RISK
            </span>
          )}
        </div>

        <div className="text-[12px] text-foreground-muted mt-3 leading-relaxed">{detail.summary}</div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 max-h-[520px] overflow-y-auto">
        <div>
          <SectionHeader title="My Control" count={detail.myControl.length} />
          {detail.myControl.length === 0 ? (
            <div className="text-[11.5px] text-foreground-muted px-1">Nothing needs your review on this date.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {detail.myControl.map((c) => (
                <Link key={c.id} href={c.href} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-glass-surface transition-colors">
                  <RiskDot level={c.risk_level} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[11.5px]">
                      {c.brand_name && <span className="font-medium">{c.brand_name}</span>}
                      {c.campaign_name && <span className="text-foreground-muted truncate">· {c.campaign_name}</span>}
                    </div>
                    <div className="text-[12px]">{c.title}</div>
                    <div className="font-mono-tag text-[10.5px] text-foreground-muted">
                      {c.pic_role ?? "—"}
                      {c.risk_reason && ` · ${c.risk_reason}`}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader title="Today's Execution" count={detail.todaysExecution.length} />
          {detail.todaysExecution.length === 0 ? (
            <div className="text-[11.5px] text-foreground-muted px-1">Nothing being executed on this date.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {detail.todaysExecution.map((e) => (
                <Link key={e.id} href={e.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-glass-surface transition-colors">
                  <span className="font-mono-tag text-[10px] uppercase rounded px-1.5 py-0.5 bg-glass-surface text-foreground-muted shrink-0">{e.kind}</span>
                  <div className="min-w-0 flex-1 text-[12px]">
                    {e.brand_name && <span className="font-medium">{e.brand_name}</span>} {e.location}
                    {e.session_label && <span className="text-foreground-muted"> · {e.session_label}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {quickTasks.length > 0 && (
          <div>
            <SectionHeader title="Quick Tasks" count={quickTasks.length} />
            <div className="flex flex-col gap-1">
              {quickTasks.map((q) => (
                <div key={q.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-glass-surface transition-colors">
                  <button
                    onClick={() => markQuickTaskDone(q.id)}
                    className="h-[13px] w-[13px] shrink-0 rounded border border-glass-border hover:border-foreground-muted transition-colors"
                    aria-label="Mark done"
                  />
                  <span className="text-[12px] flex-1 min-w-0 truncate">{q.task}</span>
                </div>
              ))}
            </div>
            <Link href="/quick-tasks" className="font-mono-tag text-[10.5px] text-foreground-muted hover:underline mt-1 inline-block px-2">
              View all →
            </Link>
          </div>
        )}

        <div>
          <SectionHeader title="Active Today" count={detail.activeToday.length} />
          {detail.activeToday.length === 0 ? (
            <div className="text-[11.5px] text-foreground-muted px-1">Nothing active on this date.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {detail.activeToday.map((a) => (
                <Link key={a.id} href={a.href} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-glass-surface transition-colors">
                  <div className="min-w-0 text-[12px]">
                    {a.brand_name && <span className="font-medium">{a.brand_name}</span>} <span className="text-foreground-muted">{a.name}</span>
                    {a.detail && <span className="text-foreground-muted"> — {a.detail}</span>}
                  </div>
                  <span className="font-mono-tag text-[10px] text-foreground-muted shrink-0">{a.kind}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {detail.upcomingImpact.length > 0 && (
          <div>
            <SectionHeader title="Upcoming Impact" count={detail.upcomingImpact.length} />
            <div className="flex flex-col gap-1">
              {detail.upcomingImpact.map((i) => (
                <Link
                  key={i.id}
                  href={i.href}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-glass-surface transition-colors"
                  style={{ background: i.risk === "RED" ? "var(--red-bg)" : "var(--amber-bg)" }}
                >
                  <RiskDot level={i.risk} />
                  <div className="min-w-0">
                    <div className="text-[12px]">{i.title}</div>
                    <div className="text-[11px] text-foreground-muted">{i.detail}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {detail.updates.length > 0 && (
          <div>
            <SectionHeader title="Updates" count={detail.updates.length} />
            <div className="flex flex-col gap-1">
              {detail.updates.map((u) => (
                <Link key={u.id} href={u.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-glass-surface transition-colors">
                  <span className="h-[5px] w-[5px] rounded-full shrink-0 bg-foreground-muted" />
                  <div className="text-[12px] text-foreground-muted">{u.shortLabel}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
