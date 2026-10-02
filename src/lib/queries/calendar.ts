import { getDb } from "../db/client";
import { computeCampaignStatus, computePromotionStatus } from "../db/status";
import type { ControlStatus, RiskLevel } from "../db/types";

export type CalendarItemType = "ACTIVE" | "EXECUTION" | "CONTROL" | "QUICKTASK";

export interface PreviewItem {
  label: string;
  type: CalendarItemType;
  risk?: RiskLevel;
}

export interface DayCellSummary {
  date: string;
  weekCode: string | null;
  executionCount: number;
  controlCount: number;
  activeCount: number;
  redCount: number;
  amberCount: number;
  previewItems: PreviewItem[];
}

export type CalendarWorkstream = "Retail/In-store" | "Digital" | "Promotion" | "A&P" | "Project/Management";

export interface MyControlItem {
  id: string;
  brand_name: string | null;
  campaign_name: string | null;
  title: string;
  shortLabel: string;
  leader_action: string;
  pic_role: string | null;
  status: ControlStatus;
  risk_level: RiskLevel;
  risk_reason: string | null;
  href: string;
  workstream: CalendarWorkstream;
}

export interface ExecutionItem {
  id: string;
  kind: string;
  shortLabel: string;
  brand_name: string | null;
  location: string | null;
  session_label: string | null;
  detail: string | null;
  href: string;
  workstream: CalendarWorkstream;
}

export interface ActiveItem {
  id: string;
  kind: "Campaign" | "Promotion" | "A&P Package";
  shortLabel: string;
  brand_name: string | null;
  name: string;
  detail: string | null;
  start_date: string | null;
  end_date: string | null;
  href: string;
  workstream: CalendarWorkstream;
}

export interface ImpactItem {
  id: string;
  title: string;
  detail: string;
  risk: RiskLevel;
  href: string;
}

export interface UpdateItem {
  id: string;
  shortLabel: string;
  href: string;
}

export interface QuickTaskCalendarItem {
  id: string;
  task: string;
  shortLabel: string;
  status: string;
  priority: string | null;
}

export interface DayDetail {
  date: string;
  weekCode: string | null;
  myControl: MyControlItem[];
  todaysExecution: ExecutionItem[];
  activeToday: ActiveItem[];
  upcomingImpact: ImpactItem[];
  updates: UpdateItem[];
  quickTasks: QuickTaskCalendarItem[];
  summary: string;
}

