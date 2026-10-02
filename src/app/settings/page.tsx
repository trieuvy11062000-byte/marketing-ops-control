import { getLang, ts } from "@/lib/i18n";

export default async function SettingsPage() {
  const lang = await getLang();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-[22px] font-semibold mb-4">{ts(lang, "Settings", "Cài đặt")}</h1>
      <div className="glass rounded-2xl px-4 py-8 text-center text-[13px] text-foreground-muted">
        {ts(lang, "Theme, team roles, and risk-rule tuning will live here. Not built in this pass.", "Giao diện, vai trò nhóm và quy tắc rủi ro sẽ ở đây. Chưa xây dựng trong lần này.")}
      </div>
    </div>
  );
}
