import Link from "next/link";
import { RiskDot, StatusBadge } from "./badges";
import type { ControlTaskView } from "@/lib/db/types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase();
}

export function TaskRow({ task }: { task: ControlTaskView }) {
  const href = task.campaign_id ? `/campaigns/${encodeURIComponent(task.campaign_id)}` : "/in-store";
  return (
    <Link
      href={href}
      className="grid grid-cols-[14px_1fr_auto_auto_auto] items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-glass-surface transition-colors border-b border-glass-border/60 last:border-b-0"
    >
      <RiskDot level={task.risk_level} />

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px]">
          {task.brand_name && <span className="font-medium text-foreground">{task.brand_name}</span>}
          {task.brand_name && task.campaign_name && <span className="text-foreground-muted">·</span>}
          {task.campaign_name && <span className="text-foreground-muted truncate">{task.campaign_name}</span>}
        </div>
        <div className="text-[12.5px] text-foreground mt-0.5">{task.title}</div>
        {task.risk_reason && (
          <div className="text-[11px] mt-0.5" style={{ color: "var(--amber)" }}>
            {task.risk_reason}
          </div>
        )}
      </div>

      <div className="font-mono-tag text-[11px] text-foreground-muted whitespace-nowrap hidden sm:block">
        {task.deliverable_pic_role ?? "—"}
      </div>

      <div className="font-mono-tag text-[11.5px] text-foreground-muted whitespace-nowrap">
        {formatDate(task.control_date)}
      </div>

      <StatusBadge status={task.status} />
    </Link>
  );
}

export function EmptyRow({ label }: { label: string }) {
  return <div className="px-3 py-6 text-center text-[12.5px] text-foreground-muted">{label}</div>;
}
