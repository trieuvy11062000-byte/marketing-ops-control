"use client";

import { useState } from "react";
import type { LeaderAuditState } from "@/lib/db/types";
import type { AuditField } from "@/lib/queries/designBriefs";

const AUDIT_ITEMS: { field: AuditField; label: string }[] = [
  { field: "brief_complete", label: "Brief Complete" },
  { field: "sku_complete", label: "SKU / Product Complete" },
  { field: "promotion_verified", label: "Promotion Verified" },
  { field: "timeline_verified", label: "Timeline Verified" },
  { field: "content_verified", label: "Content Verified" },
  { field: "branding_verified", label: "Branding / Logo Verified" },
  { field: "design_output_received", label: "Design Output Received" },
  { field: "final_output_audited", label: "Final Output Audited" },
  { field: "ready_to_publish", label: "Ready to Publish / Print" },
];

const STATE_COLOR: Record<LeaderAuditState, { bg: string; fg: string }> = {
  "TO CHECK": { bg: "var(--grey-bg)", fg: "var(--grey)" },
  DONE: { bg: "var(--green-bg)", fg: "var(--green)" },
  ISSUE: { bg: "var(--red-bg)", fg: "var(--red)" },
};

const NEXT_STATE: Record<LeaderAuditState, LeaderAuditState> = {
  "TO CHECK": "DONE",
  DONE: "ISSUE",
  ISSUE: "TO CHECK",
};

export function DesignAssetAuditPanel({
  assetId,
  initial,
  evidenceLink,
}: {
  assetId: string;
  initial: Record<AuditField, LeaderAuditState>;
  evidenceLink: string | null;
}) {
  const [state, setState] = useState(initial);
  const [evidence, setEvidence] = useState(evidenceLink ?? "");
  const [savingEvidence, setSavingEvidence] = useState(false);

  async function cycle(field: AuditField) {
    const next = NEXT_STATE[state[field]];
    setState((prev) => ({ ...prev, [field]: next }));
    await fetch(`/api/design-assets/${encodeURIComponent(assetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value: next }),
    });
  }

  async function saveEvidence() {
    setSavingEvidence(true);
    await fetch(`/api/design-assets/${encodeURIComponent(assetId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidenceLink: evidence }),
    });
    setSavingEvidence(false);
  }

  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-glass-border">
        <h2 className="text-[13.5px] font-semibold">Leader Audit Checklist</h2>
        <div className="text-[11px] text-foreground-muted mt-0.5">Control checkpoints — click a state to cycle TO CHECK → DONE → ISSUE. Never pre-filled.</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3">
        {AUDIT_ITEMS.map((item) => {
          const s = state[item.field];
          const c = STATE_COLOR[s];
          return (
            <button
              key={item.field}
              onClick={() => cycle(item.field)}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-glass-surface hover:bg-glass-surface-strong transition-colors text-left"
            >
              <span className="text-[12px]">{item.label}</span>
              <span className="font-mono-tag text-[10px] uppercase rounded-md px-1.5 py-0.5 shrink-0" style={{ background: c.bg, color: c.fg }}>
                {s}
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-glass-border flex items-center gap-2">
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Evidence / final artwork link"
          className="flex-1 bg-glass-surface rounded-lg px-3 py-1.5 text-[12px] outline-none border border-transparent focus:border-glass-border"
        />
        <button
          onClick={saveEvidence}
          disabled={savingEvidence}
          className="font-mono-tag text-[11px] rounded-lg px-3 py-1.5 bg-glass-surface-strong hover:bg-glass-surface border border-glass-border disabled:opacity-50"
        >
          SAVE
        </button>
      </div>
    </section>
  );
}
