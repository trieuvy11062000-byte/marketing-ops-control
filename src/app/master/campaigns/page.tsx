import Link from "next/link";
import { listCampaignTypes } from "@/lib/queries/master";
import { getLang, ts } from "@/lib/i18n";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="font-mono-tag text-[9.5px] uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="text-[12.5px] mt-0.5 whitespace-pre-line leading-relaxed">{value}</div>
    </div>
  );
}

export default async function CampaignKnowledgePage() {
  const types = listCampaignTypes();
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-5">
      <div>
        <Link href="/master" className="font-mono-tag text-[11px] text-foreground-muted hover:text-foreground">← Master</Link>
        <h1 className="text-[22px] font-semibold mt-1">{ts(lang, "Campaign Knowledge", "Kiến thức Campaign")}</h1>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
          {ts(lang, "The LGD campaign taxonomy and timing rules — reference knowledge, not live campaign execution", "Phân loại chiến dịch và quy tắc thời gian của LGD — kiến thức tham khảo, không phải dữ liệu thực thi")}
        </div>
      </div>

      <div className="glass rounded-2xl px-4 py-3 text-[12.5px] text-foreground-muted flex flex-col gap-1">
        <div>{ts(lang, "Monthly Campaign = 12/year. Golden Week = 6/year, per the annual campaign calendar.", "Monthly Campaign = 12 lần/năm. Golden Week = 6 lần/năm, theo Annual Campaign Calendar.")}</div>
        <div>{ts(lang, "Branded Week is an alternative branded activation in months without a Golden Week.", "Branded Week là hoạt động thương hiệu thay thế ở các tháng không có Golden Week.")}</div>
        <div>{ts(lang, "“Week” does not default to 7 days — always use the campaign’s actual Start/End date.", "“Week” không mặc định là 7 ngày — luôn dùng Start/End date thực tế của campaign.")}</div>
      </div>

      <div className="glass rounded-2xl overflow-hidden divide-y divide-glass-border/60">
        {types.map((t) => (
          <details key={t.id} id={t.id} className="group">
            <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-glass-surface transition-colors">
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="text-[13.5px] font-semibold">{t.name}</span>
                {lang === "vi" && t.explanation_vi && <span className="text-[11.5px] text-foreground-muted truncate italic">{t.explanation_vi}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono-tag text-[10px] uppercase text-foreground-muted whitespace-nowrap">{t.frequency}</span>
                <span className="text-foreground-muted text-[11px] transition-transform group-open:rotate-180">▾</span>
              </div>
            </summary>
            <div className="px-4 pb-4 flex flex-col gap-3">
              <Field label={ts(lang, "What it is", "Định nghĩa")} value={t.what_it_is} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Timing Rule" value={t.timing_rule} />
                <Field label="Duration" value={t.duration} />
                <Field label={ts(lang, "Purpose", "Mục đích")} value={t.purpose} />
              </div>
              <Field label={ts(lang, "Typical Deliverables", "Hạng mục thường có")} value={t.typical_deliverables} />
              <Field label={ts(lang, "Notes", "Ghi chú")} value={t.notes} />
              <div className="font-mono-tag text-[10px] text-foreground-muted pt-1 border-t border-glass-border/60">
                {t.year} · {t.effective_period} · {t.status} · {ts(lang, "Source", "Nguồn")}: {t.source}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
