import * as XLSX from "xlsx";
import { toIsoDate } from "./utils";

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

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/[£$,%]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Normalises store naming inconsistencies in the source tracker (e.g. "Staines"
 *  vs "LGD Staines", "Maidstone" vs "LGD Maidstone") to a single
 *  canonical form per store — the same normalisation the evaluation report
 *  itself applies by hand, generalised so it's never store-specific. */
export function normalizeStoreName(raw: string): string {
  const stripped = raw.replace(/^lgd\s+/i, "").trim();
  const titled = stripped
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `LGD ${titled}`;
}

// ── Week detection ───────────────────────────────────────────────────────────

/** Detects the week code from a workbook: sheet names matching "W39" first
 *  (most reliable, generic signal), then a "WEEK 39" pattern inside cell text. */
export function detectWeekFromWorkbook(wb: XLSX.WorkBook): string | null {
  for (const name of wb.SheetNames) {
    const m = name.trim().match(/^W(\d{1,2})$/i);
    if (m) return `W${m[1].padStart(2, "0")}`;
  }
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
    for (const row of rows.slice(0, 5)) {
      for (const cell of row) {
        const m = text(cell).match(/WEEK\s*(\d{1,2})/i);
        if (m) return `W${m[1].padStart(2, "0")}`;
      }
    }
  }
  return null;
}

/** Detects a week code from a filename like "W39_DEMO.xlsx" or "W39_LGD_...pdf". */
export function detectWeekFromFileName(fileName: string): string | null {
  const m = fileName.match(/^W(\d{1,2})[\s_.\-]/i) ?? fileName.match(/\bW(\d{1,2})\b/i);
  return m ? `W${m[1].padStart(2, "0")}` : null;
}

// ── Performance sheet (structured quantitative core) ────────────────────────

export interface DemoPerformanceRow {
  location: string;
  sessionLabel: string | null;
  demoDate: string | null;
  theme: string | null;
  operatedBy: string | null;
  brandRaw: string;
  skuCode: string | null;
  skuName: string | null;
  promotionMechanic: string | null;
  demoType: string | null;
  estimatedParticipants: number | null;
  estimatedInterested: number | null;
  customerReaction: string | null;
  staffFeedback: string | null;
  estimatedParticipantsFromInvoices: number | null;
  focQuantity: number | null;
  actualSalesDemoDay: number | null;
  salesWeekBefore: number | null;
  salesDemoWeek: number | null;
  avgWeeklySalesBaseline: number | null;
  sales6moTotal: number | null;
  sales1moTotal: number | null;
  sourceRowRef: string;
}

interface PerfColumnMap {
  shop?: number;
  time?: number;
  theme?: number;
  operatedBy?: number;
  brand?: number;
  code?: number;
  productName?: number;
  promotion?: number;
  demoType?: number;
  participants?: number;
  estInterested?: number;
  customerReaction?: number;
  feedback?: number;
  estParticipantsInvoices?: number;
  focQuantity?: number;
  actualSales?: number;
  salesWeekBefore?: number;
  salesDemoWeek?: number;
  avgWeeklySales?: number;
  sales6mo?: number;
  sales1mo?: number;
}

function findCol(row: unknown[], subRow: unknown[] | null, test: (combined: string) => boolean): number | undefined {
  for (let i = 0; i < row.length; i++) {
    const combined = `${norm(row[i])} ${subRow ? norm(subRow[i]) : ""}`.trim();
    if (combined && test(combined)) return i;
  }
  return undefined;
}

