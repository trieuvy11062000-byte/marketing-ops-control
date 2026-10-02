import Link from "next/link";
import { notFound } from "next/navigation";
import { getDigitalActivity, getLinkedSupplySignal } from "@/lib/queries/digital";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="text-[13.5px] mt-0.5 whitespace-pre-wrap">{value ?? "—"}</div>
    </div>
  );
}

export default async function DigitalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = getDigitalActivity(decodeURIComponent(id));
  if (!activity) notFound();

  const supplySignal = getLinkedSupplySignal(activity.supply_signal_id) as
    | { id: string; supplier: string | null; eta: string | null; container_no: string | null }
    | undefined;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 flex flex-col gap-6">
      <div>
        <div className="font-mono-tag text-[11.5px] text-foreground-muted">
          {activity.subtype} Detail · {activity.channel_scope}
        </div>
        <h1 className="text-[22px] font-bold tracking-tight">{activity.title}</h1>
        {activity.brand_name && <div className="text-[12.5px] text-foreground-muted mt-1">{activity.brand_name}</div>}
      </div>

      <section className="glass rounded-2xl px-5 py-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
        <Field label="Platform" value={activity.platform} />
        <Field label="Planned Date" value={activity.planned_date} />
        <Field label="Post Date" value={activity.post_date} />
        <Field label="Status" value={activity.status} />
        <Field label="Approval" value={activity.approval_status} />
        <Field label="Evidence" value={activity.evidence_status} />
        <Field label="Driver" value={activity.driver} />
        <Field label="Week" value={activity.week_code} />
        <Field label="PIC" value={activity.pic_role} />
      </section>

      {activity.campaign_id && (
        <section className="glass rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted">Supports</div>
            <div className="text-[13.5px] mt-0.5">{activity.campaign_name}</div>
          </div>
          <Link
            href={`/campaigns/${encodeURIComponent(activity.campaign_id)}`}
            className="font-mono-tag text-[11.5px] rounded-lg px-3 py-1.5 glass hover:bg-glass-surface-strong transition-colors"
          >
            View Campaign →
          </Link>
        </section>
      )}

      {supplySignal && (
        <section className="glass rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="font-mono-tag text-[10px] uppercase tracking-wide text-foreground-muted">Driven By Supply Signal</div>
            <div className="text-[13.5px] mt-0.5">
              {supplySignal.supplier} · Container {supplySignal.container_no ?? "—"} · ETA {supplySignal.eta ?? "—"}
            </div>
          </div>
        </section>
      )}

      <section className="glass rounded-2xl px-4 py-3">
        <h2 className="text-[13px] font-semibold mb-2">Source</h2>
        <div className="font-mono-tag text-[11px] text-foreground-muted">
          {activity.source_file.split("\\").pop()} → {activity.source_sheet}
          {activity.source_row_ref && ` (${activity.source_row_ref})`}
        </div>
      </section>
    </div>
  );
}
