"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { QuickTaskRow } from "./QuickTaskRow";
import type { QuickTaskView } from "@/lib/db/types";

function GroupSection({
  title,
  tasks,
  brands,
  activations,
  onChange,
  onDelete,
  defaultOpen = true,
}: {
  title: string;
  tasks: QuickTaskView[];
  brands: { id: string; name: string }[];
  activations: { id: string; name: string }[];
  onChange: (id: string, patch: Partial<QuickTaskView>) => void;
  onDelete: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (tasks.length === 0) return null;
  return (
    <section className="glass rounded-2xl overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 border-b border-glass-border">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <span className="font-mono-tag text-[11px] text-foreground-muted">{tasks.length}</span>
      </button>
      {open && (
        <div>
          {tasks.map((t) => (
            <QuickTaskRow key={t.id} task={t} brands={brands} activations={activations} onChange={onChange} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}

export function QuickTasksBoard({
  initialTasks,
  brands,
  activations,
}: {
  initialTasks: QuickTaskView[];
  brands: { id: string; name: string }[];
  activations: { id: string; name: string }[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  function onChange(id: string, patch: Partial<QuickTaskView>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function onDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function submitAdd() {
    const task = value.trim();
    if (!task) return;
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
  }

  const today = new Date().toISOString().slice(0, 10);

  const groups = useMemo(() => {
    const active = tasks.filter((t) => t.status === "OPEN" || t.status === "WAITING");
    const done = tasks.filter((t) => t.status === "DONE" || t.status === "CONVERTED");
    return {
      overdue: active.filter((t) => t.due_date && t.due_date < today),
      today: active.filter((t) => t.due_date === today),
      upcoming: active.filter((t) => t.due_date && t.due_date > today),
      inbox: active.filter((t) => !t.due_date && !t.brand_id && !t.activation_id),
      other: active.filter((t) => !t.due_date && (t.brand_id || t.activation_id)),
      done,
    };
  }, [tasks, today]);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2">
        {adding ? (
          <>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  submitAdd();
                  setAdding(false);
                }
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Check Dongwon email…"
              className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-foreground-muted"
            />
            <button
              onClick={() => {
                submitAdd();
                setAdding(false);
              }}
              className="font-mono-tag text-[11px] rounded-md px-2.5 py-1 bg-glass-surface-strong hover:bg-glass-surface transition-colors"
            >
              SAVE
            </button>
          </>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-[13px] text-foreground-muted hover:text-foreground transition-colors">
            <Plus size={15} strokeWidth={2} /> Add a quick task…
          </button>
        )}
      </div>

      <GroupSection title="Overdue" tasks={groups.overdue} brands={brands} activations={activations} onChange={onChange} onDelete={onDelete} />
      <GroupSection title="Today" tasks={groups.today} brands={brands} activations={activations} onChange={onChange} onDelete={onDelete} />
      <GroupSection title="Upcoming" tasks={groups.upcoming} brands={brands} activations={activations} onChange={onChange} onDelete={onDelete} />
      <GroupSection title="Linked (no due date)" tasks={groups.other} brands={brands} activations={activations} onChange={onChange} onDelete={onDelete} />
      <GroupSection title="Inbox" tasks={groups.inbox} brands={brands} activations={activations} onChange={onChange} onDelete={onDelete} />
      <GroupSection title="Done" tasks={groups.done} brands={brands} activations={activations} onChange={onChange} onDelete={onDelete} defaultOpen={false} />

      {tasks.length === 0 && (
        <div className="glass rounded-2xl px-4 py-8 text-center text-[12.5px] text-foreground-muted">No quick tasks yet — add one above.</div>
      )}
    </div>
  );
}