function buildPerfColumnMap(headerRow: unknown[], subRow: unknown[] | null): PerfColumnMap {
  return {
    shop: findCol(headerRow, null, (c) => c === "shop"),
    time: findCol(headerRow, null, (c) => c === "time"),
    theme: findCol(headerRow, null, (c) => /theme/.test(c)),
    operatedBy: findCol(headerRow, null, (c) => c.includes("operated by")),
    brand: findCol(headerRow, null, (c) => c === "brand"),
    code: findCol(headerRow, null, (c) => c === "code"),
    productName: findCol(headerRow, null, (c) => c.includes("product name")),
    promotion: findCol(headerRow, null, (c) => c === "promotion"),
    demoType: findCol(headerRow, null, (c) => c.includes("demo type")),
    participants: findCol(headerRow, null, (c) => c === "participants"),
    estInterested: findCol(headerRow, null, (c) => c.includes("estimated interest")),
    customerReaction: findCol(headerRow, null, (c) => c.includes("customer reaction")),
    feedback: findCol(headerRow, null, (c) => c.includes("key customer feedback") || c.includes("demo staff comments")),
    estParticipantsInvoices: findCol(headerRow, null, (c) => c.includes("estimated participants from shop invoices")),
    focQuantity: findCol(headerRow, null, (c) => c.includes("foc quantity")),
    actualSales: findCol(headerRow, null, (c) => c === "actual sales"),
    salesWeekBefore: findCol(headerRow, subRow, (c) => c.includes("sales") && c.includes("week before")),
    salesDemoWeek: findCol(headerRow, subRow, (c) => c.includes("sales") && c.includes("demo week") && !c.includes("before")),
    avgWeeklySales: findCol(headerRow, null, (c) => c.includes("average weekly sales")),
    sales6mo: findCol(headerRow, subRow, (c) => c.includes("6 months")),
    sales1mo: findCol(headerRow, subRow, (c) => c.includes("1 month")),
  };
}

function looksLikeHeaderRow(row: unknown[]): boolean {
  const joined = row.map(norm).join(" | ");
  const hits = ["shop", "time", "brand", "code", "promotion", "participants"].filter((k) => joined.includes(k)).length;
  return hits >= 4;
}

/** Parses the structured per-session, per-SKU performance sheet (the day-block /
 *  two-row-header / carry-down layout used across W37-W39 and expected to
 *  continue). Column positions are detected by keyword, never fixed indices, so
 *  future weeks with a slightly different column order still parse correctly. */
export function parseDemoPerformanceSheet(rows: unknown[][], sheetName: string): DemoPerformanceRow[] {
  const out: DemoPerformanceRow[] = [];
  let demoDate: string | null = null;
  let cols: PerfColumnMap = {};

  let location = "";
  let sessionLabel: string | null = null;
  let theme: string | null = null;
  let operatedBy: string | null = null;
  let brandRaw = "";
  let demoType: string | null = null;
  let estimatedParticipants: number | null = null;
  let estimatedInterested: number | null = null;
  let customerReaction: string | null = null;
  let staffFeedback: string | null = null;
  let estimatedParticipantsFromInvoices: number | null = null;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (isBlankRow(row)) continue;

    const dayBlockMatch = text(row[0]).match(/WEEK\s*\d{1,2}\s*DEMO EVENT/i);
    if (dayBlockMatch) {
      const dateMatch = text(row[0]).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
      demoDate = dateMatch ? toIsoDate(`${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`) : demoDate;
      cols = {}; // force header re-detection for this block
      continue;
    }

    if (Object.keys(cols).length === 0) {
      if (looksLikeHeaderRow(row)) {
        const subRow = rows[r + 1] ?? [];
        cols = buildPerfColumnMap(row, looksLikeHeaderRow(subRow) ? null : subRow);
        if (looksLikeHeaderRow(subRow)) continue; // shouldn't happen, but guard
        r += 1; // skip the sub-description row
      }
      continue;
    }

    const shopCell = cols.shop != null ? text(row[cols.shop]) : "";
    const timeCell = cols.time != null ? text(row[cols.time]) : "";
    const themeCell = cols.theme != null ? text(row[cols.theme]) : "";
    const operatedByCell = cols.operatedBy != null ? text(row[cols.operatedBy]) : "";
    const brandCell = cols.brand != null ? text(row[cols.brand]) : "";
    const demoTypeCell = cols.demoType != null ? text(row[cols.demoType]) : "";
    const participantsCell = cols.participants != null ? toNum(row[cols.participants]) : null;
    const estInterestedCell = cols.estInterested != null ? toNum(row[cols.estInterested]) : null;
    const reactionCell = cols.customerReaction != null ? text(row[cols.customerReaction]) : "";
    const feedbackCell = cols.feedback != null ? text(row[cols.feedback]) : "";
    const invoicesCell = cols.estParticipantsInvoices != null ? toNum(row[cols.estParticipantsInvoices]) : null;

    // A new session starts when Shop changes, OR when Shop is blank (same store,
    // not repeated) but Time changes — the source tracker only repeats Shop on a
    // session's first row, so two back-to-back sessions at the same store are
    // distinguished purely by a new Time value.
    const isNewSession = !!shopCell || (!!timeCell && timeCell !== sessionLabel);

    if (isNewSession) {
      if (shopCell) location = normalizeStoreName(shopCell);
      sessionLabel = timeCell || sessionLabel;
      theme = themeCell || theme;
      operatedBy = operatedByCell || operatedBy;
      brandRaw = brandCell || brandRaw;
      demoType = demoTypeCell || null;
      estimatedParticipants = participantsCell;
      estimatedInterested = estInterestedCell;
      customerReaction = reactionCell || null;
      staffFeedback = feedbackCell || null;
      estimatedParticipantsFromInvoices = invoicesCell;
    } else {
      // continuation row (same session, next SKU) — carry session-level fields down
      if (brandCell) brandRaw = brandCell;
      if (demoTypeCell) demoType = demoTypeCell;
      if (participantsCell != null) estimatedParticipants = participantsCell;
      if (estInterestedCell != null) estimatedInterested = estInterestedCell;
      if (reactionCell) customerReaction = reactionCell;
      if (feedbackCell) staffFeedback = feedbackCell;
      if (invoicesCell != null) estimatedParticipantsFromInvoices = invoicesCell;
    }

    if (!location) continue; // stray row before first session

    const codeCell = cols.code != null ? text(row[cols.code]) : "";
    const nameCell = cols.productName != null ? text(row[cols.productName]) : "";
    if (!codeCell && !nameCell) continue; // not a product row

    out.push({
      location,
      sessionLabel,
      demoDate,
      theme,
      operatedBy,
      brandRaw,
      skuCode: codeCell || null,
      skuName: nameCell || null,
      promotionMechanic: cols.promotion != null ? text(row[cols.promotion]) || null : null,
      demoType,
      estimatedParticipants,
      estimatedInterested,
      customerReaction,
      staffFeedback,
      estimatedParticipantsFromInvoices,
      focQuantity: cols.focQuantity != null ? toNum(row[cols.focQuantity]) : null,
      actualSalesDemoDay: cols.actualSales != null ? toNum(row[cols.actualSales]) : null,
      salesWeekBefore: cols.salesWeekBefore != null ? toNum(row[cols.salesWeekBefore]) : null,
      salesDemoWeek: cols.salesDemoWeek != null ? toNum(row[cols.salesDemoWeek]) : null,
      avgWeeklySalesBaseline: cols.avgWeeklySales != null ? toNum(row[cols.avgWeeklySales]) : null,
      sales6moTotal: cols.sales6mo != null ? toNum(row[cols.sales6mo]) : null,
      sales1moTotal: cols.sales1mo != null ? toNum(row[cols.sales1mo]) : null,
      sourceRowRef: `${sheetName} row ${r + 1}`,
    });
  }

  return out;
}

