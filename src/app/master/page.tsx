import Link from "next/link";
import { BookOpen, Calendar, ClipboardList, FileSpreadsheet, Megaphone, Search } from "lucide-react";
import { getMasterQuickCounts, getNeedsVerification, getRecentlyUpdated, searchMasterKnowledge } from "@/lib/queries/master";
import { getLang, ts } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

function quickCards(lang: Lang) {
  return [
    { href: "/master/services", icon: FileSpreadsheet, label: ts(lang, "Services & Rates", "Dịch vụ & Bảng giá"), desc: ts(lang, "2026 / 2027 rate card — Campaign, In-store, Demo, Digital, Premium Packages, POSM", "Bảng giá 2026 / 2027 — Campaign, In-store, Demo, Digital, Premium Packages, POSM") },
    { href: "/master/campaigns", icon: Megaphone, label: ts(lang, "Campaign Rules", "Quy tắc Campaign"), desc: ts(lang, "Longdan campaign taxonomy — Monthly, Golden Week, Branded Week, Double Date...", "Phân loại chiến dịch Longdan — Monthly, Golden Week, Branded Week, Double Date...") },
    { href: "/master/calendar", icon: Calendar, label: ts(lang, "Annual Calendar", "Lịch năm"), desc: ts(lang, "Reference campaign calendar — theme, timing, hero category per month", "Lịch chiến dịch tham khảo — chủ đề, thời gian, ngành hàng chính theo tháng") },
    { href: "/master/ap-playbook", icon: ClipboardList, label: ts(lang, "A&P Playbook", "Playbook A&P"), desc: "Brief → Verify → Select → Budget → Forecast → Proposal → QA" },
    { href: "/master/operations", icon: BookOpen, label: ts(lang, "Operations", "Vận hành"), desc: ts(lang, "Workflow reference used by In-store, Demo, Digital, A&P and Design modules", "Quy trình tham khảo dùng chung bởi In-store, Demo, Digital, A&P và Design") },
  ];
}