export interface MonthCalendarData {
  year: number;
  month: number; // 1-12
  days: DayCellSummary[];
  details: Record<string, DayDetail>;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function inRange(date: string, start: string | null, end: string | null): boolean {
  if (!start) return false;
  if (date < start) return false;
  if (end && date > end) return false;
  return true;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const DIGITAL_TAG: Record<string, string> = { Social: "SOCIAL", Website: "WEB", Email: "EMAIL", Video: "VIDEO" };

export function getMonthCalendarData(year: number, month: number): MonthCalendarData {
  const db = getDb();
  const lastDay = daysInMonth(year, month);
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const today = new Date().toISOString().slice(0, 10);

  const campaigns = db
    .prepare(
      `SELECT c.id, c.name, c.campaign_type, c.start_date, c.end_date, b.name as brand_name
       FROM campaigns c LEFT JOIN brands b ON b.id = c.brand_id
       WHERE c.start_date IS NOT NULL AND c.start_date <= ? AND (c.end_date IS NULL OR c.end_date >= ?)`
    )
    .all(monthEnd, monthStart) as {
    id: string;
    name: string;
    campaign_type: string | null;
    start_date: string | null;
    end_date: string | null;
    brand_name: string | null;
  }[];

  const promotions = db
    .prepare(
      `SELECT p.id, p.campaign_id, p.brand_id, p.channel, p.mechanic, p.start_date, p.end_date, p.status_override,
              b.name as brand_name, c.name as campaign_name
       FROM promotions p LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN campaigns c ON c.id = p.campaign_id
       WHERE p.start_date IS NOT NULL AND p.start_date <= ? AND (p.end_date IS NULL OR p.end_date >= ?)`
    )
    .all(monthEnd, monthStart) as {
    id: string;
    campaign_id: string | null;
    brand_id: string | null;
    channel: string;
    mechanic: string | null;
    start_date: string | null;
    end_date: string | null;
    status_override: string | null;
    brand_name: string | null;
    campaign_name: string | null;
  }[];

  const demoRows = db
    .prepare(
      `SELECT d.id, d.brand_id, d.location, d.session_label, d.sku_name, d.execution_date, d.week_code, d.status,
              b.name as brand_name
       FROM deliverables d LEFT JOIN brands b ON b.id = d.brand_id
       WHERE d.subtype = 'Demo' AND d.execution_date BETWEEN ? AND ?`
    )
    .all(monthStart, monthEnd) as {
    id: string;
    brand_id: string | null;
    location: string | null;
    session_label: string | null;
    sku_name: string | null;
    execution_date: string;
    week_code: string | null;
    status: string;
    brand_name: string | null;
  }[];

  const controlRows = db
    .prepare(
      `SELECT ct.*, d.workstream, d.subtype, d.brand_id, d.campaign_id, d.location, b.name as brand_name, c.name as campaign_name
       FROM control_tasks ct
       JOIN deliverables d ON d.id = ct.deliverable_id
       LEFT JOIN brands b ON b.id = d.brand_id
       LEFT JOIN campaigns c ON c.id = d.campaign_id
       WHERE ct.control_date BETWEEN ? AND ?`
    )
    .all(monthStart, monthEnd) as Array<{
    id: string;
    deliverable_id: string;
    leader_action: string;
    title: string;
    control_date: string;
    week_code: string | null;
    status: ControlStatus;
    risk_level: RiskLevel;
    risk_reason: string | null;
    pic_role: string | null;
    workstream: string;
    subtype: string;
    brand_id: string | null;
    campaign_id: string | null;
    location: string | null;
    brand_name: string | null;
    campaign_name: string | null;
  }>;

  const apLines = db
    .prepare(
      `SELECT l.*, p.name as package_name, p.brand_id, b.name as brand_name
       FROM ap_delivery_lines l JOIN ap_packages p ON p.id = l.package_id LEFT JOIN brands b ON b.id = p.brand_id
       WHERE l.period_end BETWEEN ? AND ?`
    )
    .all(monthStart, monthEnd) as Array<{
    id: string;
    package_id: string;
    package_name: string;
    deliverable_type: string;
    agreed_label: string | null;
    delivered_quantity: number | null;
    agreed_quantity: number | null;
    evidence_status: string;
    reported: number;
    status: string;
    period_end: string;
    brand_id: string | null;
    brand_name: string | null;
  }>;

  const digitalRows = db
    .prepare(
      `SELECT d.id, d.subtype, d.channel_scope, d.platform, d.title, d.status, d.brand_id, d.campaign_id,
              d.planned_date, d.post_date, b.name as brand_name, c.name as campaign_name
       FROM digital_activities d
       LEFT JOIN brands b ON b.id = d.brand_id
       LEFT JOIN campaigns c ON c.id = d.campaign_id
       WHERE COALESCE(d.post_date, d.planned_date) BETWEEN ? AND ?`
    )
    .all(monthStart, monthEnd) as Array<{
    id: string;
    subtype: string;
    channel_scope: string;
    platform: string | null;
    title: string;
    status: string | null;
    brand_id: string | null;
    campaign_id: string | null;
    planned_date: string | null;
    post_date: string | null;
    brand_name: string | null;
    campaign_name: string | null;
  }>;

  const supplyRows = db
    .prepare(`SELECT id, supplier, container_no, eta, status FROM supply_signals WHERE eta BETWEEN ? AND ?`)
    .all(monthStart, monthEnd) as Array<{ id: string; supplier: string | null; container_no: string | null; eta: string; status: string | null }>;

  const quickTaskRows = db
    .prepare(`SELECT id, task, due_date, status, priority FROM quick_tasks WHERE due_date BETWEEN ? AND ? AND status IN ('OPEN','WAITING')`)
    .all(monthStart, monthEnd) as Array<{ id: string; task: string; due_date: string; status: string; priority: string | null }>;

  const weekRows = db.prepare("SELECT week_code, start_date, end_date FROM weeks WHERE start_date <= ? AND end_date >= ?").all(monthEnd, monthStart) as {
    week_code: string;
    start_date: string;
    end_date: string;
  }[];

  function weekCodeFor(date: string): string | null {
    return weekRows.find((w) => date >= w.start_date && date <= w.end_date)?.week_code ?? null;
  }

  const days: DayCellSummary[] = [];
  const details: Record<string, DayDetail> = {};

  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    const weekCode = weekCodeFor(date);

    const dayCampaigns = campaigns.filter((c) => inRange(date, c.start_date, c.end_date));
    const dayPromotions = promotions.filter((p) => inRange(date, p.start_date, p.end_date));
    const dayDemo = demoRows.filter((r) => r.execution_date === date);
    const dayControls = controlRows.filter((r) => r.control_date === date);
    const dayAp = apLines.filter((l) => l.period_end === date);
    const dayDigital = digitalRows.filter((r) => (r.post_date ?? r.planned_date) === date);
    const daySupply = supplyRows.filter((s) => s.eta === date);
    const dayQuickTasks = quickTaskRows.filter((q) => q.due_date === date);

    // Group promotions by campaign+channel for the Active Today panel (never list per-SKU).
    const promoGroups = new Map<string, { campaign_name: string | null; brand_name: string | null; channel: string; count: number; campaign_id: string | null }>();
    for (const p of dayPromotions) {
      const key = `${p.campaign_id ?? "none"}__${p.channel}`;
      const g = promoGroups.get(key) ?? { campaign_name: p.campaign_name, brand_name: p.brand_name, channel: p.channel, count: 0, campaign_id: p.campaign_id };
      g.count++;
      promoGroups.set(key, g);
    }

    const myControl: MyControlItem[] = dayControls
      .sort((a, b) => (a.risk_level === "RED" ? -1 : b.risk_level === "RED" ? 1 : 0))
      .map((c) => ({
        id: c.id,
        brand_name: c.brand_name,
        campaign_name: c.campaign_name,
        title: c.title,
        shortLabel: c.subtype === "Demo" ? `[DEMO] ${truncate(c.location ?? c.brand_name ?? "Demo", 16)}` : `[${c.subtype.slice(0, 5).toUpperCase()}] ${truncate(c.brand_name ?? c.campaign_name ?? c.subtype, 14)}`,
        leader_action: c.leader_action,
        pic_role: c.pic_role,
        status: c.status,
        risk_level: c.risk_level,
        risk_reason: c.risk_reason,
        href: c.campaign_id ? `/campaigns/${encodeURIComponent(c.campaign_id)}` : "/in-store",
        workstream: "Retail/In-store",
      }));

    // A&P report milestones are also Leader Control items on their deadline date.
    for (const l of dayAp) {
      const completeness = l.agreed_quantity ? Math.round(((l.delivered_quantity ?? 0) / l.agreed_quantity) * 100) : null;
      const atRisk = l.evidence_status !== "COMPLETE";
      myControl.push({
        id: l.id,
        brand_name: l.brand_name,
        campaign_name: l.package_name,
        title: `${l.deliverable_type} — Report Deadline`,
        shortLabel: `[A&P] ${truncate(l.brand_name ?? l.deliverable_type, 14)}`,
        leader_action: "Review",
        pic_role: "A&P Marketing",
        status: l.reported ? "DELIVERED" : "WAITING FOR LEADER REVIEW",
        risk_level: atRisk ? "AMBER" : "GREEN",
        risk_reason: completeness != null ? `${completeness}% delivered/evidenced` : null,
        href: `/ap/delivery/${encodeURIComponent(l.id)}`,
        workstream: "A&P",
      });
    }

    const todaysExecution: ExecutionItem[] = [
      ...dayDemo.map((r) => ({
        id: r.id,
        kind: "Demo",
        shortLabel: `[DEMO] ${truncate(r.location ?? r.brand_name ?? "Demo", 16)}`,
        brand_name: r.brand_name,
        location: r.location,
        session_label: r.session_label,
        detail: r.sku_name,
        href: "/in-store",
        workstream: "Retail/In-store" as const,
      })),
      ...dayDigital.map((r) => ({
        id: r.id,
        kind: r.subtype,
        shortLabel: `[${DIGITAL_TAG[r.subtype] ?? r.subtype.toUpperCase()}] ${truncate(r.brand_name ?? r.title, 14)}`,
        brand_name: r.brand_name,
        location: null,
        session_label: r.channel_scope,
        detail: r.title,
        href: `/digital/${encodeURIComponent(r.id)}`,
        workstream: "Digital" as const,
      })),
    ];

    const activeToday: ActiveItem[] = [
      ...dayCampaigns.map((c) => ({
        id: c.id,
        kind: "Campaign" as const,
        shortLabel: `${c.campaign_type ?? "MO"} · ${truncate(c.name.replace(/^.*—\s*/, ""), 12)}`,
        brand_name: c.brand_name,
        name: c.name,
        detail: c.campaign_type,
        start_date: c.start_date,
        end_date: c.end_date,
        href: `/campaigns/${encodeURIComponent(c.id)}`,
        workstream: "Promotion" as const,
      })),
      ...[...promoGroups.values()].map((g, i) => ({
        id: `promo-group-${i}`,
        kind: "Promotion" as const,
        shortLabel: `[PROMO] ${truncate(g.campaign_name ?? g.channel, 14)}`,
        brand_name: g.brand_name,
        name: g.campaign_name ?? "Promotion",
        detail: `${g.channel} · ${g.count} SKU${g.count > 1 ? "s" : ""}`,
        start_date: null,
        end_date: null,
        href: g.campaign_id ? `/promotions?campaignId=${encodeURIComponent(g.campaign_id)}` : "/promotions",
        workstream: "Promotion" as const,
      })),
    ];

    const upcomingImpact: ImpactItem[] = dayControls
      .filter((c) => c.risk_level !== "GREEN" && c.risk_reason)
      .map((c) => ({
        id: c.id,
        title: c.title,
        detail: c.risk_reason ?? "",
        risk: c.risk_level,
        href: c.campaign_id ? `/campaigns/${encodeURIComponent(c.campaign_id)}` : "/in-store",
      }));

    const updates: UpdateItem[] = daySupply.map((s) => ({
      id: s.id,
      shortLabel: `Container ETA · ${truncate(s.supplier ?? s.container_no ?? "—", 16)}`,
      href: "/import?tab=DATA_HEALTH",
    }));

    const quickTasksToday: QuickTaskCalendarItem[] = dayQuickTasks.map((q) => ({
      id: q.id,
      task: q.task,
      shortLabel: truncate(q.task, 24),
      status: q.status,
      priority: q.priority,
    }));

    const redCount = myControl.filter((c) => c.risk_level === "RED").length;
    const amberCount = myControl.filter((c) => c.risk_level === "AMBER").length;

    const previewItems: PreviewItem[] = [
      ...myControl.slice(0, 3).map((c) => ({ label: c.shortLabel, type: "CONTROL" as const, risk: c.risk_level })),
      ...todaysExecution.slice(0, 3).map((e) => ({ label: e.shortLabel, type: "EXECUTION" as const })),
      ...quickTasksToday.slice(0, 2).map((q) => ({ label: q.shortLabel, type: "QUICKTASK" as const })),
      ...dayCampaigns.slice(0, 2).map((c) => ({ label: `${c.campaign_type ?? "MO"} · ${truncate(c.name.replace(/^.*—\s*/, ""), 10)}`, type: "ACTIVE" as const })),
    ];

    days.push({
      date,
      weekCode,
      executionCount: todaysExecution.length,
      controlCount: myControl.length,
      activeCount: dayCampaigns.length + promoGroups.size,
      redCount,
      amberCount,
      previewItems,
    });

    details[date] = {
      date,
      weekCode,
      myControl,
      todaysExecution,
      activeToday,
      upcomingImpact,
      updates,
      quickTasks: quickTasksToday,
      summary: generateDailySummary(date, { myControl, todaysExecution, activeToday, upcomingImpact }, today),
    };
  }

  return { year, month, days, details };
}

function generateDailySummary(
  date: string,
  data: Pick<DayDetail, "myControl" | "todaysExecution" | "activeToday" | "upcomingImpact">,
  today: string
): string {
  const sentences: string[] = [];
  const campaignCount = data.activeToday.filter((a) => a.kind === "Campaign").length;
  const promoCount = data.activeToday.filter((a) => a.kind === "Promotion").length;

  if (campaignCount || promoCount) {
    const parts = [];
    if (campaignCount) parts.push(`${campaignCount} campaign${campaignCount > 1 ? "s" : ""}`);
    if (promoCount) parts.push(`${promoCount} promotion group${promoCount > 1 ? "s" : ""}`);
    const verb = parts.length > 1 || campaignCount > 1 || promoCount > 1 ? "are" : "is";
    sentences.push(`${parts.join(" and ")} ${verb} live.`);
  }
  if (data.todaysExecution.length) {
    sentences.push(`${data.todaysExecution.length} execution${data.todaysExecution.length > 1 ? "s are" : " is"} scheduled.`);
  }
  if (data.myControl.length) {
    sentences.push(`${data.myControl.length} item${data.myControl.length > 1 ? "s" : ""} require${data.myControl.length > 1 ? "" : "s"} your review.`);
  }
  const atRisk = data.upcomingImpact.filter((i) => i.risk === "RED" || i.risk === "AMBER").length;
  if (atRisk) {
    sentences.push(`${atRisk} item${atRisk > 1 ? "s are" : " is"} at risk.`);
  }
  if (sentences.length === 0) {
    sentences.push(date === today ? "Nothing scheduled today." : "Nothing scheduled on this date.");
  }
  return sentences.join(" ");
}

export function getWeekCodeForDate(date: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT week_code FROM weeks WHERE start_date <= ? AND end_date >= ?").get(date, date) as
    | { week_code: string }
    | undefined;
  return row?.week_code ?? null;
}

// Re-export for convenience where only status helpers are needed alongside calendar data.
export { computeCampaignStatus, computePromotionStatus };
