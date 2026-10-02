import { getDb } from "../db/client";
import type { DigitalActivity } from "../db/types";

export type DigitalQuickFilter =
  | "ALL"
  | "SOCIAL"
  | "WEBSITE"
  | "EMAIL"
  | "VIDEO"
  | "RETAIL"
  | "WHOLESALE"
  | "LIVE"
  | "UPCOMING"
  | "NEED INFO"
  | "NEED AUDIT";

export interface DigitalActivityRow extends DigitalActivity {
  brand_name: string | null;
  campaign_name: string | null;
}

const BASE_SQL = `
  SELECT d.*, b.name as brand_name, c.name as campaign_name
  FROM digital_activities d
  LEFT JOIN brands b ON b.id = d.brand_id
  LEFT JOIN campaigns c ON c.id = d.campaign_id
`;

export interface DigitalFilters {
  quick?: DigitalQuickFilter;
  platform?: string;
  brandId?: string;
  campaignId?: string;
  weekCode?: string;
}

export function listDigitalActivities(filters: DigitalFilters = {}): DigitalActivityRow[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  const subtypeMap: Partial<Record<DigitalQuickFilter, string>> = {
    SOCIAL: "Social",
    WEBSITE: "Website",
    EMAIL: "Email",
    VIDEO: "Video",
  };
  const quick = filters.quick ?? "ALL";
  if (subtypeMap[quick]) {
    clauses.push("d.subtype = ?");
    params.push(subtypeMap[quick]);
  }
  if (quick === "RETAIL") {
    clauses.push("d.channel_scope = 'RETAIL'");
  }
  if (quick === "WHOLESALE") {
    clauses.push("d.channel_scope = 'WHOLESALE'");
  }
  if (quick === "NEED INFO") {
    clauses.push("d.status IS NULL");
  }
  if (quick === "NEED AUDIT") {
    clauses.push("(d.approval_status IS NULL OR d.approval_status = '')");
  }

  if (filters.platform) {
    clauses.push("d.platform = ?");
    params.push(filters.platform);
  }
  if (filters.brandId) {
    clauses.push("d.brand_id = ?");
    params.push(filters.brandId);
  }
  if (filters.campaignId) {
    clauses.push("d.campaign_id = ?");
    params.push(filters.campaignId);
  }
  if (filters.weekCode) {
    clauses.push("d.week_code = ?");
    params.push(filters.weekCode);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(`${BASE_SQL} ${where} ORDER BY d.planned_date DESC, d.subtype LIMIT 300`)
    .all(...params) as DigitalActivityRow[];
}

export function getDigitalQuickCounts(): Record<DigitalQuickFilter, number> {
  const db = getDb();
  const bySubtype = db.prepare("SELECT subtype, COUNT(*) c FROM digital_activities GROUP BY subtype").all() as {
    subtype: string;
    c: number;
  }[];
  const byScope = db.prepare("SELECT channel_scope, COUNT(*) c FROM digital_activities GROUP BY channel_scope").all() as {
    channel_scope: string;
    c: number;
  }[];
  const total = (db.prepare("SELECT COUNT(*) c FROM digital_activities").get() as { c: number }).c;
  const needInfo = (db.prepare("SELECT COUNT(*) c FROM digital_activities WHERE status IS NULL").get() as { c: number }).c;
  const needAudit = (
    db.prepare("SELECT COUNT(*) c FROM digital_activities WHERE approval_status IS NULL OR approval_status = ''").get() as {
      c: number;
    }
  ).c;

  const find = (arr: { c: number }[], key: string, prop: string) =>
    (arr.find((r) => (r as unknown as Record<string, string>)[prop] === key)?.c as number) ?? 0;

  return {
    ALL: total,
    SOCIAL: find(bySubtype, "Social", "subtype"),
    WEBSITE: find(bySubtype, "Website", "subtype"),
    EMAIL: find(bySubtype, "Email", "subtype"),
    VIDEO: find(bySubtype, "Video", "subtype"),
    RETAIL: find(byScope, "RETAIL", "channel_scope"),
    WHOLESALE: find(byScope, "WHOLESALE", "channel_scope"),
    LIVE: 0,
    UPCOMING: 0,
    "NEED INFO": needInfo,
    "NEED AUDIT": needAudit,
  };
}

export interface DigitalWeekSummary {
  social: number;
  retailEmail: number;
  wholesaleEmail: number;
  website: number;
  video: number;
  needAudit: number;
  waitingInfo: number;
}

export function getDigitalWeekSummary(weekCode: string): DigitalWeekSummary {
  const db = getDb();
  const bySubtypeScope = db
    .prepare("SELECT subtype, channel_scope, COUNT(*) c FROM digital_activities WHERE week_code = ? GROUP BY subtype, channel_scope")
    .all(weekCode) as { subtype: string; channel_scope: string; c: number }[];
  const find = (subtype: string, scope?: string) =>
    bySubtypeScope.filter((r) => r.subtype === subtype && (!scope || r.channel_scope === scope)).reduce((n, r) => n + r.c, 0);

  const needAudit = (
    db.prepare("SELECT COUNT(*) c FROM digital_activities WHERE week_code = ? AND (approval_status IS NULL OR approval_status = '')").get(weekCode) as { c: number }
  ).c;
  const waitingInfo = (db.prepare("SELECT COUNT(*) c FROM digital_activities WHERE week_code = ? AND status IS NULL").get(weekCode) as { c: number }).c;

  return {
    social: find("Social"),
    retailEmail: find("Email", "RETAIL"),
    wholesaleEmail: find("Email", "WHOLESALE"),
    website: find("Website"),
    video: find("Video"),
    needAudit,
    waitingInfo,
  };
}

export function getDigitalActivity(id: string): DigitalActivityRow | undefined {
  const db = getDb();
  return db.prepare(`${BASE_SQL} WHERE d.id = ?`).get(id) as DigitalActivityRow | undefined;
}

export function getLinkedSupplySignal(supplySignalId: string | null) {
  if (!supplySignalId) return undefined;
  const db = getDb();
  return db.prepare("SELECT * FROM supply_signals WHERE id = ?").get(supplySignalId);
}

export interface DigitalDayItem {
  id: string;
  subtype: string;
  platform: string | null;
  channel_scope: string;
  title: string;
  brand_name: string | null;
  status: string | null;
}

export interface DigitalMonthData {
  year: number;
  month: number;
  days: Record<string, DigitalDayItem[]>;
}

const PLATFORM_TAG: Record<string, string> = { Social: "SOCIAL", Website: "WEB", Email: "EMAIL", Video: "VIDEO" };

export function platformTag(item: { subtype: string; platform: string | null }): string {
  if (item.platform) {
    const p = item.platform.toLowerCase();
    if (p.includes("facebook") || p === "fb") return "FB";
    if (p.includes("insta") || p === "ig") return "IG";
    if (p.includes("tiktok")) return "TT";
    if (p.includes("youtube") || p === "yt") return "YT";
  }
  return PLATFORM_TAG[item.subtype] ?? item.subtype.slice(0, 4).toUpperCase();
}

export interface SocialPlannerRow {
  id: string;
  planned_date: string | null;
  platform: string | null;
  title: string;
  campaign_name: string | null;
  brand_name: string | null;
  info_status: "READY" | "WAITING INFO";
  content_status: string;
  audit: "✓" | "!";
}

/** Date-first content planner — never grouped by brand as the primary axis. */
export function getSocialPlanner(): SocialPlannerRow[] {
  const db = getDb();
  const rows = db
    .prepare(`${BASE_SQL} WHERE d.subtype = 'Social' ORDER BY COALESCE(d.post_date, d.planned_date) DESC LIMIT 200`)
    .all() as DigitalActivityRow[];
  return rows.map((r) => ({
    id: r.id,
    planned_date: r.post_date ?? r.planned_date,
    platform: r.platform,
    title: r.title,
    campaign_name: r.campaign_name,
    brand_name: r.brand_name,
    info_status: r.status ? "READY" : "WAITING INFO",
    content_status: r.status ?? "—",
    audit: r.approval_status ? "✓" : "!",
  }));
}

export interface EmailLaneRow {
  id: string;
  title: string;
  brand_name: string | null;
  post_date: string | null;
  status: string | null;
}

export function getEmailLanes(): { retail: EmailLaneRow[]; wholesale: EmailLaneRow[] } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.id, d.title, d.channel_scope, d.post_date, d.planned_date, d.status, b.name as brand_name
       FROM digital_activities d LEFT JOIN brands b ON b.id = d.brand_id
       WHERE d.subtype = 'Email' ORDER BY COALESCE(d.post_date, d.planned_date) DESC LIMIT 200`
    )
    .all() as Array<{ id: string; title: string; channel_scope: string; post_date: string | null; planned_date: string | null; status: string | null; brand_name: string | null }>;

  const toRow = (r: (typeof rows)[number]): EmailLaneRow => ({ id: r.id, title: r.title, brand_name: r.brand_name, post_date: r.post_date ?? r.planned_date, status: r.status });
  return {
    retail: rows.filter((r) => r.channel_scope === "RETAIL").map(toRow),
    wholesale: rows.filter((r) => r.channel_scope === "WHOLESALE").map(toRow),
  };
}

export interface WebsiteRow {
  id: string;
  title: string;
  channel_scope: string;
  planned_date: string | null;
  status: string | null;
  needCheck: boolean;
}

export function getWebsitePanel(): { recent: WebsiteRow[]; upcoming: WebsiteRow[] } {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT d.id, d.title, d.channel_scope, COALESCE(d.post_date, d.planned_date) as planned_date, d.status
       FROM digital_activities d WHERE d.subtype = 'Website' ORDER BY planned_date DESC LIMIT 200`
    )
    .all() as Array<{ id: string; title: string; channel_scope: string; planned_date: string | null; status: string | null }>;

  const toRow = (r: (typeof rows)[number]): WebsiteRow => ({ ...r, needCheck: !r.status });
  return {
    recent: rows.filter((r) => (r.planned_date ?? "") <= today).map(toRow),
    upcoming: rows.filter((r) => (r.planned_date ?? "") > today).map(toRow),
  };
}