// ── Summary sheet (session scheduling — same shape as demoPlan.ts's Summary) ──

export interface DemoScheduleRow {
  location: string;
  sessionLabel: string | null;
  theme: string | null;
  operatedBy: string | null;
  brandRaw: string;
  personInCharge: string | null;
  weekCode: string | null;
  sourceRowRef: string;
}

export function parseDemoSummarySheet(rows: unknown[][], sheetName: string): DemoScheduleRow[] {
  const out: DemoScheduleRow[] = [];
  let currentWeekCode: string | null = null;
  let lastShop: string | null = null;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const col0 = text(row[0]);
    const weekMatch = col0.match(/W(\d{1,2})\s*[–-]/i) ?? col0.match(/WEEK\s*(\d{1,2})/i);
    if (weekMatch) {
      currentWeekCode = `W${weekMatch[1].padStart(2, "0")}`;
      lastShop = null;
      continue;
    }
    if (norm(col0) === "shop") continue; // repeated header row

    const shop: string | null = text(row[0]) || lastShop;
    const time = text(row[1]);
    const theme = text(row[2]);
    const operatedBy = text(row[3]);
    const brand = text(row[4]);
    const pic = text(row[6]);
    if (!shop || (!theme && !brand)) continue;

    lastShop = shop;
    out.push({
      location: normalizeStoreName(shop),
      sessionLabel: time || null,
      theme: theme || null,
      operatedBy: operatedBy || null,
      brandRaw: brand,
      personInCharge: pic || null,
      weekCode: currentWeekCode,
      sourceRowRef: `${sheetName} row ${r + 1}`,
    });
  }
  return out;
}

export function loadWorkbookRows(buffer: Buffer, sheetName: string): unknown[][] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
}

export function readWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

export function sheetToRows(wb: XLSX.WorkBook, sheetName: string): unknown[][] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
}
