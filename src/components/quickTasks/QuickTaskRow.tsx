"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Trash2 } from "lucide-react";
import type { QuickTaskView } from "@/lib/db/types";

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "var(--red)",
  MEDIUM: "var(--amber)",
  LOW: "var(--grey)",
};

export function QuickTaskRow({
  task,
  brands,
  activations,
  onChange,
  onDelete,
}: {
  task: QuickTaskView;
  brands: { id: string; name: string }[];
  activations: { id: string; name: string }[];
  onChange: (id: string, patch: Partial<QuickTaskView>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    due_date: task.due_date ?? "",
    priority: task.priority ?? "",
    pic: task.pic ?? "",
    related_person: task.related_person ?? "",
    brand_id: task.brand_id ?? "",
    activation_id: task.activation_id ?? "",
    note: task.note ?? "",
  });

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/quick-tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function toggleDone() {
    const next = task.status === "DONE" ? "OPEN" : "DONE";
    onChange(task.id, { status: next });
    patch({ status: next });
  }

  async function saveForm() {
    const patchBody = {
      due_date: form.due_date || null,
      priority: form.priority || null,
      pic: form.pic || null,
      related_person: form.related_person || null,
      brand_id: form.brand_id || null,
      activation_id: form.activation_id || null,
      note: form.note || null,
    };
    onChange(task.id, patchBody as Partial<QuickTaskView>);
    await patch(patchBody);
    setExpanded(false);
  }

  async function convert() {
    if (!form.brand_id && !form.activation_id) {
      alert("Set a Related Brand or Related Activation before converting.");
      return;
    }
    const activationName = activations.find((a) => a.id === form.activation_id)?.name;
    const convertedNote = activationName ? `Linked to ${activationName}` : "Linked to brand";
    const patchBody = {
      brand_id: form.brand_id || null,
      activation_id: form.activation_id || null,
      status: "CONVERTED" as const,
      converted_note: convertedNote,
    };
    onChange(task.id, patchBody as Partial<QuickTaskView>);
    await patch(patchBody);
    setExpanded(false);
  }

  async function remove() {
    onDelete(task.id);
    await fetch(`/api/quick-tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
  }

  const isDone = task.status === "DONE" || task.status === "CONVERTED";

  return (
    <div className="border-b border-glass-border/60 last:border-b-0">
      <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-glass-surface transition-colors">
        <button
          onClick={toggleDone}
          disabled={task.status === "CONVERTED"}
          className="h-[15px] w-[15px] shrink-0 rounded border border-glass-border hover:border-foreground-muted transition-colors disabled:opacity-40 flex items-center justify-center"
          aria-label="Toggle done"
        >
          {isDone && <span className="h-[7px] w-[7px] rounded-sm bg-foreground-muted" />}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
          <div className={`text-[13px] truncate ${isDone ? "line-through text-foreground-muted" : ""}`}>{task.task}</div>
          <div className="flex items-center gap-2 font-mono-tag text-[10.5px] text-foreground-muted mt-0.5">
            {task.priority && <span style={{ color: PRIORITY_COLOR[task.priority] }}>{task.priority}</span>}
            {task.brand_name && <span>{task.brand_name}</span>}
            {task.activation_name && <span>· {task.activation_name}</span>}
            {task.related_person && <span>· {task.related_person}</span>}
            {task.due_date && <span>· due {task.due_date}</span>}
            {task.status === "CONVERTED" && <span style={{ color: "var(--green)" }}>CONVERTED{task.converted_note ? ` — ${task.converted_note}` : ""}</span>}
          </div>
        </div>

        <button onClick={() => setExpanded((e) => !e)} className="p-1 text-foreground-muted hover:text-foreground shrink-0">
          <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <button onClick={remove} className="p-1 text-foreground-muted hover:text-red-400 shrink-0" aria-label="Delete">
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3.5 grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-glass-surface/40">
          <label className="flex flex-col gap-1 text-[11px] text-foreground-muted">
            Due Date
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="glass rounded-md px-2 py-1 text-[12px] bg-transparent [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-foreground-muted">
            Priority
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="glass rounded-md px-2 py-1 text-[12px] bg-transparent"
            >
              <option value="">—</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-foreground-muted">
            PIC
            <input
              value={form.pic}
              onChange={(e) => setForm({ ...form, pic: e.target.value })}
              className="glass rounded-md px-2 py-1 text-[12px] bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-foreground-muted">
            Related Person
            <input
              value={form.related_person}
              onChange={(e) => setForm({ ...form, related_person: e.target.value })}
              className="glass rounded-md px-2 py-1 text-[12px] bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-foreground-muted">
            Related Brand
            <select
              value={form.brand_id}
              onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
              className="glass rounded-md px-2 py-1 text-[12px] bg-transparent"
            >
              <option value="">None</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-foreground-muted">
            Related Activation
            <select
              value={form.activation_id}
              onChange={(e) => setForm({ ...form, activation_id: e.target.value })}
              className="glass rounded-md px-2 py-1 text-[12px] bg-transparent"
            >
              <option value="">None</option>
              {activations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-foreground-muted col-span-2 sm:col-span-3">
            Note
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              className="glass rounded-md px-2 py-1 text-[12px] bg-transparent resize-none"
            />
          </label>

          <div className="col-span-2 sm:col-span-3 flex items-center gap-2 mt-1">
            <button onClick={saveForm} className="font-mono-tag text-[11px] rounded-md px-3 py-1.5 bg-glass-surface-strong hover:bg-glass-surface transition-colors">
              SAVE
            </button>
            <button onClick={convert} className="font-mono-tag text-[11px] rounded-md px-3 py-1.5 glass hover:bg-glass-surface-strong transition-colors">
              CONVERT TO CONTROL TASK
            </button>
            {task.activation_id && (
              <Link href={`/campaigns/${encodeURIComponent(task.activation_id)}`} className="font-mono-tag text-[11px] text-foreground-muted hover:underline ml-auto">
                View Activation →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
