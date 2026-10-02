import Link from "next/link";
import { notFound } from "next/navigation";
import { getApDeliveryLine, getLinkedExecutionRecords } from "@/lib/queries/ap";

export default async function ApDeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const line = getApDeliveryLine(decodeURIComponent(id));
  if (!line) notFound();

  const records = getLinkedExecutionRecords(line);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 flex flex-col gap-6">
      <div>
        <div className="font-mono-tag text-[11.5px] text-foreground-muted">A&P Delivery Detail</div>
        <h1 className="text-[22px] font-bold tracking-tight">
          {line.brand_name ? `${line.brand_name} — ` : ""}
          {line.deliverable_type}
        </h1>
        <Link href={`/ap/${encodeURIComponent(line.package_id)}`} className="font-mono-tag text-[11.5px] text-foreground-muted hover:underline">
          ← {line.package_name}
        </Link>
      </div>

      <section className="glass rounded-2xl px-5 py-4 grid grid-cols-3 gap-4">
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Agreed</div>
          <div className="font-mono-tag text-[22px] font-bold mt-1">{line.agreed_label ?? "—"}</div>
        </div>
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Delivered</div>
          <div className="font-mono-tag text-[22px] font-bold mt-1">{line.delivered_quantity ?? "—"}</div>
        </div>
        <div>
          <div className="font-mono-tag text-[10px] uppercase text-foreground-muted">Evidence</div>
          <div className="font-mono-tag text-[22px] font-bold mt-1">{line.evidence_status}</div>
        </div>
      </section>

      {line.source_row_ref && (
        <div className="text-[12px] text-foreground-muted glass rounded-xl px-4 py-3">{line.source_row_ref}</div>
      )}

      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Linked Execution Records</h2>
          {line.source_module && <span className="font-mono-tag text-[11px] text-foreground-muted">Source: {line.source_module}</span>}
        </div>
        {records.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">
            No linked records — either not yet executed, or the source module isn&apos;t connected.
          </div>
        ) : (
          <div className="divide-y divide-glass-border/60">
            {records.slice(0, 50).map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-[12.5px]">
                <div>
                  <span className="font-mono-tag text-foreground-muted mr-2">{r.week_code}</span>
                  {r.location} {r.session_label && `· ${r.session_label}`}
                  {r.sku_name && <span className="text-foreground-muted"> · {r.sku_name}</span>}
                </div>
                <span className="font-mono-tag text-[10.5px] text-foreground-muted">{r.status}</span>
              </div>
            ))}
          </div>
        )}
        {line.link_subtype === "Demo" && (
          <div className="px-4 py-3 border-t border-glass-border">
            <Link href="/in-store" className="font-mono-tag text-[11.5px] rounded-lg px-3 py-1.5 glass hover:bg-glass-surface-strong transition-colors inline-block">
              View Demo Record →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
