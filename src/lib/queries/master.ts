import { getDb } from "../db/client";
import type {
  MasterApChecklistItem,
  MasterApPlaybookStep,
  MasterCalendarMonth,
  MasterCampaignRule,
  MasterCampaignType,
  MasterCoverageTerm,
  MasterHandbookEntry,
  MasterService,
  MasterWorkstream,
} from "../db/types";

// ── 1. Services & Rate Card ─────────────────────────────────────────────────

export function listServiceYears(): number[] {
  const db = getDb();
  return (db.prepare("SELECT DISTINCT year FROM master_services ORDER BY year DESC").all() as { year: number }[]).map((r) => r.year);
}

export function listServiceCategories(year?: number): string[] {
  const db = getDb();
  if (year) {
    return (db.prepare("SELECT DISTINCT category FROM master_services WHERE year = ? ORDER BY category").all(year) as { category: string }[]).map((r) => r.category);
  }
  return (db.prepare("SELECT DISTINCT category FROM master_services ORDER BY category").all() as { category: string }[]).map((r) => r.category);
}

export function listServices(filters: { year?: number; category?: string } = {}): MasterService[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.year) { clauses.push("year = ?"); params.push(filters.year); }
  if (filters.category) { clauses.push("category = ?"); params.push(filters.category); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM master_services ${where} ORDER BY category, sort_order`).all(...params) as MasterService[];
}

/** Same service_name across two years, side by side — for the 2026/2027 rate
 *  comparison view. Only pairs where the name matches; rows with no counterpart
 *  in the other year are returned with a null partner rather than hidden. */
export interface ServiceComparisonRow {
  service_name: string;
  category: string;
  a: MasterService | null;
  b: MasterService | null;
}

export function compareServiceYears(yearA: number, yearB: number): ServiceComparisonRow[] {
  const aRows = listServices({ year: yearA });
  const bRows = listServices({ year: yearB });
  const key = (s: MasterService) => `${s.service_name}__${s.package ?? ""}`;
  const bByKey = new Map(bRows.map((s) => [key(s), s]));
  const seen = new Set<string>();
  const out: ServiceComparisonRow[] = [];
  for (const a of aRows) {
    const k = key(a);
    seen.add(k);
    out.push({ service_name: a.service_name + (a.package ? ` — ${a.package}` : ""), category: a.category, a, b: bByKey.get(k) ?? null });
  }
  for (const b of bRows) {
    const k = key(b);
    if (seen.has(k)) continue;
    out.push({ service_name: b.service_name + (b.package ? ` — ${b.package}` : ""), category: b.category, a: null, b });
  }
  return out;
}

export function listCoverageTerms(year?: number): MasterCoverageTerm[] {
  const db = getDb();
  if (year) return db.prepare("SELECT * FROM master_coverage_terms WHERE year = ? ORDER BY term_type, sort_order").all(year) as MasterCoverageTerm[];
  return db.prepare("SELECT * FROM master_coverage_terms ORDER BY term_type, sort_order").all() as MasterCoverageTerm[];
}

// ── 2. Campaign Knowledge ───────────────────────────────────────────────────

export function listCampaignTypes(): MasterCampaignType[] {
  const db = getDb();
  return db.prepare("SELECT * FROM master_campaign_types ORDER BY sort_order").all() as MasterCampaignType[];
}

export function getCampaignType(id: string): MasterCampaignType | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM master_campaign_types WHERE id = ?").get(id) as MasterCampaignType | undefined;
}

// ── 3. Annual Campaign Calendar ─────────────────────────────────────────────

export function listCalendarYears(): number[] {
  const db = getDb();
  return (db.prepare("SELECT DISTINCT year FROM master_calendar_months ORDER BY year DESC").all() as { year: number }[]).map((r) => r.year);
}

export function listCalendarMonths(year: number): MasterCalendarMonth[] {
  const db = getDb();
  return db.prepare("SELECT * FROM master_calendar_months WHERE year = ? ORDER BY month_number").all(year) as MasterCalendarMonth[];
}

// ── 4. A&P Proposal Playbook ─────────────────────────────────────────────────

export function listApPlaybookSteps(): MasterApPlaybookStep[] {
  const db = getDb();
  return db.prepare("SELECT * FROM master_ap_playbook_steps ORDER BY step_order").all() as MasterApPlaybookStep[];
}

export function listApChecklist(): MasterApChecklistItem[] {
  const db = getDb();
  return db.prepare("SELECT * FROM master_ap_checklist_items ORDER BY sort_order").all() as MasterApChecklistItem[];
}

// ── 5. Marketing Operations Handbook ────────────────────────────────────────

export function listWorkstreams(): MasterWorkstream[] {
  const db = getDb();
  return db.prepare("SELECT * FROM master_workstreams ORDER BY sort_order").all() as MasterWorkstream[];
}

/** Campaign Knowledge / Rules — operational SOPs (Weekly Promotion Update,
 *  Force De-active, Demo Checklist, Website Banner reference...), shown the
 *  same collapsed/click-to-expand way as Team Workstreams. */
export function listCampaignRules(): MasterCampaignRule[] {
  const db = getDb();
  return db.prepare("SELECT * FROM master_campaign_rules ORDER BY sort_order").all() as MasterCampaignRule[];
}

export function listHandbookEntries(): MasterHandbookEntry[] {
  const db = getDb();
  return db.prepare("SELECT * FROM master_handbook_entries ORDER BY category, sort_order").all() as MasterHandbookEntry[];
}

export function listHandbookCategories(): string[] {
  const db = getDb();
  return (db.prepare("SELECT DISTINCT category FROM master_handbook_entries ORDER BY category").all() as { category: string }[]).map((r) => r.category);
}

// ── Home: search, recently updated, needs verification ─────────────────────

export interface MasterSearchResult {
  kind: "SERVICE" | "CAMPAIGN_TYPE" | "HANDBOOK" | "CALENDAR";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function searchMasterKnowledge(query: string): MasterSearchResult[] {
  if (!query.trim()) return [];
  const db = getDb();
  const like = `%${query.trim()}%`;
  const results: MasterSearchResult[] = [];

  const services = db
    .prepare("SELECT id, service_name, category, year, package FROM master_services WHERE service_name LIKE ? OR description LIKE ? OR category LIKE ? LIMIT 20")
    .all(like, like, like) as { id: string; service_name: string; category: string; year: number; package: string | null }[];
  for (const s of services) {
    results.push({ kind: "SERVICE", id: s.id, title: s.service_name + (s.package ? ` — ${s.package}` : ""), subtitle: `${s.category} · ${s.year}`, href: `/master/services?year=${s.year}&category=${encodeURIComponent(s.category)}` });
  }

  const campaignTypes = db
    .prepare("SELECT id, name, what_it_is FROM master_campaign_types WHERE name LIKE ? OR what_it_is LIKE ? OR notes LIKE ? LIMIT 20")
    .all(like, like, like) as { id: string; name: string; what_it_is: string | null }[];
  for (const c of campaignTypes) {
    results.push({ kind: "CAMPAIGN_TYPE", id: c.id, title: c.name, subtitle: c.what_it_is ?? "", href: `/master/campaigns#${c.id}` });
  }

  const handbook = db
    .prepare("SELECT id, title, category, body FROM master_handbook_entries WHERE title LIKE ? OR body LIKE ? OR category LIKE ? LIMIT 20")
    .all(like, like, like) as { id: string; title: string; category: string; body: string | null }[];
  for (const h of handbook) {
    results.push({ kind: "HANDBOOK", id: h.id, title: h.title, subtitle: h.category, href: `/master/operations#${h.id}` });
  }

  const calendar = db
    .prepare("SELECT id, campaign_name, theme, year, month_number FROM master_calendar_months WHERE campaign_name LIKE ? OR theme LIKE ? LIMIT 20")
    .all(like, like) as { id: string; campaign_name: string | null; theme: string | null; year: number; month_number: number }[];
  for (const c of calendar) {
    results.push({ kind: "CALENDAR", id: c.id, title: c.campaign_name ?? c.theme ?? "Calendar entry", subtitle: `${c.year} / Month ${c.month_number}`, href: `/master/calendar?year=${c.year}` });
  }

  const workstreams = db
    .prepare("SELECT id, pic_name, recurring_tasks FROM master_workstreams WHERE pic_name LIKE ? OR recurring_tasks LIKE ? OR important_rules LIKE ? LIMIT 20")
    .all(like, like, like) as { id: string; pic_name: string; recurring_tasks: string | null }[];
  for (const w of workstreams) {
    results.push({ kind: "HANDBOOK", id: w.id, title: w.pic_name, subtitle: "Team Workstream", href: `/master/operations#${w.id}` });
  }

  const campaignRules = db
    .prepare("SELECT id, rule_name, category FROM master_campaign_rules WHERE rule_name LIKE ? OR summary LIKE ? OR body LIKE ? LIMIT 20")
    .all(like, like, like) as { id: string; rule_name: string; category: string }[];
  for (const r of campaignRules) {
    results.push({ kind: "HANDBOOK", id: r.id, title: r.rule_name, subtitle: `Campaign Knowledge · ${r.category}`, href: `/master/operations#${r.id}` });
  }

  return results;
}

