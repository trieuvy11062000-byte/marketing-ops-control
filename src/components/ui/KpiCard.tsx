import Link from "next/link";

const ACCENT: Record<string, string> = {
  neutral: "var(--blue-grey)",
  red: "var(--red)",
  amber: "var(--amber)",
  green: "var(--green)",
};

export function KpiCard({
  label,
  value,
  href,
  accent = "neutral",
}: {
  label: string;
  value: number;
  href: string;
  accent?: "neutral" | "red" | "amber" | "green";
}) {
  return (
    <Link
      href={href}
      className="glass rounded-2xl px-4 py-3.5 flex flex-col gap-1 hover:bg-glass-surface-strong transition-colors"
    >
      <div className="font-mono-tag text-[28px] leading-none font-bold" style={{ color: value > 0 ? ACCENT[accent] : "var(--foreground)" }}>
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-foreground-muted font-medium">{label}</div>
    </Link>
  );
}
