import Link from "next/link";
import { notFound } from "next/navigation";
import {
  bucketProjectActions,
  getProject,
  listCurrentProjectInformation,
  listProjectActions,
  listProjectCookingGuidelines,
  listProjectDemoProducts,
  listProjectDetailSections,
  listProjectFunding,
  listProjectInformationHistory,
  listProjectMilestones,
  listProjectPosmItems,
  listProjectRisks,
  listProjectWorkstreams,
} from "@/lib/queries/projects";

const STATUS_COLOR: Record<string, string> = {
  Planning: "var(--blue-grey)", Proposal: "var(--blue-grey)", Submitted: "var(--amber)", Approved: "var(--green)",
  Execution: "var(--green)", Reporting: "var(--amber)", Claim: "var(--amber)", Completed: "var(--grey)",
  Failed: "var(--red)", "On Hold": "var(--grey)",
};
const HEALTH_LABEL: Record<string, { label: string; color: string }> = {
  Failed: { label: "FAILED", color: "var(--red)" },
  Completed: { label: "COMPLETED", color: "var(--grey)" },
  "On Hold": { label: "ON HOLD", color: "var(--amber)" },
};
const INFO_STATUS_COLOR: Record<string, string> = {
  CONFIRMED: "var(--green)", WORKING: "var(--amber)", "TO CONFIRM": "var(--amber)", SUPERSEDED: "var(--grey)", CANCELLED: "var(--grey)",
};
const ACTION_STATUS_COLOR: Record<string, string> = {
  PLANNED: "var(--blue-grey)", URGENT: "var(--red)", WAITING: "var(--amber)", "TO CONFIRM": "var(--amber)", "IN PROGRESS": "var(--green)", DONE: "var(--grey)",
};
const MILESTONE_STATUS_COLOR: Record<string, string> = {
  PLANNED: "var(--blue-grey)", "IN PROGRESS": "var(--green)", DONE: "var(--grey)", "AT RISK": "var(--red)",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(decodeURIComponent(id));
  if (!project) notFound();

  const funding = listProjectFunding(project.id);
  const milestones = listProjectMilestones(project.id);
  const workstreams = listProjectWorkstreams(project.id);
  const currentInfo = listCurrentProjectInformation(project.id);
  const infoHistory = listProjectInformationHistory(project.id);
  const demoProducts = listProjectDemoProducts(project.id);
  const posmItems = listProjectPosmItems(project.id);
  const cookingGuidelines = listProjectCookingGuidelines(project.id);
  const actions = listProjectActions(project.id);
  const risks = listProjectRisks(project.id);
  const sections = listProjectDetailSections(project.id);
  const buckets = bucketProjectActions(actions);

  const health = HEALTH_LABEL[project.overall_status] ?? { label: "ACTIVE", color: "var(--green)" };
  const demoByMonth = new Map<string, typeof demoProducts>();
  for (const d of demoProducts) (demoByMonth.get(d.month_label) ?? demoByMonth.set(d.month_label, []).get(d.month_label)!).push(d);
  const infoHistoryByCategory = new Map<string, typeof infoHistory>();
  for (const i of infoHistory) (infoHistoryByCategory.get(i.category) ?? infoHistoryByCategory.set(i.category, []).get(i.category)!).push(i);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-6">
      <div>
        <Link href="/projects" className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground">← Projects</Link>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <h1 className="text-[22px] font-semibold">{project.name}</h1>
          <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--glass-surface)", color: health.color }}>
            {health.label}
          </span>
          <span className="font-mono-tag text-[10.5px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--glass-surface)", color: STATUS_COLOR[project.overall_status] }}>
            {project.current_stage ?? project.overall_status}
          </span>
        </div>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">{formatDate(project.period_start)} – {formatDate(project.period_end)}</div>

        {project.overall_status === "Failed" && project.failure_reason && (
          <div className="text-[12.5px] rounded-xl px-3 py-2 mt-2" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
            Failure Reason: {project.failure_reason}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-[12.5px]">
          {project.partner && <div><span className="text-foreground-muted">Partner: </span>{project.partner}</div>}
          {project.funding_source && <div><span className="text-foreground-muted">Funding Source: </span>{project.funding_source}</div>}
          {project.pic && <div><span className="text-foreground-muted">PIC: </span>{project.pic}</div>}
          {funding.length > 0 && (
            <div>
              <span className="text-foreground-muted">Funding: </span>
              {funding.map((f) => `${f.funding_label} ${f.currency ?? ""} ${f.amount ?? ""}`).join(" + ")}
            </div>
          )}
          {(project.main_store_scope || project.main_product_focus) && (
            <div className="sm:col-span-2">
              <span className="text-foreground-muted">Scope: </span>
              {[project.main_store_scope, project.main_product_focus].filter(Boolean).join(" · ")}
            </div>
          )}
          {project.next_action && (
            <div className="sm:col-span-2">
              <span className="text-foreground-muted">Next: </span>{project.next_action}
            </div>
          )}
        </div>
      </div>

      {project.summary && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">Project Summary</h2>
          <div className="glass rounded-2xl px-4 py-3 text-[12.5px] leading-relaxed whitespace-pre-line">{project.summary}</div>
        </section>
      )}

      {milestones.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">Milestones & Timeline</h2>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                    <th className="px-3 py-2 font-medium">Milestone</th>
                    <th className="px-3 py-2 font-medium">Deadline</th>
                    <th className="px-3 py-2 font-medium">Owner</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Dependency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border/60">
                  {milestones.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2 font-medium">{m.milestone_name}</td>
                      <td className="px-3 py-2 font-mono-tag text-foreground-muted">{m.deadline ?? "—"}</td>
                      <td className="px-3 py-2 text-foreground-muted">{m.owner ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono-tag text-[9.5px] uppercase rounded px-1.5 py-0.5" style={{ background: "var(--glass-surface)", color: MILESTONE_STATUS_COLOR[m.status] }}>{m.status}</span>
                      </td>
                      <td className="px-3 py-2 text-foreground-muted">{m.dependency ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {actions.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">Project Action Control</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <div className="glass rounded-xl px-3 py-2"><div className="font-mono-tag text-[16px] font-bold" style={{ color: "var(--red)" }}>{buckets.overdue.length}</div><div className="text-[10px] uppercase text-foreground-muted">Urgent</div></div>
            <div className="glass rounded-xl px-3 py-2"><div className="font-mono-tag text-[16px] font-bold" style={{ color: "var(--amber)" }}>{buckets.waitingForOthers.length}</div><div className="text-[10px] uppercase text-foreground-muted">Waiting for Others</div></div>
            <div className="glass rounded-xl px-3 py-2"><div className="font-mono-tag text-[16px] font-bold" style={{ color: "var(--green)" }}>{buckets.needMyAction.length}</div><div className="text-[10px] uppercase text-foreground-muted">Need My Action</div></div>
            <div className="glass rounded-xl px-3 py-2"><div className="font-mono-tag text-[16px] font-bold">{buckets.other.length}</div><div className="text-[10px] uppercase text-foreground-muted">Planned</div></div>
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Workstream</th>
                    <th className="px-3 py-2 font-medium">Owner</th>
                    <th className="px-3 py-2 font-medium">Deadline</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Dependency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border/60">
                  {actions.map((a) => (
                    <tr key={a.id}>
                      <td className="px-3 py-2 font-medium">{a.action}</td>
                      <td className="px-3 py-2 text-foreground-muted">{a.workstream ?? "—"}</td>
                      <td className="px-3 py-2 text-foreground-muted">{a.owner ?? "—"}</td>
                      <td className="px-3 py-2 font-mono-tag text-foreground-muted">{a.deadline ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono-tag text-[9.5px] uppercase rounded px-1.5 py-0.5" style={{ background: "var(--glass-surface)", color: ACTION_STATUS_COLOR[a.status] }}>{a.status}</span>
                      </td>
                      <td className="px-3 py-2 text-foreground-muted">{a.dependency ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {workstreams.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">Workstreams</h2>
          <div className="glass rounded-2xl overflow-hidden divide-y divide-glass-border/60">
            {workstreams.map((w) => (
              <div key={w.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium">{w.workstream_name}</div>
                  {w.detail && <div className="text-[11.5px] text-foreground-muted mt-0.5">{w.detail}</div>}
                </div>
                <span className="font-mono-tag text-[10px] uppercase text-foreground-muted whitespace-nowrap shrink-0">{w.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {risks.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">Risks / Waiting</h2>
          <div className="flex flex-col gap-2">
            {risks.map((r) => (
              <div key={r.id} className="rounded-xl px-3 py-2.5" style={{ background: "var(--amber-bg)" }}>
                <div className="text-[12.5px] font-semibold" style={{ color: "var(--amber)" }}>{r.title}</div>
                {r.description && <div className="text-[12px] text-foreground-muted mt-0.5">{r.description}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {currentInfo.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold mb-2">Fixed Information</h2>
          <div className="glass rounded-2xl overflow-hidden divide-y divide-glass-border/60">
            {currentInfo.map((i) => (
              <div key={i.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono-tag text-[9.5px] uppercase text-foreground-muted">{i.category}</div>
                  <div className="text-[12.5px]">{i.label}</div>
                  {i.detail && <div className="text-[11.5px] text-foreground-muted mt-0.5">{i.detail}</div>}
                </div>
                <span className="font-mono-tag text-[9.5px] uppercase rounded px-1.5 py-0.5 shrink-0" style={{ background: "var(--glass-surface)", color: INFO_STATUS_COLOR[i.status] }}>{i.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Detailed Information — collapsed by default ─────────────────── */}
      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold">Detailed Information</h2>

        {funding.length > 0 && (
          <details className="glass rounded-2xl overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
              <span className="text-[12.5px] font-medium">Funding Breakdown</span>
              <span className="text-foreground-muted text-[11px]">▾</span>
            </summary>
            <div className="divide-y divide-glass-border/60 border-t border-glass-border">
              {funding.map((f) => (
                <div key={f.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium">{f.funding_label}</span>
                    <span className="font-mono-tag text-[12px]">{f.currency} {f.amount}</span>
                  </div>
                  {f.flow && <div className="text-[11px] text-foreground-muted mt-0.5">Flow: {f.flow}</div>}
                  {f.contribution_note && <div className="text-[11px] text-foreground-muted mt-0.5">{f.contribution_note}</div>}
                </div>
              ))}
            </div>
          </details>
        )}

        {demoProducts.length > 0 && (
          <details className="glass rounded-2xl overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
              <span className="text-[12.5px] font-medium">Demo Sessions / Products ({demoProducts.length})</span>
              <span className="text-foreground-muted text-[11px]">▾</span>
            </summary>
            <div className="border-t border-glass-border">
              {[...demoByMonth.entries()].map(([month, products]) => (
                <details key={month} className="border-b border-glass-border/60 last:border-b-0">
                  <summary className="px-4 py-2 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
                    <span className="font-mono-tag text-[11px] uppercase text-foreground-muted">{month}</span>
                    <span className="text-foreground-muted text-[10px]">▾</span>
                  </summary>
                  <table className="w-full text-[11.5px]">
                    <tbody className="divide-y divide-glass-border/60">
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-1.5 font-mono-tag text-foreground-muted w-[60px]">{p.week_label ?? "—"}</td>
                          <td className="px-2 py-1.5 font-mono-tag text-foreground-muted w-[90px]">{p.product_code ?? "—"}</td>
                          <td className="px-2 py-1.5">{p.product_name}{p.notes && <span className="text-foreground-muted"> · {p.notes}</span>}</td>
                          <td className="px-2 py-1.5 text-right w-[100px]">
                            <span className="font-mono-tag text-[9px] uppercase rounded px-1 py-0.5" style={{ background: "var(--glass-surface)", color: INFO_STATUS_COLOR[p.status] ?? undefined }}>{p.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ))}
            </div>
          </details>
        )}

        {cookingGuidelines.length > 0 && (
          <details className="glass rounded-2xl overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
              <span className="text-[12.5px] font-medium">Cooking Guidelines</span>
              <span className="text-foreground-muted text-[11px]">▾</span>
            </summary>
            <div className="divide-y divide-glass-border/60 border-t border-glass-border">
              {cookingGuidelines.map((c) => (
                <div key={c.id} className="px-4 py-2.5">
                  <div className="text-[12.5px] font-medium">{c.product_name}</div>
                  <div className="text-[11.5px] text-foreground-muted mt-0.5 whitespace-pre-line leading-relaxed">{c.instructions}</div>
                </div>
              ))}
            </div>
          </details>
        )}

        {posmItems.length > 0 && (
          <details className="glass rounded-2xl overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
              <span className="text-[12.5px] font-medium">POSM Breakdown</span>
              <span className="text-foreground-muted text-[11px]">▾</span>
            </summary>
            <table className="w-full text-[12px] border-t border-glass-border">
              <thead>
                <tr className="text-left font-mono-tag text-[10px] uppercase text-foreground-muted border-b border-glass-border">
                  <th className="px-4 py-2 font-medium">POSM</th>
                  <th className="px-4 py-2 font-medium">Quantity / Scope</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border/60">
                {posmItems.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">{p.posm_type}</td>
                    <td className="px-4 py-2 font-mono-tag text-foreground-muted">{p.quantity_scope ?? "—"}</td>
                    <td className="px-4 py-2 text-foreground-muted">
                      {p.status}
                      {p.notes && <div className="text-[10.5px] mt-0.5">{p.notes}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        {sections.map((s) => (
          <details key={s.id} className="glass rounded-2xl overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
              <span className="text-[12.5px] font-medium">{s.title}</span>
              <span className="text-foreground-muted text-[11px]">▾</span>
            </summary>
            <div className="px-4 py-3 text-[12px] text-foreground-muted whitespace-pre-line leading-relaxed border-t border-glass-border">{s.body}</div>
          </details>
        ))}

        {infoHistoryByCategory.size > 0 && (
          <details className="glass rounded-2xl overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer list-none flex items-center justify-between hover:bg-glass-surface transition-colors">
              <span className="text-[12.5px] font-medium">Decision &amp; Change History</span>
              <span className="text-foreground-muted text-[11px]">▾</span>
            </summary>
            <div className="divide-y divide-glass-border/60 border-t border-glass-border">
              {[...infoHistoryByCategory.entries()].map(([category, items]) => (
                <div key={category} className="px-4 py-2.5">
                  <div className="font-mono-tag text-[10px] uppercase text-foreground-muted mb-1">{category}</div>
                  <div className="flex flex-col gap-1">
                    {items.map((i) => (
                      <div key={i.id} className="flex items-center gap-2 text-[12px]">
                        <span className="font-mono-tag text-[9px] uppercase rounded px-1 py-0.5 shrink-0" style={{ background: "var(--glass-surface)", color: INFO_STATUS_COLOR[i.status] }}>{i.status}</span>
                        <span className={i.status === "SUPERSEDED" || i.status === "CANCELLED" ? "line-through text-foreground-muted" : ""}>{i.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
