"use client";

import { useTransition } from "react";
import { setLangAction } from "@/lib/i18nActions";
import type { Lang } from "@/lib/i18n";

export function LanguageToggle({ current }: { current: Lang }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="font-mono-tag glass shrink-0 flex items-center rounded-xl overflow-hidden text-[11px]">
      {(["en", "vi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => setLangAction(l))}
          className={`px-2.5 py-2 uppercase font-medium transition-colors ${
            current === l ? "bg-glass-surface-strong text-foreground" : "text-foreground-muted hover:bg-glass-surface"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
