import * as XLSX from "xlsx";
import type { DesignBriefSheetKind } from "../db/types";

// ── Cell / row helpers ──────────────────────────────────────────────────────

function text(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\r\n/g, "\n").trim();
}

function norm(v: unknown): string {
  return text(v).toLowerCase().replace(/\s+/g, " ").trim();
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((c) => text(c) === "");
}

function firstNonEmpty(row: unknown[], fromIdx: number): string {
  for (let i = fromIdx; i < row.length; i++) {
    const t = text(row[i]);
    if (t) return t;
  }
  return "";
}

// ── Header block (Campaign / Brand / Period / Deadline) ────────────────────

export interface HeaderBlock {
  campaignName: string | null;
  theme: string | null;
  cuisine: string | null;
  periodRaw: string | null;
  productImage: string | null;
  deadlineRaw: string | null; // "Deadline" label — DESIGN DEADLINE, never campaign end
  campaignCode: string | null;
  submissionDeadlineRaw: string | null;
  startRaw: string | null;
  endRaw: string | null;
  aAndP: string | null;
  collection: string | null;
  monthRaw: string | null;
  headerRowsConsumed: number; // how many leading rows were part of the header block
}

const LABEL_VALUE_MATCHERS: { test: RegExp; field: keyof HeaderBlock }[] = [
  { test: /^campaign name/i, field: "campaignName" },
  { test: /^theme/i, field: "theme" },
  { test: /^cuisine/i, field: "cuisine" },
  { test: /^timeline|^period$/i, field: "periodRaw" },
  { test: /^month$/i, field: "monthRaw" },
  { test: /^product image|^link h[ìi]nh|^link$/i, field: "productImage" },
  { test: /^deadline/i, field: "deadlineRaw" },
  { test: /^a ?& ?p/i, field: "aAndP" },
  { test: /^collection/i, field: "collection" },
];

const PAIRED_HEADER_KEYS: { test: RegExp; field: keyof HeaderBlock }[] = [
  { test: /^campaign code/i, field: "campaignCode" },
  { test: /^submission deadline/i, field: "submissionDeadlineRaw" },
  { test: /^start day|^start$/i, field: "startRaw" },
  { test: /^end day|^end$/i, field: "endRaw" },
];

/** Scans the first ~14 rows for the two known header patterns: simple label:value
 *  rows, and a paired header-row + value-row (Campaign Code / Submission Deadline /
 *  Start Day / End Day). Never guesses values — only captures what's explicitly labeled. */
export function extractHeaderBlock(rows: unknown[][]): HeaderBlock {
  const block: HeaderBlock = {
    campaignName: null, theme: null, cuisine: null, periodRaw: null, productImage: null,
    deadlineRaw: null, campaignCode: null, submissionDeadlineRaw: null, startRaw: null,
    endRaw: null, aAndP: null, collection: null, monthRaw: null, headerRowsConsumed: 0,
  };

  const scanLimit = Math.min(rows.length, 14);
  let lastConsumed = 0;

  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r] ?? [];
    const col0 = norm(row[0]);
    if (!col0) continue;

    const simple = LABEL_VALUE_MATCHERS.find((m) => m.test.test(col0));
    if (simple && block[simple.field] == null) {
      const val = firstNonEmpty(row, 1);
      if (val) (block[simple.field] as string | null) = val;
      lastConsumed = r + 1;
      continue;
    }

    // Paired header row: ≥2 cells match the Campaign Code/Submission Deadline/Start/End set
    const matches = row
      .map((c, idx) => ({ idx, field: PAIRED_HEADER_KEYS.find((m) => m.test.test(norm(c)))?.field }))
      .filter((m) => m.field);
    if (matches.length >= 2) {
      const valueRow = rows[r + 1] ?? [];
      for (const m of matches) {
        const val = text(valueRow[m.idx!]);
        if (val && m.field && block[m.field] == null) (block[m.field] as string | null) = val;
      }
      lastConsumed = r + 2;
      r += 1; // skip the value row
      continue;
    }
  }

  block.headerRowsConsumed = lastConsumed;
  return block;
}

// ── Asset type canonicalisation ─────────────────────────────────────────────

export interface CanonicalAsset {
  assetType: string;
  channel: string;
  channelSubtype?: string | null;
  confidence: "HIGH" | "NEEDS MAPPING";
}

/** Maps one raw format fragment to one or more canonical design assets. Combined
 *  formats ("Banner desk+mobile", "Social Post/Story") are split here per rule 4. */
