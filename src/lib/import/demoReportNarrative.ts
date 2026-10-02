import JSZip from "jszip";
import { PDFParse } from "pdf-parse";

function decodeXmlEntities(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Extracts paragraph-level text from a .docx buffer, joined for full-text
 *  storage/traceability (demo_weekly_sources). Not table-aware — fine here since
 *  nothing is parsed back out of this text; structured numeric data comes from
 *  the companion Excel workbook, and Executive Summary / actions are generated
 *  from calculated performance data, never extracted from this narrative. */
export async function extractDocxParagraphs(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file("word/document.xml");
  if (!file) return [];
  const xml = await file.async("string");
  const chunks = xml.split(/<w:p(?=[ >/])/).slice(1);
  return chunks
    .map((chunk) => {
      const matches = chunk.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
      return matches.map((m) => decodeXmlEntities(m.replace(/<[^>]+>/g, ""))).join("");
    })
    .filter((p) => p.trim() !== "");
}

// ── PDF extraction ───────────────────────────────────────────────────────────

export async function extractPdfPages(buffer: Buffer): Promise<string[]> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.pages.map((p) => p.text);
}

export interface ExtractedDemoAction {
  category: "START" | "STOP" | "CONTINUE";
  title: string;
  description: string;
  evidence: string | null;
}

/** Finds the START/STOP/CONTINUE slide in a page-text array and parses its
 *  items. Heuristic: within a category block, an ALL-CAPS line starts a new
 *  item (title); subsequent lines are its description; a short trailing line
 *  containing a digit is treated as the evidence line. Returns [] (not
 *  fabricated placeholders) when no such slide is found in the provided PDF. */
export function extractStartStopContinue(pages: string[]): ExtractedDemoAction[] {
  const pageIdx = pages.findIndex((p) => /\bSTART\b/.test(p) && /\bSTOP\b/.test(p) && /\bCONTINUE\b/.test(p));
  if (pageIdx === -1) return [];
  const lines = pages[pageIdx]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^-- \d+ of \d+ --$/.test(l))
    .filter((l) => !/^source:/i.test(l) && !/^longdan\s*\|/i.test(l));

  const isCategoryHeader = (l: string): "START" | "STOP" | "CONTINUE" | null => {
    if (l === "START") return "START";
    if (l === "STOP") return "STOP";
    if (l === "CONTINUE") return "CONTINUE";
    return null;
  };
  const isAllCapsTitle = (l: string): boolean => l.length > 4 && l === l.toUpperCase() && /[A-Z]/.test(l) && !/^\d+$/.test(l);
  const looksLikeEvidence = (l: string): boolean => /\d/.test(l) && l.length < 140;

  const actions: ExtractedDemoAction[] = [];
  let category: "START" | "STOP" | "CONTINUE" | null = null;
  let current: { title: string; lines: string[] } | null = null;

  function flush() {
    if (!current || !category) return;
    const bodyLines = [...current.lines];
    let evidence: string | null = null;
    if (bodyLines.length > 1 && looksLikeEvidence(bodyLines[bodyLines.length - 1])) {
      evidence = bodyLines.pop()!;
    }
    actions.push({ category, title: current.title, description: bodyLines.join(" "), evidence });
    current = null;
  }

  for (const line of lines) {
    const cat = isCategoryHeader(line);
    if (cat) {
      flush();
      category = cat;
      continue;
    }
    if (!category) continue; // skip slide title/intro lines before the first category header
    if (isAllCapsTitle(line)) {
      flush();
      current = { title: line, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  return actions;
}

// ── Action condensing — turn a verbose extracted card into ONE short sentence ──
// Rule: max ~20 words, "Brand[ @ Store] — action" shape, no methodology/narrative.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Finds the first (longest) name from `candidates` that appears as a whole word
 *  in `text`. Longer names are tried first so e.g. "Ajinomoto Cooking & Serve"
 *  doesn't get missed in favour of a shorter partial token. */
function detectName(text: string, candidates: string[]): string | null {
  const sorted = [...new Set(candidates.filter(Boolean))].sort((a, b) => b.length - a.length);
  const lower = text.toLowerCase();
  for (const c of sorted) {
    const re = new RegExp(`\\b${escapeRegExp(c.toLowerCase())}\\b`);
    if (re.test(lower)) return c;
  }
  return null;
}

/** Removes a detected name from a sentence, including a leading preposition
 *  ("at Crawley" → "") and a trailing possessive ("Maidstone's" → "") so the
 *  remaining clause reads naturally rather than leaving "at based on..." or
 *  "'s session..." artifacts. */
function stripName(text: string, name: string | null): string {
  if (!name) return text;
  const escaped = escapeRegExp(name);
  let out = text.replace(new RegExp(`\\b(at|in|for|of)\\s+${escaped}('s)?\\b`, "gi"), "");
  out = out.replace(new RegExp(`\\b${escaped}('s)?\\b`, "gi"), "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ");
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export interface CondensedAction {
  category: "START" | "STOP" | "CONTINUE";
  title: string; // "Brand" or "Brand @ Store" — short label
  description: string; // one short action clause, no trailing period
  evidence: string | null;
}

/** Condenses a verbose extracted action card into one short, operational
 *  sentence: Brand[ @ Store] — action. Never copies the full report paragraph;
 *  the source report remains available separately for full context.
 *  `storeToBrand` fills in the brand when a store is detected but the card's
 *  own text never names its brand — derived from this week's own session
 *  data, never invented. */
export function condenseAction(raw: ExtractedDemoAction, knownBrands: string[], knownStores: string[], storeToBrand: Map<string, string> = new Map()): CondensedAction {
  const blob = `${raw.title} ${raw.description} ${raw.evidence ?? ""}`;
  const store = detectName(raw.title, knownStores) ?? detectName(blob, knownStores);
  const brand = detectName(raw.title, knownBrands) ?? detectName(blob, knownBrands) ?? (store ? (storeToBrand.get(store) ?? null) : null);

  // Build the action clause from the description (a real sentence), falling
  // back to the title if stripping leaves nothing useful.
  let action = stripName(stripName(raw.description || raw.title, brand), store);
  if (action.split(/\s+/).filter(Boolean).length < 2) {
    action = stripName(stripName(raw.title, brand), store);
  }
  action = lowerFirst(action.replace(/\.$/, ""));
  action = truncateWords(action, 16);

  const label = brand ? (store ? `${brand} @ ${store}` : brand) : store ? `@ ${store}` : raw.title;

  return { category: raw.category, title: label, description: action, evidence: raw.evidence };
}

/** Consolidates duplicate/near-duplicate cards (same brand+store label within a
 *  category) and keeps only the highest-priority items, per category. */
export function consolidateActions(actions: CondensedAction[], maxPerCategory = 5): CondensedAction[] {
  const byCategory = new Map<string, CondensedAction[]>();
  for (const a of actions) {
    const key = `${a.category}__${a.title.toLowerCase()}`;
    const list = byCategory.get(a.category) ?? [];
    if (!list.some((x) => `${x.category}__${x.title.toLowerCase()}` === key)) list.push(a);
    byCategory.set(a.category, list);
  }
  const out: CondensedAction[] = [];
  for (const list of byCategory.values()) out.push(...list.slice(0, maxPerCategory));
  return out;
}

// ── Week detection (shared regex, content-based) ────────────────────────────

export function detectWeekFromText(text: string): string | null {
  const m = text.match(/WEEK\s*(\d{1,2})/i) ?? text.match(/\bW(\d{1,2})\b/);
  return m ? `W${m[1].padStart(2, "0")}` : null;
}
