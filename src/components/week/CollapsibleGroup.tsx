"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function CollapsibleGroup({
  title,
  count,
  alertCount,
  alertLabel = "OVERDUE",
  children,
}: {
  title: string;
  count: number;
  alertCount?: number;
  alertLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-glass-border sticky top-0 bg-surface/90 backdrop-blur z-10"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <span className="font-mono-tag text-[11px] text-foreground-muted">{count}</span>
          {!!alertCount && (
            <span className="font-mono-tag text-[10.5px] rounded px-1.5 py-0.5" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
              {alertCount} {alertLabel}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`text-foreground-muted transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}