export function canonicalizeFragment(fragmentRaw: string): CanonicalAsset[] {
  const f = fragmentRaw.toLowerCase();
  const HIGH = "HIGH" as const;

  if (/roller banner|standee/.test(f)) return [{ assetType: "Roller Banner", channel: "FIXTURE/BRANDING", confidence: HIGH }];
  if (/promotional frame/.test(f)) return [{ assetType: "Promotional Frame", channel: "SOCIAL", confidence: HIGH }];
  if (/\btvcs?\b/.test(f)) return [{ assetType: "TVC", channel: "DIGITAL", channelSubtype: "IN-STORE SCREEN", confidence: HIGH }];

  if (/banner/.test(f)) {
    const out: CanonicalAsset[] = [];
    const hasDesktop = /desk/.test(f);
    const hasMobile = /mobile/.test(f);
    if (hasDesktop || !hasMobile) out.push({ assetType: "Website Banner — Desktop", channel: "WEBSITE", confidence: HIGH });
    if (hasMobile || !hasDesktop) out.push({ assetType: "Website Banner — Mobile", channel: "WEBSITE", confidence: HIGH });
    return out;
  }

  if (/social|\bstory\b/.test(f)) {
    const out: CanonicalAsset[] = [];
    const hasPost = /post/.test(f);
    const hasStory = /story/.test(f);
    if (hasPost || !hasStory) out.push({ assetType: "Social Post", channel: "SOCIAL", confidence: HIGH });
    if (hasStory) out.push({ assetType: "Social Story", channel: "SOCIAL", confidence: HIGH });
    return out;
  }

  if (/wobbler/.test(f)) return [{ assetType: "Wobbler", channel: "IN-STORE", confidence: HIGH }];
  if (/shelf strip/.test(f)) return [{ assetType: "Shelf Strip", channel: "IN-STORE", confidence: HIGH }];
  if (/tent ?card/.test(f)) return [{ assetType: "Tent Card", channel: "DEMO", confidence: HIGH }];
  if (/poster/.test(f)) return [{ assetType: "Poster", channel: "IN-STORE", confidence: HIGH }];
  if (/landing page/.test(f)) return [{ assetType: "Landing Page", channel: "WEBSITE", confidence: HIGH }];
  if (/\benew\b|pdf enew/.test(f)) return [{ assetType: "Email/eNews Asset", channel: "EMAIL", confidence: HIGH }];
  if (/email/.test(f)) return [{ assetType: "Email/eNews Asset", channel: "EMAIL", confidence: HIGH }];
  if (/apron/.test(f)) return [{ assetType: "Apron", channel: "OTHER", confidence: HIGH }];
  if (/table runner/.test(f)) return [{ assetType: "Table Runner", channel: "OTHER", confidence: HIGH }];
  if (/key ?chain/.test(f)) return [{ assetType: "Keychain", channel: "OTHER", confidence: HIGH }];
  if (/promotion tag/.test(f)) return [{ assetType: "Promotion Tag", channel: "PROMOTION SUPPORT", confidence: HIGH }];
  if (/branding tag/.test(f)) return [{ assetType: "Branding Tag", channel: "PROMOTION SUPPORT", confidence: HIGH }];
  if (/gondola/.test(f)) return [{ assetType: "Gondola Artwork", channel: "FIXTURE/BRANDING", confidence: HIGH }];
  if (/display/.test(f)) return [{ assetType: "Display Material", channel: "IN-STORE", confidence: HIGH }];
  if (/promotion label|price.*label|price tag/.test(f)) return [{ assetType: "Promotion Price Label", channel: "PROMOTION SUPPORT", confidence: HIGH }];
  if (/cooking|using instruction/.test(f)) return []; // operational info, not a design asset — rule 17

  // Unrecognised fragments that read as a note/instruction, a size/spec aside
  // ("Size <1000 KB"), or a file-path reference are never a real asset type —
  // they're stray text swept into the Format cell. Dropped, not fabricated
  // into a NEEDS-MAPPING asset_type (the parent format fragment on the same
  // cell, if any, still gets created normally).
  if (looksLikeInstruction(fragmentRaw)) return [];
  if (/^size\s*[<>=]/i.test(fragmentRaw.trim())) return [];
  if (/^[a-z]:\\|^\\\\/i.test(fragmentRaw.trim())) return [];

  return [{ assetType: fragmentRaw.trim(), channel: "OTHER", confidence: "NEEDS MAPPING" }];
}

/** Splits a raw Format/Request-Design-Format cell into fragments, then canonicalises each. */
export function splitAndCanonicalize(raw: string): CanonicalAsset[] {
  let working = raw.trim();
  const parenMatch = working.match(/\(([^)]+)\)\s*$/);
  if (parenMatch && parenMatch[1].includes(",")) working = parenMatch[1];

  // Instruction-ness is checked per LINE, before comma-splitting — a note like
  // "*Please note to include X, similar to Y" must never be chopped into
  // comma fragments that individually dodge the instruction check.
  const fragments = working
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .flatMap((line) => (looksLikeInstruction(line) ? [] : line.split(",")))
    .map((s) => s.trim())
    .filter(Boolean);

  const pieces = fragments.length > 0 ? fragments : [raw.trim()];
  return pieces.flatMap(canonicalizeFragment);
}

// ── Content field extraction (best-effort, never invents) ──────────────────

export interface ContentFields {
  headline: string | null;
  secondaryMessage: string | null;
  cta: string | null;
}

export function parseContentFields(raw: string): ContentFields {
  const out: ContentFields = { headline: null, secondaryMessage: null, cta: null };
  if (!raw) return out;
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const h = line.match(/^(title|tittle|headline|main hook\s*\(hero\)|main line)\s*[:\-–]\s*(.+)$/i);
    if (h && !out.headline) out.headline = h[2].trim();
    const c = line.match(/^cta\s*[:\-–]\s*(.+)$/i);
    if (c && !out.cta) out.cta = c[1].trim();
    const s = line.match(/^(secondary message|sub)\s*[:\-–]\s*(.+)$/i);
    if (s && !out.secondaryMessage) out.secondaryMessage = s[2].trim();
  }
  return out;
}

/** Detects a promotion channel mentioned inside free-text content/promotion copy.
 *  Never fabricates one when the text doesn't say — returns null. */
export function detectPromotionChannel(...texts: (string | null)[]): string | null {
  const joined = texts.filter(Boolean).join(" \n ").toLowerCase();
  if (!joined) return null;
  if (/in-?store only|instore only/.test(joined)) return "IN-STORE";
  if (/online (retail )?only|online only/.test(joined)) return "ONLINE RETAIL";
  if (/bulk|wholesale|case deal/.test(joined)) return "BULK/WHOLESALE";
  if (/last mile/.test(joined)) return "LAST MILE";
  return null;
}

// ── Table region detection ──────────────────────────────────────────────────

export type TablePattern =
  | "FORMAT_TABLE"
  | "SECTION_BLOCK"
  | "SECTION_BRIEF"
  | "LABEL_TAG"
  | "SKU_LABEL"
  | "DEMO_TABLE"
  | "EMAIL_TABLE"
  | "OPERATIONAL_INFO"
  | "NONE";

export interface ColumnMap {
  format?: number;
  content?: number;
  promotion?: number;
  themeRef?: number;
  note?: number;
  category?: number;
  code?: number;
  productName?: number;
  section?: number;
  brief?: number;
  tag?: number;
  ref?: number;
  supplierBrand?: number;
  owner?: number;
  deadline?: number;
  item?: number;
  schedule?: number;
  allergy?: number;
  requestFormat?: number;
  price?: number;
  shop?: number;
  validUntil?: number;
  cookingGuideline?: number;
}

function findColByKeywords(row: unknown[], ...keywordSets: RegExp[]): number | undefined {
  for (let i = 0; i < row.length; i++) {
    const n = norm(row[i]);
    if (!n) continue;
    if (keywordSets.some((re) => re.test(n))) return i;
  }
  return undefined;
}

export interface TableRegion {
  pattern: TablePattern;
  headerRowIdx: number;
  cols: ColumnMap;
}

/** Some Format-table headers leave the Category/Code/Product-name sub-columns
 *  unlabeled (merged-cell visual layout, only the major columns get text). When
 *  that gap exists between Format and the next labeled column, infer those slots
 *  positionally — Category, Code, Product name, in that order. Never overrides an
 *  explicitly-labeled column. */
