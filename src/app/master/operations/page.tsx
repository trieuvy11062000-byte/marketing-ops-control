import Link from "next/link";
import { listCampaignRules, listHandbookEntries, listWorkstreams } from "@/lib/queries/master";
import { getLang, ts, type Lang } from "@/lib/i18n";
import { td } from "@/lib/i18nDict";

const STATUS_COLOR: Record<string, string> = {
  CURRENT: "var(--green)",
  HISTORICAL: "var(--grey)",
  "NEEDS VERIFICATION": "var(--amber)",
};

const SOP_ORDER = ["Design Rules", "Reporting", "Demo", "A&P", "POSM", "Other SOP"];

function WsField({
  label,
  value,
  valueVi,
  lang,
}: {
  label: string;
  value: string | null;
  valueVi?: string | null;
  lang: Lang;
}) {
  if (!value && !valueVi) return null;
  const showVi = lang === "vi" && !!valueVi;
  return (
    <div>
      <div className="font-mono-tag text-[9.5px] uppercase tracking-wide text-foreground-muted">{label}</div>
      {showVi ? (
        <>
          <div className="text-[12.5px] mt-0.5 whitespace-pre-line leading-relaxed">{valueVi}</div>
          {value && <div className="text-[11px] mt-1 whitespace-pre-line leading-relaxed text-foreground-muted italic">{value}</div>}
        </>
      ) : (
        value && <div className="text-[12.5px] mt-0.5 whitespace-pre-line leading-relaxed">{value}</div>
      )}
    </div>
  );
}

