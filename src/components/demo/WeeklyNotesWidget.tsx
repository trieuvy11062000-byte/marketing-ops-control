"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { DemoWeeklyNote } from "@/lib/db/types";

const CATEGORY_OPTIONS = [
  "Delivery Problem", "Product OOS", "Demo Changed", "Promotion Changed", "FOC Allocation Issue",
  "Shopper Feedback", "SKU Changed", "Store Issue", "Missing Stock", "Owner Feedback", "Other",
];

export function WeeklyNotesWidget({ weekCode, initialNotes }: { weekCode: string; initialNotes: DemoWeeklyNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const note = text.trim();
    if (!note) { setAdding(false); return; }
    setSaving(true);
    const res = await fetch("/api/demo-weekly-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekCode, note, category: category || null }),
    });
    const data = await res.json();
    setNotes((prev) => [{ id: data.id, week_code: weekCode, note, category: category || null, created_by: null, created_at: new Date().toISOString() }, ...prev]);
    setText("");
    setCategory("");
    setAdding(false);
    setSaving(false);
  }

  async function remove(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/demo-weekly-notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
        <div>
          <h2 className="text-[13.5px] font-semibold">Weekly Notes</h2>
          <div className="text-[11px] text-foreground-muted mt-0.5">Operational context — never overwrites the report&apos;s own findings above.</div>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 font-mono-tag text-[11px] rounded-lg px-2.5 py-1.5 bg-glass-surface hover:bg-glass-surface-strong">
          <Plus size={13} /> ADD
        </button>
      </div>

      {adding && (
        <div className="px-4 py-3 border-b border-glass-border flex flex-col gap-2">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Delivery problem at Thurrock delayed FOC stock until Saturday afternoon"
            className="bg-glass-surface rounded-lg px-3 py-2 text-[12.5px] outline-none border border-transparent focus:border-glass-border resize-none"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-glass-surface rounded-lg px-2 py-1.5 text-[11.5px] outline-none border border-transparent focus:border-glass-border"
            >
              <option value="">No category</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={submit} disabled={saving} className="font-mono-tag text-[11px] rounded-lg px-3 py-1.5 bg-glass-surface-strong hover:bg-glass-surface border border-glass-border disabled:opacity-50">
              SAVE
            </button>
            <button onClick={() => { setAdding(false); setText(""); }} className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-glass-border/60">
        {notes.length === 0 ? (
          <div className="px-4 py-5 text-center text-[12px] text-foreground-muted">No weekly notes yet</div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="px-4 py-2.5 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {n.category && (
                  <span className="font-mono-tag text-[10px] uppercase rounded-md px-1.5 py-0.5 mr-1.5" style={{ background: "var(--blue-grey-bg)", color: "var(--blue-grey)" }}>
                    {n.category}
                  </span>
                )}
                <span className="text-[12.5px]">{n.note}</span>
                <div className="font-mono-tag text-[10px] text-foreground-muted mt-0.5">{new Date(n.created_at).toLocaleString("en-GB")}</div>
              </div>
              <button onClick={() => remove(n.id)} className="text-foreground-muted hover:text-foreground shrink-0">
                <X size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