function inferBlankSubColumns(cols: ColumnMap): ColumnMap {
  if (cols.format == null) return cols;
  if (cols.category != null || cols.code != null || cols.productName != null) return cols;
  const candidates = [cols.content, cols.promotion, cols.themeRef, cols.note].filter((x): x is number => x != null);
  if (candidates.length === 0) return cols;
  const nextLabeled = Math.min(...candidates);
  const gap = nextLabeled - cols.format - 1;
  if (gap < 2) return cols;
  const out = { ...cols };
  if (gap >= 3) {
    out.category = cols.format + 1;
    out.code = cols.format + 2;
    out.productName = cols.format + 3;
  } else {
    out.code = cols.format + 1;
    out.productName = cols.format + 2;
  }
  return out;
}

/** Scans rows (from startRow) for a recognisable table header row. Order matters:
 *  more specific patterns (operational info, demo, label-tag, section-brief) are
 *  checked before the generic FORMAT_TABLE / SKU_LABEL fallbacks. */
export function detectTableRegion(rows: unknown[][], startRow: number): TableRegion | null {
  for (let r = startRow; r < Math.min(rows.length, startRow + 40); r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) continue;

    const cookingGuideline = findColByKeywords(row, /cooking guideline/);
    if (cookingGuideline != null) {
      return { pattern: "OPERATIONAL_INFO", headerRowIdx: r, cols: { cookingGuideline } };
    }

    const supplierBrand = findColByKeywords(row, /^supplier\s*\/?\s*brand/);
    const owner = findColByKeywords(row, /^owner/);
    const requestFormat = findColByKeywords(row, /request design format/);
    if (supplierBrand != null || (owner != null && requestFormat != null)) {
      return {
        pattern: "DEMO_TABLE",
        headerRowIdx: r,
        cols: {
          supplierBrand, owner,
          deadline: findColByKeywords(row, /^deadline/),
          code: findColByKeywords(row, /product code/),
          item: findColByKeywords(row, /^item$/),
          promotion: findColByKeywords(row, /^promotion/),
          content: findColByKeywords(row, /design content/),
          schedule: findColByKeywords(row, /^schedule/),
          note: findColByKeywords(row, /^note/),
          allergy: findColByKeywords(row, /allergy/),
          requestFormat,
        },
      };
    }

    const section = findColByKeywords(row, /^section/);
    const brief = findColByKeywords(row, /^brief/);
    if (section != null && brief != null) {
      return { pattern: "SECTION_BRIEF", headerRowIdx: r, cols: { section, brief, note: findColByKeywords(row, /^note/) } };
    }

    const tag = findColByKeywords(row, /^tag/);
    const tagContent = findColByKeywords(row, /^content/);
    if (tag != null && tagContent != null && findColByKeywords(row, /^format/) == null) {
      return { pattern: "LABEL_TAG", headerRowIdx: r, cols: { tag, content: tagContent, ref: findColByKeywords(row, /^ref/), note: findColByKeywords(row, /^note/) } };
    }

    const format = findColByKeywords(row, /^format/);
    const content = findColByKeywords(row, /^content/);
    const promotion = findColByKeywords(row, /^promotion/);
    if (format != null && (content != null || promotion != null)) {
      return {
        pattern: "FORMAT_TABLE",
        headerRowIdx: r,
        cols: inferBlankSubColumns({
          format, content, promotion,
          themeRef: findColByKeywords(row, /theme ?ref/),
          note: findColByKeywords(row, /^note/),
          category: findColByKeywords(row, /^categor/),
          code: findColByKeywords(row, /^code$|product code/),
          productName: findColByKeywords(row, /product name|^name$|^item$|^product$/),
        }),
      };
    }

    const emailCode = findColByKeywords(row, /product code/);
    const emailName = findColByKeywords(row, /product name/);
    const emailContent = findColByKeywords(row, /content/);
    if (emailCode != null && emailName != null && emailContent != null) {
      return {
        pattern: "EMAIL_TABLE",
        headerRowIdx: r,
        cols: { code: emailCode, productName: emailName, content: emailContent, category: findColByKeywords(row, /categor/) },
      };
    }

    const code = findColByKeywords(row, /^code$/);
    const price = findColByKeywords(row, /^price$| price /);
    if (code != null && (price != null || findColByKeywords(row, /^promotion/) != null)) {
      return {
        pattern: "SKU_LABEL",
        headerRowIdx: r,
        cols: {
          code, price,
          productName: findColByKeywords(row, /^name$/),
          promotion: findColByKeywords(row, /^promotion/),
          shop: findColByKeywords(row, /^shop$|applied/),
          validUntil: findColByKeywords(row, /valid until|^end$/),
        },
      };
    }

    // Siukay-style: a row whose ONLY non-empty cell is a known asset-type keyword —
    // marks the start of a section-block region (mini-table follows on next 1-2 rows).
    // Excludes folder paths / URLs, which can coincidentally contain a keyword
    // (e.g. a "...\Dongwon Gondola" path matching "gondola").
    const onlyCell = row.filter((c) => text(c) !== "");
    if (onlyCell.length === 1) {
      const cellText = text(onlyCell[0]);
      const looksLikePath = /\\|^https?:\/\/|^[A-Za-z]:[\\/]/.test(cellText);
      if (!looksLikePath) {
        const canon = canonicalizeFragment(cellText);
        if (canon.length > 0 && canon[0].confidence === "HIGH") {
          return { pattern: "SECTION_BLOCK", headerRowIdx: r, cols: {} };
        }
      }
    }
  }
  return null;
}

// ── Parsed output shapes ─────────────────────────────────────────────────────

export interface ParsedProduct {
  code: string | null;
  name: string | null;
  group: string | null;
  roleNote: string | null;
  sourceRowRef: string;
}

export interface ParsedDesignAsset {
  assetType: string;
  variantLabel: string | null;
  channel: string;
  channelSubtype: string | null;
  formatRaw: string | null;
  headline: string | null;
  secondaryMessage: string | null;
  cta: string | null;
  contentRaw: string;
  promotionMechanic: string | null;
  promotionChannel: string | null;
  validFrom: string | null;
  validUntil: string | null;
  designDeadline: string | null;
  brandingRequirement: string | null;
  themeRef: string | null;
  designNote: string | null;
  reusableTemplate: boolean;
  fixtureParent: string | null;
  products: ParsedProduct[];
  confidence: "HIGH" | "NEEDS MAPPING" | "UNCLEAR";
  sourceRowRef: string;
}