function BodyField({ value, valueVi, lang, className }: { value: string | null; valueVi?: string | null; lang: Lang; className?: string }) {
  if (!value && !valueVi) return null;
  const showVi = lang === "vi" && !!valueVi;
  return (
    <div className={className}>
      {showVi ? (
        <>
          <div className="whitespace-pre-line leading-relaxed">{valueVi}</div>
          {value && <div className="text-[11px] mt-1.5 whitespace-pre-line leading-relaxed text-foreground-muted italic">{value}</div>}
        </>
      ) : (
        value && <div className="whitespace-pre-line leading-relaxed">{value}</div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className="font-mono-tag text-[9.5px] uppercase rounded px-1.5 py-0.5" style={{ background: "var(--glass-surface)", color: STATUS_COLOR[status] }}>
      {status}
    </span>
  );
}

export default async function OperationsHandbookPage() {
  const workstreams = listWorkstreams();
  const campaignRules = listCampaignRules();
  const entries = listHandbookEntries();
  const lang = await getLang();
  const byCategory = new Map<string, typeof entries>();
  for (const e of entries) {
    (byCategory.get(e.category) ?? byCategory.set(e.category, []).get(e.category)!).push(e);
  }
  const orderedCategories = [...SOP_ORDER.filter((c) => byCategory.has(c)), ...[...byCategory.keys()].filter((c) => !SOP_ORDER.includes(c))];

  const campaignRulesByCategory = new Map<string, typeof campaignRules>();
  for (const r of campaignRules) {
    (campaignRulesByCategory.get(r.category) ?? campaignRulesByCategory.set(r.category, []).get(r.category)!).push(r);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-6">
      <div>
        <Link href="/master" className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground">← Master</Link>
        <h1 className="text-[22px] font-semibold mt-1">{ts(lang, "Marketing Operations Handbook", "Sổ tay Vận hành Marketing")}</h1>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
          {ts(lang, "Open this page to see who to follow, what to do and what deadline this week — team working rules first, then Campaign Knowledge and detailed SOPs", "Mở trang này để biết tuần này tôi phải follow ai, việc gì, deadline nào — team working rules trước, Campaign Knowledge và SOP chi tiết sau")}
        </div>
      </div>

      <section>
        <h2 className="text-[13px] font-semibold mb-2">{ts(lang, "Team Workstreams", "Nhóm công việc")}</h2>
        <div className="glass rounded-2xl overflow-hidden divide-y divide-glass-border/60">
          {workstreams.map((w) => (
            <details key={w.id} id={w.id} className="group">
              <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-glass-surface transition-colors">
                <span className="text-[13.5px] font-semibold">{w.pic_name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusChip status={w.status} />
                  <span className="text-foreground-muted text-[11px] transition-transform group-open:rotate-180">▾</span>
                </div>
              </summary>
              <div className="px-4 pb-4 flex flex-col gap-3">
                <WsField label={ts(lang, "Recurring Tasks", "Công việc định kỳ")} value={w.recurring_tasks} valueVi={w.recurring_tasks_vi} lang={lang} />
                <WsField label={ts(lang, "Weekly Timing", "Lịch trình tuần")} value={w.weekly_timing} valueVi={w.weekly_timing_vi} lang={lang} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <WsField label={ts(lang, "Input Needed", "Cần đầu vào")} value={w.input_needed} valueVi={w.input_needed_vi} lang={lang} />
                  <WsField label={ts(lang, "My Action", "Hành động")} value={w.my_action} valueVi={w.my_action_vi} lang={lang} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <WsField label={ts(lang, "Handover To", "Bàn giao cho")} value={w.handover_to} valueVi={w.handover_to_vi} lang={lang} />
                  <WsField label={td(lang, "Deadline")} value={w.deadline} valueVi={w.deadline_vi} lang={lang} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <WsField label={ts(lang, "Output", "Kết quả")} value={w.output} valueVi={w.output_vi} lang={lang} />
                  <WsField label={ts(lang, "Check / Audit", "Kiểm tra")} value={w.check_audit} valueVi={w.check_audit_vi} lang={lang} />
                </div>
                <WsField label={ts(lang, "Important Rules", "Quy tắc quan trọng")} value={w.important_rules} valueVi={w.important_rules_vi} lang={lang} />
                <WsField
                  label={ts(lang, "Execution Detail (channel/platform reference)", "Chi tiết thực thi (tham khảo kênh/nền tảng)")}
                  value={w.execution_detail}
                  valueVi={w.execution_detail_vi}
                  lang={lang}
                />
                <div className="font-mono-tag text-[10px] text-foreground-muted pt-1 border-t border-glass-border/60">
                  {td(lang, "Source")}: {w.source ?? "—"}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[13px] font-semibold mb-2">{ts(lang, "Campaign Knowledge / Rules", "Kiến thức & Quy tắc Campaign")}</h2>
        <div className="font-mono-tag text-[11px] text-foreground-muted mb-2">
          {ts(lang, "Operational SOPs for running campaigns & promotions day to day. Campaign taxonomy and timing rules live at", "SOP vận hành chiến dịch & khuyến mãi hàng ngày. Phân loại chiến dịch và quy tắc thời gian nằm ở")}{" "}
          <Link href="/master/campaigns" className="underline hover:text-foreground">Master → {ts(lang, "Campaign Knowledge", "Kiến thức Campaign")}</Link>.
        </div>
        {[...campaignRulesByCategory.entries()].map(([category, rules]) => (
          <div key={category} className="glass rounded-2xl overflow-hidden divide-y divide-glass-border/60 mb-3 last:mb-0">
            <div className="px-4 py-2 text-[11px] font-mono-tag uppercase tracking-wide text-foreground-muted bg-glass-surface-strong">{category}</div>
            {rules.map((r) => (
              <details key={r.id} id={r.id} className="group">
                <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-glass-surface transition-colors">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold">{r.rule_name}</span>
                    {r.summary && <span className="text-[11.5px] text-foreground-muted truncate">{r.summary}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusChip status={r.status} />
                    <span className="text-foreground-muted text-[11px] transition-transform group-open:rotate-180">▾</span>
                  </div>
                </summary>
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <BodyField value={r.body} valueVi={r.body_vi} lang={lang} className="text-[12.5px]" />
                  <div className="font-mono-tag text-[10px] text-foreground-muted pt-1 border-t border-glass-border/60">
                    {td(lang, "Source")}: {r.source ?? "—"}
                  </div>
                </div>
              </details>
            ))}
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3">
        {orderedCategories.map((category) => (
          <section key={category} className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-glass-border text-[12px] font-mono-tag uppercase tracking-wide text-foreground-muted">{category}</div>
            <div className="divide-y divide-glass-border/60">
              {byCategory.get(category)!.map((e) => (
                <details key={e.id} id={e.id} className="group">
                  <summary className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 cursor-pointer list-none hover:bg-glass-surface transition-colors">
                    <div className="text-[13px] font-semibold">{e.title}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusChip status={e.status} />
                      <span className="text-foreground-muted text-[11px] transition-transform group-open:rotate-180">▾</span>
                    </div>
                  </summary>
                  <div className="px-4 pb-3">
                    <BodyField value={e.body} valueVi={e.body_vi} lang={lang} className="text-[12.5px] text-foreground-muted" />
                    {lang === "vi" && e.summary_vi && <div className="text-[12px] text-foreground-muted mt-1.5 italic leading-relaxed">{e.summary_vi}</div>}
                    {e.source && <div className="font-mono-tag text-[10px] text-foreground-muted/70 mt-2">{td(lang, "Source")}: {e.source}</div>}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