function timeAgo(iso: string, lang: Lang): string {
  const d = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return ts(lang, "Today", "Hôm nay");
  if (days === 1) return ts(lang, "Yesterday", "Hôm qua");
  if (days < 30) return `${days}${ts(lang, "d ago", " ngày trước")}`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function MasterPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const lang = await getLang();
  const counts = getMasterQuickCounts();
  const recentlyUpdated = getRecentlyUpdated(8);
  const needsVerification = getNeedsVerification();
  const searchResults = q ? searchMasterKnowledge(q) : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-semibold">{ts(lang, "Master — Longdan Marketing Knowledge Base", "Master — Kho kiến thức Marketing Longdan")}</h1>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
          {ts(lang, "How Longdan works — rules, rates and working methods. Not execution data (that lives in Calendar / In-store / Digital / Promotion / A&P).", "Longdan làm việc theo rule nào — quy tắc, bảng giá và phương pháp làm việc. Không phải dữ liệu thực thi (dữ liệu đó ở Calendar / In-store / Digital / Promotion / A&P).")}
        </div>
      </div>

      <form method="get" action="/master" className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder={ts(lang, "Search Longdan knowledge...", "Tìm kiếm kiến thức Longdan...")}
          className="w-full rounded-xl pl-10 pr-4 py-3 bg-glass-surface border border-glass-border text-[14px] focus:outline-none focus:border-foreground-muted"
        />
      </form>

      {q && (
        <section className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-glass-border text-[12px] font-mono-tag text-foreground-muted">
            {searchResults.length} {ts(lang, "result", "kết quả")}{searchResults.length === 1 ? "" : lang === "en" ? "s" : ""} {ts(lang, "for", "cho")} &ldquo;{q}&rdquo;
          </div>
          <div className="divide-y divide-glass-border/60">
            {searchResults.map((r) => (
              <Link key={`${r.kind}-${r.id}`} href={r.href} className="flex items-center justify-between px-4 py-2.5 hover:bg-glass-surface transition-colors">
                <div>
                  <div className="text-[13px]">{r.title}</div>
                  {r.subtitle && <div className="text-[11px] text-foreground-muted">{r.subtitle}</div>}
                </div>
                <span className="font-mono-tag text-[9.5px] uppercase text-foreground-muted">{r.kind.replace("_", " ")}</span>
              </Link>
            ))}
            {searchResults.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">{ts(lang, "No matches in Master knowledge", "Không tìm thấy trong Master")}</div>}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {quickCards(lang).map((c) => (
          <Link key={c.href} href={c.href} className="glass rounded-2xl px-4 py-4 flex flex-col gap-2 hover:bg-glass-surface-strong transition-colors">
            <c.icon className="w-4 h-4 text-foreground-muted" />
            <div className="text-[13.5px] font-semibold">{c.label}</div>
            <div className="text-[11.5px] text-foreground-muted leading-snug">{c.desc}</div>
          </Link>
        ))}
        <div className="glass rounded-2xl px-4 py-4 flex flex-col gap-1 justify-center">
          <div className="font-mono-tag text-[11px] uppercase text-foreground-muted">{ts(lang, "Coverage", "Phạm vi")}</div>
          <div className="text-[12.5px] text-foreground-muted leading-relaxed">
            {counts.services} {ts(lang, "services", "dịch vụ")} · {counts.campaignTypes} {ts(lang, "campaign types", "loại chiến dịch")} · {counts.calendarMonths} {ts(lang, "calendar months", "tháng trong lịch")} · {counts.handbookEntries} {ts(lang, "handbook entries", "mục sổ tay")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section>
          <h2 className="text-[13px] font-semibold mb-2">{ts(lang, "Recently Updated", "Cập nhật gần đây")}</h2>
          <div className="glass rounded-2xl overflow-hidden divide-y divide-glass-border/60">
            {recentlyUpdated.map((r, i) => (
              <Link key={i} href={r.href} className="flex items-center justify-between px-4 py-2.5 hover:bg-glass-surface transition-colors">
                <div>
                  <div className="text-[12.5px]">{r.title}</div>
                  <div className="font-mono-tag text-[10px] text-foreground-muted">{r.kind} · {r.subtitle}</div>
                </div>
                <span className="font-mono-tag text-[10px] text-foreground-muted whitespace-nowrap">{timeAgo(r.last_updated, lang)}</span>
              </Link>
            ))}
            {recentlyUpdated.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">{ts(lang, "Nothing recorded yet", "Chưa có gì được ghi nhận")}</div>}
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-semibold mb-2 flex items-center gap-2">
            {ts(lang, "Needs Verification", "Cần xác minh")}
            {needsVerification.length > 0 && (
              <span className="font-mono-tag text-[10px] uppercase rounded-md px-1.5 py-0.5" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>
                {needsVerification.length}
              </span>
            )}
          </h2>
          <div className="glass rounded-2xl overflow-hidden divide-y divide-glass-border/60">
            {needsVerification.map((r, i) => (
              <Link key={i} href={r.href} className="flex flex-col gap-0.5 px-4 py-2.5 hover:bg-glass-surface transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px]">{r.title}</span>
                  <span className="font-mono-tag text-[10px] text-foreground-muted">{r.kind}</span>
                </div>
                {r.note && <span className="text-[11px] text-foreground-muted">{r.note}</span>}
              </Link>
            ))}
            {needsVerification.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">{ts(lang, "Nothing flagged — all current knowledge is verified", "Không có gì cần xác minh — toàn bộ kiến thức hiện tại đã được xác minh")}</div>}
          </div>
        </section>
      </div>

      <div className="font-mono-tag text-[11px] text-foreground-muted">
        {ts(lang, "Database diagnostics (source coverage, record counts) moved to", "Chẩn đoán database (phạm vi nguồn, số lượng bản ghi) đã chuyển sang")}{" "}
        <Link href="/import?tab=DATA_HEALTH" className="underline hover:text-foreground">Import → Data Health</Link>.
      </div>
    </div>
  );
}