/** Pulls "Valid from X" / "Valid until Y" / "1st-31st May 2026" style ranges out of
 *  free text. Best-effort only — never invents a date the text doesn't state. */
function extractValidity(...texts: (string | null)[]): { validFrom: string | null; validUntil: string | null } {
  const joined = texts.filter(Boolean).join(" \n ");
  const m = joined.match(/valid(?:\s+from)?\s+(\d{1,2}(?:st|nd|rd|th)?[–\-\s]*(?:\d{1,2}(?:st|nd|rd|th)?)?[,\s]*[A-Za-z]+\s+\d{4})/i);
  if (m) return { validFrom: m[1].trim(), validUntil: null };
  return { validFrom: null, validUntil: null };
}

function makeAsset(params: {
  canon: CanonicalAsset;
  variantLabel: string | null;
  formatRaw: string | null;
  contentRaw: string;
  promotionMechanic: string | null;
  note: string | null;
  themeRef: string | null;
  designDeadline?: string | null;
  fixtureParent?: string | null;
  reusableTemplate?: boolean;
  sourceRowRef: string;
}): ParsedDesignAsset {
  const contentFields = parseContentFields(params.contentRaw);
  const validity = extractValidity(params.contentRaw, params.promotionMechanic);
  const promotionChannel = detectPromotionChannel(params.contentRaw, params.promotionMechanic);
  return {
    assetType: params.canon.assetType,
    variantLabel: params.variantLabel,
    channel: params.canon.channel,
    channelSubtype: params.canon.channelSubtype ?? null,
    formatRaw: params.formatRaw,
    headline: contentFields.headline,
    secondaryMessage: contentFields.secondaryMessage,
    cta: contentFields.cta,
    contentRaw: params.contentRaw,
    promotionMechanic: params.promotionMechanic,
    promotionChannel,
    validFrom: validity.validFrom,
    validUntil: validity.validUntil,
    designDeadline: params.designDeadline ?? null,
    brandingRequirement: /logo|brand/i.test(params.note ?? "") ? params.note : null,
    themeRef: params.themeRef,
    designNote: params.note,
    reusableTemplate: params.reusableTemplate ?? false,
    fixtureParent: params.fixtureParent ?? null,
    products: [],
    confidence: params.canon.confidence,
    sourceRowRef: params.sourceRowRef,
  };
}

const SKU_CODE_RE = /^\d{4,9}$/;

/** Distinguishes a real creative/product Variant (e.g. "Soju", "Kimchi",
 *  "STREET FOOD HOT PICKS") from a Design Note/Instruction that was parsed
 *  into the same cell (e.g. "1 design. pick mỗi category 1 hình sản phẩm",
 *  "Add KFood logo", "Use supplied artwork"). Never put instructions into
 *  Brand/Variant/Product/Promotion/Campaign — rule from the Design Assets spec. */
