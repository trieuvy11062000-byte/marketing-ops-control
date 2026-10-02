"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  CheckSquare,
  Store,
  Radio,
  Landmark,
  Megaphone,
  FolderKanban,
  Percent,
  Tag,
  Database,
  Upload,
  Settings,
  Palette,
} from "lucide-react";
import type { Lang } from "@/lib/i18n";

const NAV_ITEMS = [
  { href: "/", en: "Dashboard", vi: "Bảng điều khiển", icon: LayoutDashboard },
  { href: "/week", en: "Calendar / Week", vi: "Lịch / Tuần", icon: CalendarRange },
  { href: "/quick-tasks", en: "Quick Tasks", vi: "Việc nhanh", icon: CheckSquare },
  { href: "/in-store", en: "In-store", vi: "Tại cửa hàng", icon: Store },
  { href: "/digital", en: "Digital", vi: "Digital", icon: Radio },
  { href: "/design", en: "Design Assets", vi: "Tài sản Design", icon: Palette },
  { href: "/ap", en: "A&P", vi: "A&P", icon: Landmark },
  { href: "/campaigns", en: "Activations", vi: "Chiến dịch", icon: Megaphone },
  { href: "/projects", en: "Projects", vi: "Dự án", icon: FolderKanban },
  { href: "/promotions", en: "Promotions", vi: "Khuyến mãi", icon: Percent },
  { href: "/brands", en: "Brands", vi: "Thương hiệu", icon: Tag },
  { href: "/master", en: "Master", vi: "Master", icon: Database },
  { href: "/import", en: "Import", vi: "Nhập liệu", icon: Upload },
  { href: "/settings", en: "Settings", vi: "Cài đặt", icon: Settings },
];

export function Sidebar({ lang }: { lang: Lang }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[230px] shrink-0 flex-col border-r border-glass-border bg-surface/60 px-3 py-4">
      <div className="px-3 pb-6">
        <div className="text-[15px] font-semibold tracking-tight">Longdan</div>
        <div className="text-[11px] font-mono-tag text-foreground-muted uppercase">
          {lang === "vi" ? "Điều hành Marketing" : "Marketing Ops Control"}
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                active
                  ? "bg-glass-surface text-foreground"
                  : "text-foreground-muted hover:text-foreground hover:bg-glass-surface/60"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-gradient-to-b from-[var(--accent-grad-start)] to-[var(--accent-grad-end)]" />
              )}
              <Icon size={16} strokeWidth={1.75} />
              <span>{lang === "vi" ? item.vi : item.en}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