export function getDigitalMonthData(year: number, month: number, filters: DigitalFilters = {}): DigitalMonthData {
  const db = getDb();
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;

  const clauses = ["COALESCE(d.post_date, d.planned_date) BETWEEN ? AND ?"];
  const params: unknown[] = [monthStart, monthEnd];

  const subtypeMap: Partial<Record<DigitalQuickFilter, string>> = { SOCIAL: "Social", WEBSITE: "Website", EMAIL: "Email", VIDEO: "Video" };
  if (filters.quick && subtypeMap[filters.quick]) {
    clauses.push("d.subtype = ?");
    params.push(subtypeMap[filters.quick]);
  }
  if (filters.quick === "RETAIL") clauses.push("d.channel_scope = 'RETAIL'");
  if (filters.quick === "WHOLESALE") clauses.push("d.channel_scope = 'WHOLESALE'");
  if (filters.quick === "NEED AUDIT") clauses.push("(d.approval_status IS NULL OR d.approval_status = '')");

  const rows = db
    .prepare(
      `SELECT d.id, d.subtype, d.platform, d.channel_scope, d.title, d.status, COALESCE(d.post_date, d.planned_date) as day, b.name as brand_name
       FROM digital_activities d LEFT JOIN brands b ON b.id = d.brand_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY d.subtype`
    )
    .all(...params) as Array<DigitalDayItem & { day: string }>;

  const days: Record<string, DigitalDayItem[]> = {};
  for (const r of rows) {
    (days[r.day] ??= []).push(r);
  }
  return { year, month, days };
}
