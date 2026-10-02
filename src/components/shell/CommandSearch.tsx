"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

interface SearchGroup {
  label: string;
  items: { title: string; subtitle?: string; href: string }[];
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setGroups([]);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setGroups(data.groups ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 150);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setGroups([]);
    router.push(href);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const first = groups[0]?.items[0];
    if (first) go(first.href);
    else if (query.trim()) go(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] text-foreground-muted hover:text-foreground transition-colors w-full max-w-md"
      >
        <Search size={15} strokeWidth={1.75} />
        <span className="truncate">Search W41, Acecook, Demo, overdue…</span>
        <span className="ml-auto font-mono-tag text-[10.5px] rounded border border-glass-border px-1.5 py-0.5 shrink-0">
          ⌘K
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="glass-strong w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={onSubmit} className="flex items-center gap-2.5 px-4 py-3 border-b border-glass-border">
              <Search size={16} strokeWidth={1.75} className="text-foreground-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search W41, Acecook, Demo, Thy, overdue…"
                className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-foreground-muted"
              />
              <button type="button" onClick={() => setOpen(false)} className="text-foreground-muted hover:text-foreground">
                <X size={16} />
              </button>
            </form>

            <div className="max-h-[55vh] overflow-y-auto py-2">
              {groups.length === 0 && query && (
                <div className="px-4 py-6 text-center text-[12.5px] text-foreground-muted">No matches yet</div>
              )}
              {groups.map((g) => (
                <div key={g.label} className="px-2 py-1.5">
                  <div className="px-2.5 py-1 text-[10.5px] uppercase tracking-wide text-foreground-muted font-mono-tag">
                    {g.label}
                  </div>
                  {g.items.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => go(item.href)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-glass-surface transition-colors"
                    >
                      <span>{item.title}</span>
                      {item.subtitle && <span className="font-mono-tag text-[11px] text-foreground-muted">{item.subtitle}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