function looksLikeInstruction(text: string): boolean {
  const t = text.trim().replace(/^["'*•\-]+\s*/, "");
  if (!t) return false;
  const lower = t.toLowerCase();
  if (/^(pick|add|use|follow|note|include|apply|keep|choose|select|only|please|remember|ensure|make sure|do not|don'?t)\b/.test(lower)) return true;
  if (/\d+\s*designs?\b/i.test(t)) return true; // "1 design", "1 design only"
  if (/[a-z]\.\s+\S/.test(t)) return true; // a genuine mid-sentence period, not just a trailing one
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount > 6 && /^[a-z]/.test(t)) return true; // long, lowercase-starting phrase
  return false;
}

/** Generic FORMAT_TABLE parser — covers the "Format | ... | Content | Promotion |
 *  Theme ref | Note" shape used across most sheets in this workbook (plain, with a
 *  Category column for product-group variants, or with Code/Product name columns).
 *  Carry-down rule: a new Format cell starts a new asset group; within a group, a
 *  new non-blank Category value (different from the current one) starts a new
 *  variant; blank cells inherit the current group/variant's values. Promotion is
 *  tracked per-product-row too, so per-SKU pricing is never lost even when the
 *  asset-level mechanic is a shared/representative value. */
export function parseFormatTableRows(rows: unknown[][], region: TableRegion, sheetName: string, fixtureParent: string | null): ParsedDesignAsset[] {
  const c = region.cols;
  const assets: ParsedDesignAsset[] = [];

  let groupCanon: CanonicalAsset[] = [];
  let groupFormatRaw: string | null = null;
  let variantLabel: string | null = null;
  let content = "";
  let note: string | null = null;
  let themeRef: string | null = null;
  let products: ParsedProduct[] = [];
  let promotionValues = new Set<string>();
  let firstRowRef = "";

  function flush() {
    if (groupCanon.length === 0) return;
    const promoList = [...promotionValues];
    const promotionMechanic = promoList.length === 0 ? null : promoList.length === 1 ? promoList[0] : "Multiple — see per-product";
    for (const canon of groupCanon) {
      const asset = makeAsset({
        canon, variantLabel, formatRaw: groupFormatRaw, contentRaw: content,
        promotionMechanic, note, themeRef, fixtureParent,
        sourceRowRef: firstRowRef || sheetName,
      });
      asset.products = products;
      assets.push(asset);
    }
  }

  function flushVariantOnly() {
    flush();
    products = [];
    promotionValues = new Set();
  }

  let consecutiveBlank = 0;
  for (let r = region.headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) {
      consecutiveBlank++;
      if (consecutiveBlank >= 3) break;
      continue;
    }
    consecutiveBlank = 0;

    const formatCell = c.format != null ? text(row[c.format]) : "";
    const promotionCell = c.promotion != null ? text(row[c.promotion]) : "";
    const noteCell = c.note != null ? text(row[c.note]) : "";
    const themeRefCell = c.themeRef != null ? text(row[c.themeRef]) : "";
    const codeCell = c.code != null ? text(row[c.code]) : "";
    const nameCell = c.productName != null ? text(row[c.productName]) : "";
    const rowRef = `${sheetName} row ${r + 1}`;

    // Shape-based content/category disambiguation: when the source's own header row
    // mislabels the Content column position for grouped rows (a merged-cell visual
    // quirk), the mapped "content" cell may actually hold a short category label
    // while the real content sits one column over. Only kicks in when category
    // wasn't separately mapped and the shapes disagree with the header's claim.
    let contentCell = c.content != null ? text(row[c.content]) : "";
    let categoryCell = c.category != null ? text(row[c.category]) : "";
    if (c.content != null && c.category == null) {
      const looksLikeContent = (s: string) => /\n|title:|tittle:|cta:|headline:/i.test(s) || s.length > 40;
      const next = text(row[c.content + 1] ?? "");
      if (contentCell && !looksLikeContent(contentCell) && looksLikeContent(next)) {
        categoryCell = contentCell;
        contentCell = next;
      }
    }

    // A "category"/variant cell that reads as an instruction (e.g. "1 design.
    // pick one product per category") is a Design Note, never a real Variant —
    // redirect it instead of storing it as variant_label.
    let categoryInstructionNote: string | null = null;
    if (categoryCell && looksLikeInstruction(categoryCell)) {
      categoryInstructionNote = categoryCell;
      categoryCell = "";
    }

    if (formatCell) {
      flush();
      groupCanon = splitAndCanonicalize(formatCell);
      groupFormatRaw = formatCell;
      variantLabel = categoryCell || null;
      content = contentCell;
      note = noteCell || categoryInstructionNote || null;
      themeRef = themeRefCell || null;
      products = [];
      promotionValues = new Set();
      firstRowRef = rowRef;
      if (promotionCell) promotionValues.add(promotionCell);
    } else if (categoryCell && categoryCell !== variantLabel) {
      flushVariantOnly();
      variantLabel = categoryCell;
      if (contentCell) content = contentCell;
      if (noteCell) note = noteCell;
      if (themeRefCell) themeRef = themeRefCell;
      firstRowRef = rowRef;
      if (promotionCell) promotionValues.add(promotionCell);
    } else {
      if (contentCell) content = content || contentCell;
      if (noteCell) note = note || noteCell;
      if (categoryInstructionNote) note = note ? `${note} | ${categoryInstructionNote}` : categoryInstructionNote;
      if (themeRefCell) themeRef = themeRef || themeRefCell;
      if (promotionCell) promotionValues.add(promotionCell);
    }

    if (groupCanon.length === 0) continue; // no format seen yet — stray row before first asset

    if (codeCell || nameCell) {
      products.push({
        code: SKU_CODE_RE.test(codeCell) ? codeCell : codeCell || null,
        name: nameCell || null,
        group: variantLabel,
        roleNote: promotionCell || null,
        sourceRowRef: rowRef,
      });
    }
  }
  flush();
  return assets;
}

interface MiniHeaderMap {
  code?: number;
  productName?: number;
  content?: number;
  note?: number;
  element?: number;
  level?: number;
}

function buildMiniHeaderMap(row: unknown[]): MiniHeaderMap {
  const map: MiniHeaderMap = {};
  for (let i = 0; i < row.length; i++) {
    const n = norm(row[i]);
    if (!n) continue;
    if (/products to feature/.test(n)) { map.code = i; map.productName = i + 1; continue; }
    if (/^content$/.test(n)) { map.content = i; continue; }
    if (/^note$/.test(n)) { map.note = i; continue; }
    if (/^element$/.test(n)) { map.element = i; continue; }
    if (/^level$/.test(n)) { map.level = i; continue; }
  }
  return map;
}

/** Siukay-style section blocks: a row whose only content is an asset-type keyword
 *  (e.g. "WOBBLER"), followed by a local mini-header row (Products to Feature /
 *  Element / Level + Content + Note), then data rows until the next section header. */
export function parseSectionBlockRows(rows: unknown[][], startRowIdx: number, sheetName: string, fixtureParent: string | null): ParsedDesignAsset[] {
  const assets: ParsedDesignAsset[] = [];
  let r = startRowIdx;

  while (r < rows.length) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) { r++; continue; }
    const nonEmpty = row.map((c, i) => ({ i, t: text(c) })).filter((x) => x.t !== "");
    if (nonEmpty.length !== 1) { r++; continue; }

    const headerText = nonEmpty[0].t;
    const canon = splitAndCanonicalize(headerText);
    if (canon.length === 0) { r++; continue; } // operational header (e.g. cooking instruction) — no asset

    const miniMap = buildMiniHeaderMap(rows[r + 1] ?? []);
    let content = "";
    let note: string | null = null;
    const products: ParsedProduct[] = [];
    const levelLines: string[] = [];

    let j = r + 2;
    for (; j < rows.length; j++) {
      const drow = rows[j] ?? [];
      if (isBlankRow(drow)) break;
      const dNonEmpty = drow.filter((c) => text(c) !== "");
      if (dNonEmpty.length === 1 && splitAndCanonicalize(text(dNonEmpty[0])).length > 0) break; // next section header

      if (miniMap.level != null) {
        const levelLabel = text(drow[miniMap.level]);
        const levelContent = miniMap.content != null ? text(drow[miniMap.content]) : "";
        if (levelLabel) levelLines.push(`${levelLabel}: ${levelContent}`);
        continue;
      }
      if (miniMap.element != null) {
        const elLabel = text(drow[miniMap.element]);
        const elContent = miniMap.content != null ? text(drow[miniMap.content]) : "";
        if (elLabel) levelLines.push(`${elLabel}: ${elContent}`);
        const noteCell = drow[2] != null ? text(drow[2]) : "";
        if (noteCell && noteCell !== elContent) note = note || noteCell;
        continue;
      }

      const codeCell = miniMap.code != null ? text(drow[miniMap.code]) : "";
      const nameCell = miniMap.productName != null ? text(drow[miniMap.productName]) : "";
      const contentCell = miniMap.content != null ? text(drow[miniMap.content]) : "";
      const noteCell = miniMap.note != null ? text(drow[miniMap.note]) : "";
      if (contentCell) content = content || contentCell;
      if (noteCell) note = note || noteCell;
      if (codeCell || nameCell) {
        products.push({ code: codeCell || null, name: nameCell || null, group: null, roleNote: null, sourceRowRef: `${sheetName} row ${j + 1}` });
      }
    }

    if (levelLines.length > 0) content = levelLines.join("\n");

    for (const canonAsset of canon) {
      const asset = makeAsset({
        canon: canonAsset, variantLabel: null, formatRaw: headerText, contentRaw: content,
        promotionMechanic: null, note, themeRef: null, fixtureParent,
        sourceRowRef: `${sheetName} row ${r + 1}`,
      });
      asset.products = products;
      assets.push(asset);
    }
    r = j;
  }
  return assets;
}

