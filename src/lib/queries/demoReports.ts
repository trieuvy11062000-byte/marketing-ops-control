import { getDb } from "../db/client";
import type { DemoWeeklyAction, DemoWeeklyNote, DemoWeeklySource } from "../db/types";

// ── Shared metric calculation — the ONE place uplift/CVS/FOC formulas live ──
// Mirrors the Post-Event Evaluation report's own methodology exactly:
// Typical Daily Baseline = Avg Weekly Sales ÷ 7; Sales Uplift = Real Sales ÷
// Typical Daily Baseline; Real CVS Rate = Real Sales ÷ Estimated Participants
// from Invoices; Est CVS Rate = Estimated Interested ÷ Estimated Participants.

export interface CalculatedMetrics {
  typicalDailyBaseline: number | null;
  uplift: number | null;
  estCvsRate: number | null;
  realCvsRate: number | null;
  cvsVariancePp: number | null;
  unitsPerFoc: number | null;
}

function calcMetrics(sales: number, foc: number, baselineWeeklySum: number | null, estParticipants: number | null, estInterested: number | null, estParticipantsInvoices: number | null): CalculatedMetrics {
  const typicalDailyBaseline = baselineWeeklySum != null ? baselineWeeklySum / 7 : null;
  const uplift = typicalDailyBaseline && typicalDailyBaseline > 0 ? sales / typicalDailyBaseline : null;
  const estCvsRate = estParticipants ? (estInterested ?? 0) / estParticipants : null;
  const realCvsRate = estParticipantsInvoices ? sales / estParticipantsInvoices : null;
  const cvsVariancePp = estCvsRate != null && realCvsRate != null ? (realCvsRate - estCvsRate) * 100 : null;
  const unitsPerFoc = foc > 0 ? sales / foc : null;
  return { typicalDailyBaseline, uplift, estCvsRate, realCvsRate, cvsVariancePp, unitsPerFoc };
}

// ── Weekly Demo Report — list (compact, for In-store page) ─────────────────

export interface WeeklyDemoReportSummary {
  weekCode: string;
  sessionsCount: number;
  storesCount: number;
  brandsCount: number;
  unitsSold: number;
  focDistributed: number;
  metrics: CalculatedMetrics;
  keyLearningSnippet: string | null;
  reportedUplift: number | null;
  reportedUnitsSold: number | null;
}

export function listWeeklyDemoReports(): WeeklyDemoReportSummary[] {
  const db = getDb();
  const reports = db.prepare("SELECT id, week_code, executive_summary, reported_uplift, reported_units_sold FROM demo_weekly_reports ORDER BY week_code DESC").all() as {
    id: string; week_code: string; executive_summary: string | null; reported_uplift: number | null; reported_units_sold: number | null;
  }[];

  return reports.map((r) => {
    const agg = db
      .prepare(
        `SELECT COUNT(DISTINCT location || '|' || session_label) as sessions, COUNT(DISTINCT location) as stores,
                COUNT(DISTINCT brand_id) as brands, SUM(actual_sales_demo_day) as sales, SUM(foc_quantity) as foc,
                SUM(avg_weekly_sales_baseline) as baseline
         FROM demo_session_performance WHERE demo_weekly_report_id = ?`
      )
      .get(r.id) as { sessions: number; stores: number; brands: number; sales: number | null; foc: number | null; baseline: number | null };

    const sales = agg.sales ?? 0;
    const foc = agg.foc ?? 0;
    const metrics = calcMetrics(sales, foc, agg.baseline, null, null, null);
    // Compact card snippet: the "Best" bullet from the generated summary reads
    // best as a one-line highlight; fall back to the first bullet if absent.
    const bestLine = r.executive_summary?.split("\n").find((l) => l.startsWith("Best:"));
    const snippet = bestLine ?? r.executive_summary?.split("\n")[0] ?? null;

    return {
      weekCode: r.week_code,
      sessionsCount: agg.sessions,
      storesCount: agg.stores,
      brandsCount: agg.brands,
      unitsSold: sales,
      focDistributed: foc,
      metrics,
      keyLearningSnippet: snippet,
      reportedUplift: r.reported_uplift,
      reportedUnitsSold: r.reported_units_sold,
    };
  });
}