export interface RecentlyUpdatedRow {
  kind: string;
  title: string;
  subtitle: string;
  last_updated: string;
  href: string;
}

export function getRecentlyUpdated(limit = 8): RecentlyUpdatedRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT 'Service' as kind, service_name as title, category as subtitle, last_updated, '/master/services?year=' || year as href FROM master_services
       UNION ALL
       SELECT 'Campaign Type', name, 'Campaign Knowledge', last_updated, '/master/campaigns' FROM master_campaign_types
       UNION ALL
       SELECT 'Handbook', title, category, last_updated, '/master/operations' FROM master_handbook_entries
       UNION ALL
       SELECT 'Calendar', COALESCE(campaign_name, theme, 'Calendar entry'), 'Annual Campaign Calendar', last_updated, '/master/calendar' FROM master_calendar_months
       UNION ALL
       SELECT 'Workstream', pic_name, 'Team Workstream', last_updated, '/master/operations' FROM master_workstreams
       UNION ALL
       SELECT 'Campaign Rule', rule_name, category, last_updated, '/master/operations' FROM master_campaign_rules
       ORDER BY last_updated DESC
       LIMIT ?`
    )
    .all(limit) as RecentlyUpdatedRow[];
  return rows;
}

export interface NeedsVerificationRow {
  kind: string;
  title: string;
  subtitle: string;
  note: string | null;
  href: string;
}

export function getNeedsVerification(): NeedsVerificationRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT 'Service' as kind, service_name as title, category as subtitle, notes as note, '/master/services?year=' || year as href FROM master_services WHERE status = 'NEEDS VERIFICATION'
       UNION ALL
       SELECT 'Campaign Type', name, 'Campaign Knowledge', notes, '/master/campaigns' FROM master_campaign_types WHERE status = 'NEEDS VERIFICATION'
       UNION ALL
       SELECT 'Handbook', title, category, NULL, '/master/operations' FROM master_handbook_entries WHERE status = 'NEEDS VERIFICATION'
       UNION ALL
       SELECT 'Calendar', COALESCE(campaign_name, theme, 'Calendar entry'), 'Annual Campaign Calendar', NULL, '/master/calendar' FROM master_calendar_months WHERE status = 'NEEDS VERIFICATION'
       UNION ALL
       SELECT 'Workstream', pic_name, 'Team Workstream', NULL, '/master/operations' FROM master_workstreams WHERE status = 'NEEDS VERIFICATION'
       UNION ALL
       SELECT 'Campaign Rule', rule_name, category, NULL, '/master/operations' FROM master_campaign_rules WHERE status = 'NEEDS VERIFICATION'`
    )
    .all() as NeedsVerificationRow[];
}

export function getMasterQuickCounts(): { services: number; campaignTypes: number; calendarMonths: number; handbookEntries: number; needsVerification: number } {
  const db = getDb();
  const c = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  return {
    services: c("SELECT COUNT(*) c FROM master_services"),
    campaignTypes: c("SELECT COUNT(*) c FROM master_campaign_types"),
    calendarMonths: c("SELECT COUNT(*) c FROM master_calendar_months"),
    handbookEntries: c("SELECT COUNT(*) c FROM master_handbook_entries"),
    needsVerification: getNeedsVerification().length,
  };
}
