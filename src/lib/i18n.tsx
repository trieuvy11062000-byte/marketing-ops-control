import { cookies } from "next/headers";

export type Lang = "en" | "vi";
export const LANG_COOKIE = "longdan_lang";

/** Reads the visitor's language preference from a cookie — defaults to English.
 *  Server Components call this once per page and pass `lang` down; nothing
 *  here mutates data, so it's safe to call from any server context. */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return store.get(LANG_COOKIE)?.value === "vi" ? "vi" : "en";
}

/** Plain-string swap — for contexts where JSX can't be used (title/aria-label/
 *  placeholder attributes, <option> text). EN returns the English string as-is;
 *  VI returns the Vietnamese string. Standard English business terms (Golden
 *  Week, A&P, Demo, SKU...) should be passed the same in both `en` and `vi`. */
export function ts(lang: Lang, en: string, vi: string): string {
  return lang === "vi" ? vi : en;
}

/** Stacked swap for prominent chrome (page headers, section intros, long
 *  descriptions) — VI becomes the primary line with EN as a smaller secondary
 *  line underneath; EN mode shows only the English line. Not for dense UI
 *  (nav items, table headers, badges) — use `ts` there to avoid breaking tight
 *  layouts; use this only for text in headers / standalone paragraph flow. */
export function tt(lang: Lang, en: string, vi: string, secondaryClassName = "block text-[11px] font-normal text-foreground-muted mt-0.5") {
  if (lang === "en") return <>{en}</>;
  return (
    <>
      {vi}
      <span className={secondaryClassName}>{en}</span>
    </>
  );
}