// ── Weekly Demo Report — detail ─────────────────────────────────────────────

export interface StorePerformanceRow {
  location: string;
  sessionsCount: number;
  sales: number;
  foc: number;
  metrics: CalculatedMetrics;
}

export interface SessionPerformanceRow {
  location: string;
  sessionLabel: string | null;
  brandId: string | null;
  brandName: string | null;
  demoType: string | null;
  operatedBy: string | null;
  sales: number;
  foc: number;
  metrics: CalculatedMetrics;
  estimatedParticipants: number | null;
  estimatedInterested: number | null;
}

export interface BrandProductPerformanceRow {
  brandId: string | null;
  brandName: string | null;
  skuCode: string | null;
  skuName: string | null;
  promotionMechanic: string | null;
  promotionId: string | null;
  sales: number;
  baseline: number | null;
  foc: number;
  location: string;
  sessionLabel: string | null;
}

export interface FeedbackRow {
  location: string;
  sessionLabel: string | null;
  brandName: string | null;
  customerReaction: string | null;
  staffFeedback: string | null;
}

export interface WeeklyDemoReportDetail {
  weekCode: string;
  reportedUnitsSold: number | null;
  reportedUplift: number | null;
  reportedFoc: number | null;
  executiveSummary: string | null;
  keyLearning: string | null;
  overview: {
    sessionsCount: number;
    storesCount: number;
    brandsCount: number;
    unitsSold: number;
    focDistributed: number;
    salesWeekBeforeTotal: number | null;
    salesDemoWeekTotal: number | null;
    metrics: CalculatedMetrics;
  };
  storePerformance: StorePerformanceRow[];
  sessionPerformance: SessionPerformanceRow[];
  productPerformance: BrandProductPerformanceRow[];
  feedback: FeedbackRow[];
  actions: DemoWeeklyAction[];
  sources: DemoWeeklySource[];
  notes: DemoWeeklyNote[];
}

interface RawPerfRow {
  location: string;
  session_label: string | null;
  brand_id: string | null;
  brand_name: string | null;
  demo_type: string | null;
  operated_by: string | null;
  sku_code: string | null;
  sku_name: string | null;
  promotion_mechanic: string | null;
  promotion_id: string | null;
  estimated_participants: number | null;
  estimated_interested: number | null;
  estimated_participants_from_invoices: number | null;
  customer_reaction: string | null;
  staff_feedback: string | null;
  foc_quantity: number | null;
  actual_sales_demo_day: number | null;
  sales_week_before: number | null;
  sales_demo_week: number | null;
  avg_weekly_sales_baseline: number | null;
}

