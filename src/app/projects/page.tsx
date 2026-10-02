import Link from "next/link";
import { listProjects } from "@/lib/queries/projects";
import { getLang, ts } from "@/lib/i18n";

const STATUS_COLOR: Record<string, string> = {
  Planning: "var(--blue-grey)",
  Proposal: "var(--blue-grey)",
  Submitted: "var(--amber)",
  Approved: "var(--green)",
  Execution: "var(--green)",
  Reporting: "var(--amber)",
  Claim: "var(--amber)",
  Completed: "var(--grey)",
  Failed: "var(--red)",
  "On Hold": "var(--grey)",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function ProjectsPage() {
  const projects = listProjects();
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">{ts(lang, "Projects", "Dự án")}</h1>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
          {ts(lang, "Project control system — tenders, sponsorships, supplier-funded programmes, large activations. Failed projects stay as history, never deleted.", "Hệ thống quản lý dự án — đấu thầu, tài trợ, chương trình do nhà cung cấp tài trợ, hoạt động lớn. Dự án FAILED được giữ làm lịch sử, không xóa.")}
        </div>
      </div>

      {projects.length === 0 && (
        <div className="glass rounded-2xl px-4 py-8 text-center text-[13px] text-foreground-muted">
          {ts(lang, "No projects yet.", "Chưa có dự án nào.")}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${encodeURIComponent(p.id)}`} className="glass rounded-2xl px-4 py-4 flex flex-col gap-2 hover:bg-glass-surface-strong transition-colors">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[15px] font-semibold">{p.name}</div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono-tag text-[10px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--glass-surface)", color: STATUS_COLOR[p.overall_status] }}>
                  {p.overall_status}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono-tag text-[11px] text-foreground-muted">
              <span>{p.project_type}</span>
              {p.partner && <span>· {ts(lang, "Partner", "Đối tác")}: {p.partner}</span>}
              {p.pic && <span>· PIC: {p.pic}</span>}
              <span>· {formatDate(p.period_start)} – {formatDate(p.period_end)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap text-[12px]">
              <span className="text-foreground-muted">
                {ts(lang, "Stage", "Giai đoạn")}: <span className="text-foreground">{p.current_stage ?? "—"}</span>
                {p.next_deadline && <> · {ts(lang, "Next deadline", "Hạn kế tiếp")}: <span className="text-foreground">{p.next_deadline}</span></>}
              </span>
              {p.next_action && <span className="text-foreground-muted truncate max-w-[50%]">{ts(lang, "Next", "Tiếp theo")}: {p.next_action}</span>}
            </div>
            {p.overall_status === "Failed" && p.failure_reason && (
              <div className="text-[11.5px] rounded-md px-2.5 py-1.5 mt-1" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
                {ts(lang, "Reason", "Lý do")}: {p.failure_reason}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
