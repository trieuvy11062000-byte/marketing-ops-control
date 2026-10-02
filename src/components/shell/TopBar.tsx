import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { CommandSearch } from "./CommandSearch";
import { LanguageToggle } from "./LanguageToggle";
import type { Lang } from "@/lib/i18n";

export function TopBar({ currentWeek, attentionCount, lang }: { currentWeek: string; attentionCount: number; lang: Lang }) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-glass-border bg-background/70 backdrop-blur-xl px-5 py-3">
      <CommandSearch />

      <Link
        href={`/week/${currentWeek}`}
        className="font-mono-tag glass shrink-0 rounded-xl px-3 py-2 text-[12.5px] font-medium hover:bg-glass-surface-strong transition-colors"
      >
        {currentWeek} ▾
      </Link>

      <Link
        href="/tasks?bucket=overdue"
        className="glass shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium hover:bg-glass-surface-strong transition-colors"
        style={{ color: attentionCount > 0 ? "var(--red)" : "var(--foreground-muted)" }}
      >
        <AlertTriangle size={14} strokeWidth={1.75} />
        {attentionCount}
      </Link>

      <LanguageToggle current={lang} />
    </header>
  );
}