export function getWeeklyDemoReportDetail(weekCode: string): WeeklyDemoReportDetail | undefined {
  const db = getDb();
  const report = db.prepare("SELECT * FROM demo_weekly_reports WHERE id = ?").get(weekCode) as
    | { week_code: string; reported_units_sold: number | null; reported_uplift: number | null; reported_foc: number | null; executive_summary: string | null; key_learning: string | null }
    | undefined;
  if (!report) return undefined;

  const rows = db
    .prepare(
      `SELECT p.location, p.session_label, p.brand_id, b.name as brand_name, p.demo_type, p.operated_by,
              p.sku_code, p.sku_name, p.promotion_mechanic, p.promotion_id,
              p.estimated_participants, p.estimated_interested, p.estimated_participants_from_invoices,
              p.customer_reaction, p.staff_feedback, p.foc_quantity, p.actual_sales_demo_day,
              p.sales_week_before, p.sales_demo_week, p.avg_weekly_sales_baseline
       FROM demo_session_performance p
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.demo_weekly_report_id = ?`
    )
    .all(weekCode) as RawPerfRow[];

  // Event-level overview
  const unitsSold = rows.reduce((n, r) => n + (r.actual_sales_demo_day ?? 0), 0);
  const focDistributed = rows.reduce((n, r) => n + (r.foc_quantity ?? 0), 0);
  const baselineSum = rows.reduce((n, r) => n + (r.avg_weekly_sales_baseline ?? 0), 0);
  const salesWeekBeforeTotal = rows.some((r) => r.sales_week_before != null) ? rows.reduce((n, r) => n + (r.sales_week_before ?? 0), 0) : null;
  const salesDemoWeekTotal = rows.some((r) => r.sales_demo_week != null) ? rows.reduce((n, r) => n + (r.sales_demo_week ?? 0), 0) : null;
  const stores = new Set(rows.map((r) => r.location));
  const sessions = new Set(rows.map((r) => `${r.location}|${r.session_label}`));
  const brands = new Set(rows.map((r) => r.brand_id).filter(Boolean));

  // Session-level aggregation
  const sessionMap = new Map<string, RawPerfRow[]>();
  for (const r of rows) {
    const key = `${r.location}|${r.session_label}`;
    if (!sessionMap.has(key)) sessionMap.set(key, []);
    sessionMap.get(key)!.push(r);
  }
  const sessionPerformance: SessionPerformanceRow[] = [...sessionMap.values()].map((group) => {
    const first = group[0];
    const sales = group.reduce((n, r) => n + (r.actual_sales_demo_day ?? 0), 0);
    const foc = group.reduce((n, r) => n + (r.foc_quantity ?? 0), 0);
    const baseline = group.reduce((n, r) => n + (r.avg_weekly_sales_baseline ?? 0), 0);
    return {
      location: first.location,
      sessionLabel: first.session_label,
      brandId: first.brand_id,
      brandName: first.brand_name,
      demoType: first.demo_type,
      operatedBy: first.operated_by,
      sales,
      foc,
      metrics: calcMetrics(sales, foc, baseline, first.estimated_participants, first.estimated_interested, first.estimated_participants_from_invoices),
      estimatedParticipants: first.estimated_participants,
      estimatedInterested: first.estimated_interested,
    };
  });

  // Store-level aggregation
  const storeMap = new Map<string, RawPerfRow[]>();
  for (const r of rows) {
    if (!storeMap.has(r.location)) storeMap.set(r.location, []);
    storeMap.get(r.location)!.push(r);
  }
  const storePerformance: StorePerformanceRow[] = [...storeMap.entries()].map(([location, group]) => {
    const sales = group.reduce((n, r) => n + (r.actual_sales_demo_day ?? 0), 0);
    const foc = group.reduce((n, r) => n + (r.foc_quantity ?? 0), 0);
    const baseline = group.reduce((n, r) => n + (r.avg_weekly_sales_baseline ?? 0), 0);
    const sessionsCount = new Set(group.map((r) => r.session_label)).size;
    // Store-level CVS uses the invoice-modelled baseline summed across the store's sessions' first-SKU rows
    const estInvoicesSum = [...new Set(group.map((r) => r.session_label))]
      .map((sl) => group.find((r) => r.session_label === sl)?.estimated_participants_from_invoices ?? 0)
      .reduce((n, v) => n + v, 0);
    return {
      location,
      sessionsCount,
      sales,
      foc,
      metrics: calcMetrics(sales, foc, baseline, null, null, estInvoicesSum || null),
    };
  }).sort((a, b) => b.sales - a.sales);

  // Product performance — one row per (brand, sku, session)
  const productPerformance: BrandProductPerformanceRow[] = rows
    .filter((r) => r.sku_code || r.sku_name)
    .map((r) => ({
      brandId: r.brand_id, brandName: r.brand_name, skuCode: r.sku_code, skuName: r.sku_name,
      promotionMechanic: r.promotion_mechanic, promotionId: r.promotion_id,
      sales: r.actual_sales_demo_day ?? 0, baseline: r.avg_weekly_sales_baseline, foc: r.foc_quantity ?? 0,
      location: r.location, sessionLabel: r.session_label,
    }))
    .sort((a, b) => b.sales - a.sales);

  // Feedback — distinct (location, session, reaction/feedback) rows only, never fabricated
  const feedbackSeen = new Set<string>();
  const feedback: FeedbackRow[] = [];
  for (const r of rows) {
    if (!r.customer_reaction && !r.staff_feedback) continue;
    const key = `${r.location}|${r.session_label}|${r.customer_reaction}|${r.staff_feedback}`;
    if (feedbackSeen.has(key)) continue;
    feedbackSeen.add(key);
    feedback.push({ location: r.location, sessionLabel: r.session_label, brandName: r.brand_name, customerReaction: r.customer_reaction, staffFeedback: r.staff_feedback });
  }

  const actions = db.prepare("SELECT * FROM demo_weekly_actions WHERE demo_weekly_report_id = ? ORDER BY sort_order").all(weekCode) as DemoWeeklyAction[];
  const sources = db.prepare("SELECT * FROM demo_weekly_sources WHERE demo_weekly_report_id = ? ORDER BY imported_at").all(weekCode) as DemoWeeklySource[];
  const notes = db.prepare("SELECT * FROM demo_weekly_notes WHERE week_code = ? ORDER BY created_at DESC").all(weekCode) as DemoWeeklyNote[];

  return {
    weekCode: report.week_code,
    reportedUnitsSold: report.reported_units_sold,
    reportedUplift: report.reported_uplift,
    reportedFoc: report.reported_foc,
    executiveSummary: report.executive_summary,
    keyLearning: report.key_learning,
    overview: {
      sessionsCount: sessions.size,
      storesCount: stores.size,
      brandsCount: brands.size,
      unitsSold,
      focDistributed,
      salesWeekBeforeTotal,
      salesDemoWeekTotal,
      metrics: calcMetrics(unitsSold, focDistributed, baselineSum, null, null, null),
    },
    storePerformance,
    sessionPerformance,
    productPerformance,
    feedback,
    actions,
    sources,
    notes,
  };
}