/** Acecook-LP-style Section|Brief|Note table — per rule 18, this is ONE Landing Page
 *  deliverable with multiple sub-components, never split into separate campaigns. */
export function parseSectionBriefRows(rows: unknown[][], region: TableRegion, sheetName: string, fixtureParent: string | null): ParsedDesignAsset[] {
  const c = region.cols;
  const lines: string[] = [];
  const notes: string[] = [];
  let consecutiveBlank = 0;

  for (let r = region.headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) { consecutiveBlank++; if (consecutiveBlank >= 3) break; continue; }
    consecutiveBlank = 0;
    const section = c.section != null ? text(row[c.section]) : "";
    const brief = c.brief != null ? text(row[c.brief]) : "";
    const note = c.note != null ? text(row[c.note]) : "";
    if (!section && !brief) continue;
    lines.push(`${section ? section + ": " : ""}${brief}`.trim());
    if (note) notes.push(note);
  }
  if (lines.length === 0) return [];

  const asset = makeAsset({
    canon: { assetType: "Landing Page", channel: "WEBSITE", confidence: "HIGH" },
    variantLabel: null, formatRaw: "Landing Page (multi-section)", contentRaw: lines.join("\n\n"),
    promotionMechanic: null, note: notes.length ? notes.join(" | ") : null, themeRef: null, fixtureParent,
    sourceRowRef: `${sheetName} row ${region.headerRowIdx + 2}`,
  });
  return [asset];
}

/** Promotion+Branding tag table — one asset per tag row, flagged REUSABLE TEMPLATE
 *  per rule 15 (these are print templates, not one-off campaign creative). */
export function parseLabelTagRows(rows: unknown[][], region: TableRegion, sheetName: string, fixtureParent: string | null): ParsedDesignAsset[] {
  const c = region.cols;
  const assets: ParsedDesignAsset[] = [];
  let consecutiveBlank = 0;

  for (let r = region.headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) { consecutiveBlank++; if (consecutiveBlank >= 3) break; continue; }
    consecutiveBlank = 0;
    const tagCell = c.tag != null ? text(row[c.tag]) : "";
    const contentCell = c.content != null ? text(row[c.content]) : "";
    const refCell = c.ref != null ? text(row[c.ref]) : "";
    const noteCell = c.note != null ? text(row[c.note]) : "";
    if (!tagCell) continue;

    const canon = canonicalizeFragment(tagCell);
    const scopeMatch = tagCell.match(/for (retail|bulk|case\/bulk item[^\n]*)/i);
    const variantLabel = scopeMatch ? scopeMatch[1].trim() : null;
    for (const canonAsset of canon) {
      const asset = makeAsset({
        canon: canonAsset, variantLabel, formatRaw: tagCell, contentRaw: [contentCell, refCell].filter(Boolean).join("\n"),
        promotionMechanic: null, note: noteCell || null, themeRef: null, fixtureParent,
        reusableTemplate: true, sourceRowRef: `${sheetName} row ${r + 1}`,
      });
      assets.push(asset);
    }
  }
  return assets;
}

/** Demo brief table — one asset group per Request-Design-Format value (blank means
 *  no design ask for that supplier's demo, per rule 17: schedule/allergy info alone
 *  is operational, not a design asset). */
export function parseDemoRows(rows: unknown[][], region: TableRegion, sheetName: string, fixtureParent: string | null): ParsedDesignAsset[] {
  const c = region.cols;
  const assets: ParsedDesignAsset[] = [];

  let supplier: string | null = null;
  let deadline: string | null = null;
  let requestFormatRaw: string | null = null;
  let content = "";
  let schedule: string | null = null;
  let products: ParsedProduct[] = [];
  let promotionValues = new Set<string>();
  let firstRowRef = "";

  function flush() {
    if (!requestFormatRaw) { products = []; promotionValues = new Set(); return; }
    const canon = splitAndCanonicalize(requestFormatRaw);
    const promoList = [...promotionValues];
    const promotionMechanic = promoList.length === 0 ? null : promoList.length === 1 ? promoList[0] : "Multiple — see per-product";
    const note = schedule ? `Schedule: ${schedule}` : null;
    for (const canonAsset of canon) {
      const asset = makeAsset({
        canon: canonAsset, variantLabel: supplier, formatRaw: requestFormatRaw, contentRaw: content,
        promotionMechanic, note, themeRef: null, designDeadline: deadline, fixtureParent,
        sourceRowRef: firstRowRef,
      });
      asset.products = products;
      assets.push(asset);
    }
    products = [];
    promotionValues = new Set();
  }

  let consecutiveBlank = 0;
  for (let r = region.headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) { consecutiveBlank++; if (consecutiveBlank >= 3) break; continue; }
    consecutiveBlank = 0;

    const supplierCell = c.supplierBrand != null ? text(row[c.supplierBrand]) : "";
    const deadlineCell = c.deadline != null ? text(row[c.deadline]) : "";
    const codeCell = c.code != null ? text(row[c.code]) : "";
    const itemCell = c.item != null ? text(row[c.item]) : "";
    const promotionCell = c.promotion != null ? text(row[c.promotion]) : "";
    const contentCell = c.content != null ? text(row[c.content]) : "";
    const scheduleCell = c.schedule != null ? text(row[c.schedule]) : "";
    const requestFormatCell = c.requestFormat != null ? text(row[c.requestFormat]) : "";
    const rowRef = `${sheetName} row ${r + 1}`;

    if (supplierCell) {
      flush();
      supplier = supplierCell;
      deadline = deadlineCell || null;
      requestFormatRaw = requestFormatCell || null;
      content = contentCell;
      schedule = scheduleCell || null;
      firstRowRef = rowRef;
    }
    if (!supplier) continue;
    if (promotionCell) promotionValues.add(promotionCell);
    if (codeCell || itemCell) {
      products.push({ code: codeCell || null, name: itemCell || null, group: supplier, roleNote: promotionCell || null, sourceRowRef: rowRef });
    }
  }
  flush();
  return assets;
}

/** SKU/price-label table (Poster A4, Promotion Label) — no explicit Format column;
 *  the asset type is inferred from trailing free-text design copy below the SKU
 *  table. Falls back to "Promotion Price Label" (NEEDS MAPPING) when no known
 *  asset-type keyword is found in that trailing text. */
