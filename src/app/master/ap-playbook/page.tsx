import Link from "next/link";
import { listApChecklist, listApPlaybookSteps } from "@/lib/queries/master";
import { getLang, ts } from "@/lib/i18n";
import { td } from "@/lib/i18nDict";

export default async function ApPlaybookPage() {
  const steps = listApPlaybookSteps();
  const checklist = listApChecklist();
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-5">
      <div>
        <Link href="/master" className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground">← Master</Link>
        <h1 className="text-[22px] font-semibold mt-1">{ts(lang, "A&P Proposal Playbook", "Playbook Đề xuất A&P")}</h1>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">{ts(lang, "Working knowledge for building supplier proposals", "Kiến thức làm việc để xây dựng đề xuất cho nhà cung cấp")}</div>
      </div>

      <div className="flex flex-col gap-0">
        {steps.map((s, i) => (
          <div key={s.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-glass-surface-strong border border-glass-border flex items-center justify-center font-mono-tag text-[11px] font-bold shrink-0">
                {s.step_order}
              </div>
              {i < steps.length - 1 && <div className="w-px flex-1 bg-glass-border my-1" />}
            </div>
            <details className="group glass rounded-2xl mb-3 flex-1 overflow-hidden">
              <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-glass-surface transition-colors">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold">{s.step_name}</div>
                  <div className="text-[11.5px] text-foreground-muted truncate">{s.description}</div>
                </div>
                <span className="text-foreground-muted text-[11px] shrink-0 transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="px-4 pb-3">
                {lang === "vi" && s.description_vi && <div className="text-[12px] text-foreground-muted italic mb-2">{s.description_vi}</div>}
                {s.rules && (
                  <ul className="flex flex-col gap-1">
                    {s.rules.split("\n").map((r, ri) => (
                      <li key={ri} className="text-[11.5px] text-foreground-muted flex gap-1.5">
                        <span className="text-foreground-muted/60">—</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="font-mono-tag text-[10px] text-foreground-muted/70 mt-2 pt-2 border-t border-glass-border/60">{td(lang, "Source")}: {s.source ?? "—"}</div>
              </div>
            </details>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-[13px] font-semibold mb-2">{ts(lang, "Proposal Checklist", "Checklist Đề xuất")}</h2>
        <div className="glass rounded-2xl overflow-hidden divide-y divide-glass-border/60">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 px-4 py-2.5">
              <span className="w-4 h-4 rounded border border-glass-border shrink-0" />
              <span className="text-[12.5px]">{item.item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