function shortStoreName(location: string): string {
  return location.replace(/^longdan\s+/i, "").trim() || location;
}

/** Generates the compact Executive Summary — Performance / Best / Issue /
 *  Takeaway, max ~70 words total — from CALCULATED performance data only. Never
 *  imports or shortens the full evaluation narrative; that stays linked via
 *  Sources. Computed fresh from demo_session_performance each time, so fixing
 *  this logic automatically "fixes" every existing week too. */
export function generateExecutiveSummaryBullets(weekCode: string): string | null {
  const detail = getWeeklyDemoReportDetail(weekCode);
  if (!detail || detail.overview.unitsSold === 0) return null;

  const o = detail.overview;
  const upliftStr = o.metrics.uplift != null ? `, delivering ${o.metrics.uplift.toFixed(1)}x uplift` : "";
  const performance = `Performance: ${o.unitsSold} units sold across ${o.storesCount} stores${upliftStr}.`;

  const bestSession = [...detail.sessionPerformance].sort((a, b) => b.sales - a.sales)[0];
  const best = bestSession
    ? `Best: ${bestSession.brandName ?? "—"} @ ${shortStoreName(bestSession.location)} led performance with ${bestSession.sales} units sold.`
    : null;

  const issueParts: string[] = [];
  const zeroSalesSessions = detail.sessionPerformance.filter((s) => s.sales === 0);
  if (zeroSalesSessions.length > 0) {
    const s = zeroSalesSessions[0];
    issueParts.push(
      zeroSalesSessions.length > 1
        ? `${s.brandName ?? "—"} sessions recorded zero sales at ${zeroSalesSessions.length} stores`
        : `${s.brandName ?? "—"} @ ${shortStoreName(s.location)} recorded zero sales`
    );
  }
  const worstFoc = [...detail.storePerformance]
    .filter((s) => s.foc > 0 && s.metrics.unitsPerFoc != null)
    .sort((a, b) => a.metrics.unitsPerFoc! - b.metrics.unitsPerFoc!)[0];
  if (worstFoc && !issueParts.some((p) => p.includes(shortStoreName(worstFoc.location)))) {
    issueParts.push(`${shortStoreName(worstFoc.location)} showed poor FOC efficiency`);
  }
  if (issueParts.length === 0) {
    const worstSession = [...detail.sessionPerformance].filter((s) => s.metrics.uplift != null).sort((a, b) => a.metrics.uplift! - b.metrics.uplift!)[0];
    if (worstSession) issueParts.push(`${worstSession.brandName ?? "—"} @ ${shortStoreName(worstSession.location)} underperformed its baseline`);
  }
  const issue = issueParts.length > 0 ? `Issue: ${issueParts.slice(0, 2).join("; ")}.` : null;

  const takeaway = "Takeaway: Adapt SKU, promotion and FOC allocation by actual store performance.";

  return [performance, best, issue, takeaway].filter((b): b is string => !!b).join("\n");
}