export function parseSkuLabelRows(rows: unknown[][], region: TableRegion, sheetName: string, fixtureParent: string | null): ParsedDesignAsset[] {
  const c = region.cols;
  const products: ParsedProduct[] = [];
  const trailingText: string[] = [];
  let consecutiveBlank = 0;
  let r = region.headerRowIdx + 1;

  for (; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) { consecutiveBlank++; if (consecutiveBlank >= 2) { r++; break; } continue; }
    consecutiveBlank = 0;
    const codeCell = c.code != null ? text(row[c.code]) : "";
    if (!SKU_CODE_RE.test(codeCell)) {
      const rowText = row.map((v) => text(v)).filter(Boolean).join(" ");
      if (rowText) trailingText.push(rowText);
      continue;
    }
    const nameCell = c.productName != null ? text(row[c.productName]) : "";
    const promoCell = c.promotion != null ? text(row[c.promotion]) : "";
    products.push({ code: codeCell, name: nameCell || null, group: null, roleNote: promoCell || null, sourceRowRef: `${sheetName} row ${r + 1}` });
  }
  for (; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const rowText = row.map((v) => text(v)).filter(Boolean).join(" ");
    if (rowText) trailingText.push(rowText);
  }

  const trailingRaw = trailingText.join("\n");
  const canon = trailingRaw ? splitAndCanonicalize(trailingRaw) : [];
  const finalCanon: CanonicalAsset = canon.length > 0 && canon[0].confidence === "HIGH"
    ? canon[0]
    : { assetType: "Promotion Price Label", channel: "PROMOTION SUPPORT", confidence: "NEEDS MAPPING" };

  const asset = makeAsset({
    canon: finalCanon, variantLabel: null, formatRaw: null, contentRaw: trailingRaw,
    promotionMechanic: null, note: null, themeRef: null, fixtureParent,
    sourceRowRef: `${sheetName} row ${region.headerRowIdx + 1}`,
  });
  asset.products = products;
  return [asset];
}

/** Scans for a row that declares a shared multi-format ask (e.g. "Banner, Social,
 *  Story, Enew") — used by the Email/eNews pattern where the format list is stated
 *  once at brief level rather than per product row. */
function findSharedFormatDeclaration(rows: unknown[][], fromRow: number, toRow: number): string | null {
  for (let r = fromRow; r < Math.min(toRow, rows.length); r++) {
    const row = rows[r] ?? [];
    for (const cellVal of row) {
      const t = text(cellVal);
      if (!t) continue;
      const canon = splitAndCanonicalize(t);
      if (canon.filter((x) => x.confidence === "HIGH").length >= 2) return t;
    }
  }
  return null;
}

/** Email/eNews product table (e.g. Enew New Arrival/Back in Stock listing) — groups
 *  rows by non-blank Content(Title) cells into variants, applying the shared format
 *  declared at brief level to every variant (rule 4: still split per canonical type). */
export function parseEmailTableRows(rows: unknown[][], region: TableRegion, sheetName: string, sharedFormatRaw: string | null, fixtureParent: string | null): ParsedDesignAsset[] {
  const c = region.cols;
  const sharedCanon = sharedFormatRaw ? splitAndCanonicalize(sharedFormatRaw) : [{ assetType: "Email/eNews Asset", channel: "EMAIL", confidence: "HIGH" as const }];
  const assets: ParsedDesignAsset[] = [];

  let variantLabel: string | null = null;
  let content = "";
  let products: ParsedProduct[] = [];
  let firstRowRef = "";

  function flush() {
    if (products.length === 0 && !content) return;
    for (const canonAsset of sharedCanon) {
      const asset = makeAsset({
        canon: canonAsset, variantLabel, formatRaw: sharedFormatRaw, contentRaw: content,
        promotionMechanic: null, note: null, themeRef: null, fixtureParent,
        sourceRowRef: firstRowRef,
      });
      asset.products = [...products];
      assets.push(asset);
    }
  }

  let consecutiveBlank = 0;
  for (let r = region.headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) { consecutiveBlank++; if (consecutiveBlank >= 3) break; continue; }
    consecutiveBlank = 0;

    const codeCell = c.code != null ? text(row[c.code]) : "";
    const nameCell = c.productName != null ? text(row[c.productName]) : "";
    const contentCell = c.content != null ? text(row[c.content]) : "";
    const categoryCell = c.category != null ? text(row[c.category]) : "";
    const rowRef = `${sheetName} row ${r + 1}`;
    if (!SKU_CODE_RE.test(codeCell) && !nameCell) continue;

    if (contentCell) {
      flush();
      variantLabel = categoryCell || nameCell.split(" ").slice(0, 3).join(" ");
      content = contentCell;
      products = [];
      firstRowRef = rowRef;
    }
    if (codeCell || nameCell) products.push({ code: codeCell || null, name: nameCell || null, group: categoryCell || null, roleNote: null, sourceRowRef: rowRef });
  }
  flush();
  return assets;
}

function classifyLooseCell(v: string): "promotion" | "content" | "other" {
  if (/\d+%\s*off|£\s*\d|\$\s*\d|\bbuy\s+\d|\bdiscount\b|\boffer\b/i.test(v) && v.length < 60) return "promotion";
  if (/\n/.test(v) || v.length > 40) return "content";
  return "other";
}

/** Last-resort fallback for sheets with NO recognisable header row at all (e.g. a
 *  single data row starting directly with a known asset-type keyword, no "Format"
 *  column label anywhere). Infers columns purely from cell VALUE SHAPE — a numeric
 *  4-9 digit code is always followed by its product name, long/multi-line text is
 *  content, short price/%-off text is promotion. Always flagged NEEDS MAPPING since
 *  the layout was inferred, not explicitly labeled by the source. */
