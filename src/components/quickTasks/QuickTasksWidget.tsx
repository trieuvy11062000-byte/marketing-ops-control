"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { QuickTaskView } from "@/lib/db/types";

function formatDueLabel(due: string | null): string | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (due === today) return "Today";
  if (due === tomorrow) return "Tomorrow";
  const d = new Date(due + "T00:00:00Z");
  const diffDays = Math.round((d.getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000);
  if (diffDays < 0) return "Overdue";
  if (diffDays < 7) return d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function QuickTasksWidget({ initialTasks }: { initialTasks: QuickTaskView[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function markDone(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/quick-tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
  }

  async function submitAdd() {
    const task = value.trim();
    if (!task) {
      setAdding(false);
      return;
    }
    setSaving(true);
    const res = await fetch("/api/quick-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const data = await res.json();
    setTasks((prev) => [
      {
        id: data.id,
        task,
        created_date: new Date().toISOString().slice(0, 10),
        due_date: null,
        status: "OPEN",
        priority: null,
        pic: null,
        related_person: null,
        brand_id: null,
        activation_id: null,
        related_record: null,
        note: null,
        source: "MANUAL",
        week_code: null,
        converted_note: null,
        last_updated: new Date().toISOString(),
        brand_name: null,
        activation_name: null,
      },
      ...prev,
    ]);
    setValue("");
    setAdding(false);
    setSaving(false);
  }

  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
        <h2 className="text-[14px] font-semibold">Quick Tasks</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-1 text-[11.5px] font-mono-tag text-foreground-muted hover:text-foreground transition-colors"
          >
            <Plus size={13} strokeWidth={2} /> ADD
          </button>
          <Link href="/quick-tasks" className="text-[11.5px] text-foreground-muted hover:text-foreground font-mono-tag">
            VIEW ALL →
          </Link>
        </div>
      </div>

      {adding && (
        <div className="px-4 py-2.5 border-b border-glass-border/60 flex items-center gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Check Dongwon email…"
            className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-foreground-muted"
          />
          <button
            onClick={submitAdd}
            disabled={saving}
            className="font-mono-tag text-[11px] rounded-md px-2.5 py-1 bg-glass-surface-strong hover:bg-glass-surface transition-colors disabled:opacity-50"
          >
            SAVE
          </button>
        </div>
      )}

      <div>
        {tasks.length === 0 ? (
          <div className="px-4 py-5 text-center text-[12.5px] text-foreground-muted">Nothing here — all clear</div>
        ) : (
          tasks.slice(0, 7).map((t) => {
            const dueLabel = formatDueLabel(t.due_date);
            return (
              <div
                key={t.id}
                className="flex items-center gap-2.5 px-4 py-2 border-b border-glass-border/60 last:border-b-0 hover:bg-glass-surface transition-colors"
              >
                <button
                  onClick={() => markDone(t.id)}
                  className="h-[15px] w-[15px] shrink-0 rounded border border-glass-border hover:border-foreground-muted transition-colors"
                  aria-label="Mark done"
                />
                <span className="text-[13px] flex-1 min-w-0 truncate">{t.task}</span>
                {t.related_person && <span className="font-mono-tag text-[10.5px] text-foreground-muted shrink-0">· {t.related_person}</span>}
                {dueLabel && (
                  <span
                    className="font-mono-tag text-[10.5px] shrink-0"
                    style={{ color: dueLabel === "Overdue" ? "var(--red)" : dueLabel === "Today" ? "var(--amber)" : "var(--foreground-muted)" }}
                  >
                    {dueLabel}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