// ── Quick Weekly Notes (user-generated) ─────────────────────────────────────

export function listDemoWeeklyNotes(weekCode: string): DemoWeeklyNote[] {
  const db = getDb();
  return db.prepare("SELECT * FROM demo_weekly_notes WHERE week_code = ? ORDER BY created_at DESC").all(weekCode) as DemoWeeklyNote[];
}

export function createDemoWeeklyNote(input: { weekCode: string; note: string; category?: string | null; createdBy?: string | null }): string {
  const db = getDb();
  const id = `NOTE__${input.weekCode}__${Date.now()}`;
  db.prepare("INSERT INTO demo_weekly_notes (id, week_code, note, category, created_by) VALUES (?, ?, ?, ?, ?)").run(
    id, input.weekCode, input.note, input.category ?? null, input.createdBy ?? null
  );
  return id;
}

export function deleteDemoWeeklyNote(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM demo_weekly_notes WHERE id = ?").run(id);
}

// ── Brand Demo Performance (for Brand 360 page) ─────────────────────────────

export interface BrandDemoPerformanceSummary {
  demoWeeksCount: number;
  demoSessionsCount: number;
  storesActivatedCount: number;
  demoPeriodSalesTotal: number;
  avgUplift: number | null;
  totalFoc: number;
}