export function parseHeaderlessRows(rows: unknown[][], startRow: number, sheetName: string, fixtureParent: string | null): ParsedDesignAsset[] {
  let r = startRow;
  while (r < rows.length && isBlankRow(rows[r] ?? [])) r++;
  if (r >= rows.length) return [];

  const firstRow = rows[r] ?? [];
  const firstCellText = text(firstRow[0]);
  const canon = canonicalizeFragment(firstCellText);
  if (canon.length === 0 || canon[0].confidence !== "HIGH") return [];

  let content = "";
  let promotion: string | null = null;
  const noteParts: string[] = [];
  const products: ParsedProduct[] = [];

  let consecutiveBlank = 0;
  for (; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) { consecutiveBlank++; if (consecutiveBlank >= 2) break; continue; }
    consecutiveBlank = 0;
    const rowRef = `${sheetName} row ${r + 1}`;

    for (let i = 1; i < row.length; i++) {
      const v = text(row[i]);
      if (!v) continue;
      if (SKU_CODE_RE.test(v)) {
        const nameVal = text(row[i + 1] ?? "");
        products.push({ code: v, name: nameVal || null, group: null, roleNote: null, sourceRowRef: rowRef });
        i++;
        continue;
      }
      const kind = classifyLooseCell(v);
      if (kind === "promotion" && !promotion) promotion = v;
      else if (kind === "content" && !content) content = v;
      else noteParts.push(v);
    }
  }

  const assets: ParsedDesignAsset[] = [];
  for (const c of canon) {
    const asset = makeAsset({
      canon: c, variantLabel: null, formatRaw: firstCellText, contentRaw: content,
      promotionMechanic: promotion, note: noteParts.length ? noteParts.join(" | ") : null, themeRef: null, fixtureParent,
      sourceRowRef: `${sheetName} row ${startRow + 1}`,
    });
    asset.products = products;
    asset.confidence = "NEEDS MAPPING"; // layout inferred from shape, not explicitly labeled — always flag for review
    assets.push(asset);
  }
  return assets;
}

// ── Sheet classification + workbook entry point ─────────────────────────────

export interface ParsedDesignBrief {
  sheetName: string;
  header: HeaderBlock;
  sheetKind: DesignBriefSheetKind;
  excluded: boolean;
  exclusionReason: string | null;
  fixtureParent: string | null;
  assets: ParsedDesignAsset[];
}

/** Classifies one sheet and extracts its design brief header + assets. Generic —
 *  driven entirely by header-label and table-header keyword detection, never by
 *  literal sheet names or row numbers, so it works unmodified on future workbooks. */
export function classifySheet(sheetName: string, rows: unknown[][]): ParsedDesignBrief {
  const header = extractHeaderBlock(rows);
  const scanStart = header.headerRowsConsumed;

  const fixtureSignal = /gondola|fixture/i.test(sheetName) || /gondola|fixture/i.test(header.campaignName ?? "") || /gondola|fixture/i.test(header.theme ?? "");
  const fixtureParent = fixtureSignal ? (header.campaignName ?? sheetName.trim()) : null;

  const region = detectTableRegion(rows, scanStart);

  if (!region) {
    const fallbackAssets = parseHeaderlessRows(rows, scanStart, sheetName, fixtureParent);
    if (fallbackAssets.length > 0) {
      return { sheetName, header, sheetKind: "CAMPAIGN_BRIEF", excluded: false, exclusionReason: null, fixtureParent, assets: fallbackAssets };
    }
    if (!header.campaignName) {
      return {
        sheetName, header, sheetKind: "UNCLASSIFIED", excluded: true, fixtureParent,
        exclusionReason: "No recognisable design-brief structure found (no Campaign Name label or asset table header) — NEEDS MAPPING, not parsed.",
        assets: [],
      };
    }
    return {
      sheetName, header, sheetKind: "CAMPAIGN_BRIEF", excluded: true, fixtureParent,
      exclusionReason: "Campaign header found but no design asset table detected below it.",
      assets: [],
    };
  }

  if (region.pattern === "OPERATIONAL_INFO") {
    return {
      sheetName, header, sheetKind: "DEMO_OPERATIONAL_INFO", excluded: true, fixtureParent,
      exclusionReason: "Operational/cooking-guideline information, not a design asset request (rule 17).",
      assets: [],
    };
  }

  let assets: ParsedDesignAsset[] = [];
  let sheetKind: DesignBriefSheetKind = "CAMPAIGN_BRIEF";

  switch (region.pattern) {
    case "DEMO_TABLE":
      assets = parseDemoRows(rows, region, sheetName, fixtureParent);
      sheetKind = "DEMO_BRIEF";
      break;
    case "SECTION_BRIEF":
      assets = parseSectionBriefRows(rows, region, sheetName, fixtureParent);
      sheetKind = "LANDING_PAGE";
      break;
    case "LABEL_TAG":
      assets = parseLabelTagRows(rows, region, sheetName, fixtureParent);
      sheetKind = "PROMOTION_LABEL_TAG";
      break;
    case "EMAIL_TABLE": {
      const sharedFormat = findSharedFormatDeclaration(rows, scanStart, region.headerRowIdx);
      assets = parseEmailTableRows(rows, region, sheetName, sharedFormat, fixtureParent);
      sheetKind = "EMAIL_BRIEF";
      break;
    }
    case "FORMAT_TABLE":
      assets = parseFormatTableRows(rows, region, sheetName, fixtureParent);
      sheetKind = fixtureSignal ? "GONDOLA_FIXTURE" : "CAMPAIGN_BRIEF";
      break;
    case "SKU_LABEL":
      assets = parseSkuLabelRows(rows, region, sheetName, fixtureParent);
      sheetKind = header.campaignName ? "CAMPAIGN_BRIEF" : "PROMOTION_LABEL_SKU";
      break;
    case "SECTION_BLOCK":
      assets = parseSectionBlockRows(rows, region.headerRowIdx, sheetName, fixtureParent);
      sheetKind = "CAMPAIGN_BRIEF";
      break;
  }

  if (assets.length === 0) {
    return {
      sheetName, header, sheetKind, excluded: true, fixtureParent,
      exclusionReason: "Table structure recognised but no data rows produced usable assets.",
      assets: [],
    };
  }

  return { sheetName, header, sheetKind, excluded: false, exclusionReason: null, fixtureParent, assets };
}

export interface ParsedWorkbook {
  fileName: string;
  briefs: ParsedDesignBrief[];
}

/** Reads every sheet in the workbook and classifies it. Pure parse — no DB writes.
 *  A sheet may legitimately produce an EXCLUDED brief with 0 assets (internal
 *  reference grids, empty templates, operational-info-only sheets); these are still
 *  returned so the Source Inventory can show *why* nothing was extracted. */
export function parseDesignBriefWorkbook(filePath: string): ParsedWorkbook {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const briefs: ParsedDesignBrief[] = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
    return classifySheet(sheetName, rows);
  });
  return { fileName: filePath, briefs };
}

/** Same as parseDesignBriefWorkbook but reads from an in-memory buffer — used by the
 *  upload API route so future Design Brief files never need to touch disk first. */
export function parseDesignBriefWorkbookBuffer(buffer: Buffer, fileName: string): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const briefs: ParsedDesignBrief[] = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
    return classifySheet(sheetName, rows);
  });
  return { fileName, briefs };
}
