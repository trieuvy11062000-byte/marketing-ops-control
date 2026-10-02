import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { currentWeekCode } from "@/lib/db/weeks";
import { getControlSummary } from "@/lib/queries/dashboard";
import { getLang } from "@/lib/i18n";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const week = currentWeekCode();
  const summary = getControlSummary();
  const attentionCount = summary.overdue + summary.blocked;
  const lang = await getLang();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar lang={lang} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar currentWeek={week} attentionCount={attentionCount} lang={lang} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