export function getBrandDemoPerformanceSummary(brandId: string): BrandDemoPerformanceSummary {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT week_code, location, session_label, actual_sales_demo_day, foc_quantity, avg_weekly_sales_baseline
       FROM demo_session_performance WHERE brand_id = ?`
    )
    .all(brandId) as { week_code: string; location: string; session_label: string | null; actual_sales_demo_day: number | null; foc_quantity: number | null; avg_weekly_sales_baseline: number | null }[];

  const weeks = new Set(rows.map((r) => r.week_code));
  const sessions = new Set(rows.map((r) => `${r.week_code}|${r.location}|${r.session_label}`));
  const stores = new Set(rows.map((r) => r.location));
  const salesTotal = rows.reduce((n, r) => n + (r.actual_sales_demo_day ?? 0), 0);
  const focTotal = rows.reduce((n, r) => n + (r.foc_quantity ?? 0), 0);

  // Average uplift computed per-session (not per-row) to avoid double counting multi-SKU sessions
  const sessionMap = new Map<string, { sales: number; baseline: number }>();
  for (const r of rows) {
    const key = `${r.week_code}|${r.location}|${r.session_label}`;
    const cur = sessionMap.get(key) ?? { sales: 0, baseline: 0 };
    cur.sales += r.actual_sales_demo_day ?? 0;
    cur.baseline += r.avg_weekly_sales_baseline ?? 0;
    sessionMap.set(key, cur);
  }
  const uplifts = [...sessionMap.values()]
    .map((s) => (s.baseline > 0 ? s.sales / (s.baseline / 7) : null))
    .filter((u): u is number => u != null);
  const avgUplift = uplifts.length > 0 ? uplifts.reduce((n, u) => n + u, 0) / uplifts.length : null;

  return {
    demoWeeksCount: weeks.size,
    demoSessionsCount: sessions.size,
    storesActivatedCount: stores.size,
    demoPeriodSalesTotal: salesTotal,
    avgUplift,
    totalFoc: focTotal,
  };
}

export interface BrandWeeklyTrendRow {
  weekCode: string;
  promotionMechanics: string[];
  sales: number;
  baseline: number | null;
  uplift: number | null;
  wowChangePct: number | null;
  topSku: string | null;
}

/** Week → Promotion → Sales relationship only — never claims causation. */
export function getBrandWeeklyTrend(brandId: string): BrandWeeklyTrendRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT week_code, sku_name, promotion_mechanic, actual_sales_demo_day, avg_weekly_sales_baseline
       FROM demo_session_performance WHERE brand_id = ? ORDER BY week_code`
    )
    .all(brandId) as { week_code: string; sku_name: string | null; promotion_mechanic: string | null; actual_sales_demo_day: number | null; avg_weekly_sales_baseline: number | null }[];

  const byWeek = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byWeek.has(r.week_code)) byWeek.set(r.week_code, []);
    byWeek.get(r.week_code)!.push(r);
  }

  const weekCodes = [...byWeek.keys()].sort();
  const trend: BrandWeeklyTrendRow[] = [];
  let prevSales: number | null = null;

  for (const wc of weekCodes) {
    const group = byWeek.get(wc)!;
    const sales = group.reduce((n, r) => n + (r.actual_sales_demo_day ?? 0), 0);
    const baseline = group.reduce((n, r) => n + (r.avg_weekly_sales_baseline ?? 0), 0);
    const uplift = baseline > 0 ? sales / (baseline / 7) : null;
    const promotionMechanics = [...new Set(group.map((r) => r.promotion_mechanic).filter((p): p is string => !!p))];
    const bySku = new Map<string, number>();
    for (const r of group) {
      if (!r.sku_name) continue;
      bySku.set(r.sku_name, (bySku.get(r.sku_name) ?? 0) + (r.actual_sales_demo_day ?? 0));
    }
    const topSku = [...bySku.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const wowChangePct = prevSales != null && prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : null;

    trend.push({ weekCode: wc, promotionMechanics, sales, baseline: baseline || null, uplift, wowChangePct, topSku });
    prevSales = sales;
  }

  return trend;
}

export interface SkuPerformanceRow {
  skuCode: string | null;
  skuName: string;
  totalSales: number;
  weeklyTrend: { weekCode: string; sales: number }[];
}

export function getBrandProductPerformance(brandId: string): { best: SkuPerformanceRow[]; low: SkuPerformanceRow[] } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT week_code, sku_code, sku_name, actual_sales_demo_day
       FROM demo_session_performance WHERE brand_id = ? AND sku_name IS NOT NULL ORDER BY week_code`
    )
    .all(brandId) as { week_code: string; sku_code: string | null; sku_name: string; actual_sales_demo_day: number | null }[];

  const bySku = new Map<string, { skuCode: string | null; totalSales: number; weekly: Map<string, number> }>();
  for (const r of rows) {
    if (!bySku.has(r.sku_name)) bySku.set(r.sku_name, { skuCode: r.sku_code, totalSales: 0, weekly: new Map() });
    const entry = bySku.get(r.sku_name)!;
    entry.totalSales += r.actual_sales_demo_day ?? 0;
    entry.weekly.set(r.week_code, (entry.weekly.get(r.week_code) ?? 0) + (r.actual_sales_demo_day ?? 0));
  }

  const all: SkuPerformanceRow[] = [...bySku.entries()].map(([skuName, v]) => ({
    skuCode: v.skuCode,
    skuName,
    totalSales: v.totalSales,
    weeklyTrend: [...v.weekly.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([weekCode, sales]) => ({ weekCode, sales })),
  }));

  const sorted = [...all].sort((a, b) => b.totalSales - a.totalSales);
  return {
    best: sorted.slice(0, 5),
    low: sorted.slice(-5).reverse(),
  };
}
