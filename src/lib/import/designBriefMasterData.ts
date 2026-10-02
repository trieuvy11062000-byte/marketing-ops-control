import type Database from "better-sqlite3";
import { slugify } from "./utils";

// ── Portfolio vs Brand classification ───────────────────────────────────────
// Supplier/Portfolio groupings (e.g. "KFood", "ABC Trading Ltd") must never be
// treated as a Brand, Category or Campaign — they contain many Brands.

const SUPPLIER_PATTERN = /\b(ltd|co\.?|corp\.?|company|corporation|trading|manufacturing|distribution|distributors?|enterprises?|holdings?|industries|joint\s+stock|import.?export|sdn\s+bhd)\b/i;
const SUP_CODE_RE = /^sup\s*\d+$/i;
const PORTFOLIO_TERMS = new Set(["kfood", "k-food", "k food"]);

export function classifyBrandCandidate(name: string): "BRAND" | "PORTFOLIO" {
  const norm = name.trim().toLowerCase();
  if (!norm) return "BRAND";
  if (SUP_CODE_RE.test(norm)) return "PORTFOLIO";
  if (PORTFOLIO_TERMS.has(norm)) return "PORTFOLIO";
  if (SUPPLIER_PATTERN.test(name)) return "PORTFOLIO";
  return "BRAND";
}

export function upsertPortfolio(db: Database.Database, name: string, sourceTag: string): string {
  const id = slugify(name);
  db.prepare(`INSERT INTO portfolios (id, name, source_tag) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING`).run(id, name, sourceTag);
  return id;
}

export function upsertCategory(db: Database.Database, name: string): string {
  const id = slugify(name);
  db.prepare(`INSERT INTO categories (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING`).run(id, name);
  return id;
}

export function linkBrandCategory(db: Database.Database, brandId: string, categoryId: string): void {
  db.prepare(`INSERT INTO brand_categories (brand_id, category_id) VALUES (?, ?) ON CONFLICT DO NOTHING`).run(brandId, categoryId);
}

/** A source "Category" cell only counts as a real product Category (for
 *  brand_categories / design_assets.category_id) when it reads like a product
 *  classification, not a creative variant. Generic-enough to apply to any
 *  future file: short, no instructional language (already filtered upstream),
 *  and not itself a known asset-type word. */
export function looksLikeCategory(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 40) return false;
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  return wordCount <= 5;
}

// ── Brand inference from product name prefixes ──────────────────────────────
// Product names in these source files follow "{BRAND IN CAPS} {Description} {size}"
// e.g. "DONGWON Tuna with BBQ Sauce 135g", "CJ BIBIGO Chonggak Kimchi 450g",
// "A+ Fresh Soba Noodle Pack 180g". Extracting the leading all-caps/symbol run
// before the first Title-Case word gives a strong, generic brand candidate.

const GENERIC_PREFIX_WORDS = new Set(["the", "new", "fresh", "frozen", "premium", "original", "supporting item"]);

export function extractBrandPrefix(name: string | null): string | null {
  if (!name) return null;
  const cleaned = name.replace(/^\(supporting item\)\s*/i, "").trim();
  const m = cleaned.match(/^([A-Z][A-Z0-9&+'.]*(?:\s+[A-Z][A-Z0-9&+'.]*){0,2})(?=\s+[A-Z][a-z])/);
  if (!m) return null;
  const candidate = m[1].trim();
  if (candidate.length < 2) return null;
  if (GENERIC_PREFIX_WORDS.has(candidate.toLowerCase())) return null;
  return candidate;
}

/** Infers a single Brand for an asset only when EVERY product on it shares the
 *  same extracted brand prefix — a multi-brand shared asset (e.g. a whole-range
 *  Shelf Strip) stays unattributed at Brand level rather than guessing one. */
export function inferBrandFromProducts(products: { name: string | null }[]): string | null {
  if (products.length === 0) return null;
  const prefixes = products.map((p) => extractBrandPrefix(p.name));
  if (prefixes.some((p) => !p)) return null;
  const unique = [...new Set(prefixes)];
  return unique.length === 1 ? unique[0] : null;
}

// ── Month Ledger ─────────────────────────────────────────────────────────────

const MONTH_ABBR_TO_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_NUM_TO_LABEL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Detects Year + Month from the workbook's own file name (e.g. "OCT-26 Design
 *  Brief.xlsx" -> October 2026) — the most reliable generic signal since these
 *  files are always named after the month they cover. Falls back to scanning
 *  sheet header dates when the filename doesn't match. */
export function detectMonthFromFileName(fileName: string): { year: number; month: number } | null {
  const m = fileName.match(/([A-Za-z]{3})[\s_-]?(\d{2,4})/);
  if (!m) return null;
  const abbr = m[1].toLowerCase();
  const monthNum = MONTH_ABBR_TO_NUM[abbr];
  if (!monthNum) return null;
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;
  return { year, month: monthNum };
}

export function monthId(year: number, month: number): string {
  return `M-${year}-${String(month).padStart(2, "0")}`;
}

export function upsertMonthLedger(db: Database.Database, year: number, month: number): string {
  const id = monthId(year, month);
  const label = `${MONTH_NUM_TO_LABEL[month - 1]} ${year}`;
  db.prepare(
    `INSERT INTO months (id, year, month_number, month_label, status) VALUES (?, ?, ?, ?, 'IMPORTED')
     ON CONFLICT(id) DO UPDATE SET last_updated = datetime('now')`
  ).run(id, year, month, label);
  return id;
}
