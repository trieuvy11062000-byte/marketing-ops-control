import type Database from "better-sqlite3";
import { classifyActivation, slugify } from "../import/utils";
import { computeRisk } from "./risk";
import type { ChannelScope, ControlStatus, DigitalSubtype, LeaderAction, PicRole, SupplySignalType, Workstream } from "./types";

export function upsertBrand(db: Database.Database, name: string, sourceTag: string): string {
  const id = slugify(name);
  db.prepare(
    `INSERT INTO brands (id, name, source_tag) VALUES (?, ?, ?)
     ON CONFLICT(id) DO NOTHING`
  ).run(id, name, sourceTag);
  return id;
}

export interface CampaignInput {
  id: string;
  brand_id: string | null;
  name: string;
  campaign_type: string | null;
  quarter: string | null;
  month: string | null;
  theme: string | null;
  commercial_value?: number | null;
  internal_pic?: string | null;
  external_contact?: string | null;
  sourceFile: string;
  sourceSheet: string;
}

/** Campaign is the orchestration parent — never a Promotion, never an A&P record.
 *  No status is written here; start_date/end_date/status are derived from linked
 *  promotions+deliverables via recomputeCampaignDateRanges(). */
export function upsertCampaign(db: Database.Database, input: CampaignInput): void {
  const existing = db.prepare("SELECT id, source_files FROM campaigns WHERE id = ?").get(input.id) as
    | { id: string; source_files: string | null }
    | undefined;

  const newSource = { file: input.sourceFile, sheet: input.sourceSheet };
  const { activationType, driver } = classifyActivation(input.campaign_type ?? "");
  const row = {
    id: input.id,
    brand_id: input.brand_id,
    name: input.name,
    campaign_type: input.campaign_type,
    activation_type: activationType,
    driver,
    quarter: input.quarter,
    month: input.month,
    theme: input.theme,
    commercial_value: input.commercial_value ?? null,
    internal_pic: input.internal_pic ?? null,
    external_contact: input.external_contact ?? null,
  };

  if (!existing) {
    db.prepare(
      `INSERT INTO campaigns (id, brand_id, name, campaign_type, activation_type, driver, quarter, month, theme,
          commercial_value, internal_pic, external_contact, source_files)
       VALUES (@id, @brand_id, @name, @campaign_type, @activation_type, @driver, @quarter, @month, @theme,
          @commercial_value, @internal_pic, @external_contact, @source_files)`
    ).run({ ...row, source_files: JSON.stringify([newSource]) });
    return;
  }

  const sources: { file: string; sheet: string }[] = existing.source_files ? JSON.parse(existing.source_files) : [];
  const already = sources.some((s) => s.file === newSource.file && s.sheet === newSource.sheet);
  if (!already) sources.push(newSource);

  db.prepare(
    `UPDATE campaigns SET
       brand_id = COALESCE(brand_id, @brand_id),
       name = COALESCE(NULLIF(name, ''), @name),
       theme = COALESCE(theme, @theme),
       quarter = COALESCE(quarter, @quarter),
       month = COALESCE(month, @month),
       driver = COALESCE(driver, @driver),
       commercial_value = COALESCE(commercial_value, @commercial_value),
       internal_pic = COALESCE(internal_pic, @internal_pic),
       external_contact = COALESCE(external_contact, @external_contact),
       source_files = @source_files,
       updated_at = datetime('now')
     WHERE id = @id`
  ).run({ ...row, source_files: JSON.stringify(sources) });
}

/** Widens each campaign's start/end date to cover every linked promotion + deliverable. Call after import. */
export function recomputeCampaignDateRanges(db: Database.Database): void {
  db.prepare(
    `UPDATE campaigns SET
       start_date = (
         SELECT MIN(d) FROM (
           SELECT MIN(start_date) as d FROM promotions WHERE campaign_id = campaigns.id
           UNION ALL
           SELECT MIN(execution_date) as d FROM deliverables WHERE campaign_id = campaigns.id
         ) WHERE d IS NOT NULL
       ),
       end_date = (
         SELECT MAX(d) FROM (
           SELECT MAX(end_date) as d FROM promotions WHERE campaign_id = campaigns.id
           UNION ALL
           SELECT MAX(execution_deadline) as d FROM deliverables WHERE campaign_id = campaigns.id
         ) WHERE d IS NOT NULL
       )`
  ).run();
}

export interface PromotionInput {
  id: string;
  brand_id: string | null;
  campaign_id: string | null;
  sku_code: string | null;
  sku_name: string | null;
  channel: "IN-STORE" | "ONLINE-RETAIL" | "ONLINE-WHOLESALE" | "LAST MILE" | "OTHER";
  customer_type?: string | null;
  mechanic: string | null;
  normal_price?: number | null;
  promotion_price?: number | null;
  discount_label?: string | null;
  start_date: string | null;
  end_date: string | null;
  stores_platform: string | null;
  stock_status?: string | null;
  setup_status: "PENDING" | "DONE";
  audit_status: "PENDING" | "AUDITED";
  week_code: string | null;
  source_file: string;
  source_sheet: string;
  source_row_ref: string | null;
}

export function upsertPromotion(db: Database.Database, input: PromotionInput): void {
  db.prepare(
    `INSERT INTO promotions (id, brand_id, campaign_id, sku_code, sku_name, channel, customer_type, mechanic,
        normal_price, promotion_price, discount_label, start_date, end_date, stores_platform, stock_status,
        setup_status, audit_status, week_code, source_file, source_sheet, source_row_ref, last_updated)
     VALUES (@id, @brand_id, @campaign_id, @sku_code, @sku_name, @channel, @customer_type, @mechanic,
        @normal_price, @promotion_price, @discount_label, @start_date, @end_date, @stores_platform, @stock_status,
        @setup_status, @audit_status, @week_code, @source_file, @source_sheet, @source_row_ref, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
        setup_status = excluded.setup_status,
        audit_status = excluded.audit_status,
        stock_status = excluded.stock_status,
        last_updated = datetime('now')`
  ).run({
    ...input,
    customer_type: input.customer_type ?? null,
    normal_price: input.normal_price ?? null,
    promotion_price: input.promotion_price ?? null,
    discount_label: input.discount_label ?? null,
    stock_status: input.stock_status ?? null,
  });
}

export interface DeliverableInput {
  id: string;
  campaign_id: string | null;
  brand_id: string | null;
  workstream: Workstream;
  subtype: string;
  sku_code: string | null;
  sku_name: string | null;
  location?: string | null;
  session_label?: string | null;
  pic_role: PicRole | null;
  raw_owner: string | null;
  execution_date: string | null;
  execution_deadline: string | null;
  week_code: string | null;
  evidence_required: 0 | 1;
  evidence_status: string | null;
  status: ControlStatus;
  source_file: string;
  source_sheet: string;
  source_row_ref: string | null;
}

export function upsertDeliverable(db: Database.Database, input: DeliverableInput): void {
  db.prepare(
    `INSERT INTO deliverables (id, campaign_id, brand_id, workstream, subtype, sku_code, sku_name, location,
        session_label, pic_role, raw_owner, execution_date, execution_deadline, week_code, evidence_required,
        evidence_status, status, source_file, source_sheet, source_row_ref, last_updated)
     VALUES (@id, @campaign_id, @brand_id, @workstream, @subtype, @sku_code, @sku_name, @location,
        @session_label, @pic_role, @raw_owner, @execution_date, @execution_deadline, @week_code, @evidence_required,
        @evidence_status, @status, @source_file, @source_sheet, @source_row_ref, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        evidence_status = excluded.evidence_status,
        last_updated = datetime('now')`
  ).run({ ...input, location: input.location ?? null, session_label: input.session_label ?? null });
}

export interface SupplySignalInput {
  id: string;
  signal_type: SupplySignalType;
  supplier: string | null;
  container_no: string | null;
  product_label?: string | null;
  eta: string | null;
  location?: string | null;
  note?: string | null;
  status?: string | null;
  channel_scope: ChannelScope;
  week_code: string | null;
  source_file: string;
  source_sheet: string;
  source_row_ref?: string | null;
}

export function upsertSupplySignal(db: Database.Database, input: SupplySignalInput): void {
  db.prepare(
    `INSERT INTO supply_signals (id, signal_type, supplier, container_no, product_label, eta, location, note,
        status, channel_scope, week_code, source_file, source_sheet, source_row_ref, last_updated)
     VALUES (@id, @signal_type, @supplier, @container_no, @product_label, @eta, @location, @note,
        @status, @channel_scope, @week_code, @source_file, @source_sheet, @source_row_ref, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
        eta = excluded.eta,
        status = excluded.status,
        last_updated = datetime('now')`
  ).run({
    ...input,
    product_label: input.product_label ?? null,
    location: input.location ?? null,
    note: input.note ?? null,
    status: input.status ?? null,
    source_row_ref: input.source_row_ref ?? null,
  });
}

export interface DigitalActivityInput {
  id: string;
  subtype: DigitalSubtype;
  channel_scope: ChannelScope;
  platform?: string | null;
  title: string;
  brand_id?: string | null;
  campaign_id?: string | null;
  supply_signal_id?: string | null;
  driver?: string | null;
  planned_date?: string | null;
  post_date?: string | null;
  status?: string | null;
  pic_role?: string | null;
  approval_status?: string | null;
  evidence_status?: string | null;
  week_code: string | null;
  source_file: string;
  source_sheet: string;
  source_row_ref?: string | null;
}

export function upsertDigitalActivity(db: Database.Database, input: DigitalActivityInput): void {
  db.prepare(
    `INSERT INTO digital_activities (id, subtype, channel_scope, platform, title, brand_id, campaign_id,
        supply_signal_id, driver, planned_date, post_date, status, pic_role, approval_status, evidence_status,
        week_code, source_file, source_sheet, source_row_ref, last_updated)
     VALUES (@id, @subtype, @channel_scope, @platform, @title, @brand_id, @campaign_id,
        @supply_signal_id, @driver, @planned_date, @post_date, @status, @pic_role, @approval_status, @evidence_status,
        @week_code, @source_file, @source_sheet, @source_row_ref, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        approval_status = excluded.approval_status,
        last_updated = datetime('now')`
  ).run({
    ...input,
    platform: input.platform ?? null,
    brand_id: input.brand_id ?? null,
    campaign_id: input.campaign_id ?? null,
    supply_signal_id: input.supply_signal_id ?? null,
    driver: input.driver ?? null,
    planned_date: input.planned_date ?? null,
    post_date: input.post_date ?? null,
    status: input.status ?? null,
    pic_role: input.pic_role ?? null,
    approval_status: input.approval_status ?? null,
    evidence_status: input.evidence_status ?? null,
    source_row_ref: input.source_row_ref ?? null,
  });
}

export interface ApPackageInput {
  id: string;
  brand_id: string | null;
  name: string;
  period_start: string | null;
  period_end: string | null;
  total_value?: number | null;
  longdan_fund?: number | null;
  brand_investment?: number | null;
  status: "IN DELIVERY" | "COMPLETED" | "AWAITING PROPOSAL";
  source_file: string;
  source_sheet: string;
}

export function upsertApPackage(db: Database.Database, input: ApPackageInput): void {
  db.prepare(
    `INSERT INTO ap_packages (id, brand_id, name, period_start, period_end, total_value, longdan_fund,
        brand_investment, status, source_file, source_sheet, last_updated)
     VALUES (@id, @brand_id, @name, @period_start, @period_end, @total_value, @longdan_fund,
        @brand_investment, @status, @source_file, @source_sheet, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        period_end = COALESCE(ap_packages.period_end, excluded.period_end),
        last_updated = datetime('now')`
  ).run({
    ...input,
    total_value: input.total_value ?? null,
    longdan_fund: input.longdan_fund ?? null,
    brand_investment: input.brand_investment ?? null,
  });
}

export interface ApDeliveryLineInput {
  id: string;
  package_id: string;
  deliverable_type: string;
  agreed_label?: string | null;
  agreed_quantity?: number | null;
  agreed_value?: number | null;
  delivered_quantity?: number | null;
  evidence_status: "PENDING" | "PARTIAL" | "COMPLETE";
  reported: 0 | 1;
  status: "PENDING" | "IN DELIVERY" | "DELIVERED";
  source_module?: string | null;
  link_brand_id?: string | null;
  link_subtype?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  source_file: string;
  source_sheet: string;
  source_row_ref?: string | null;
}

export function upsertApDeliveryLine(db: Database.Database, input: ApDeliveryLineInput): void {
  db.prepare(
    `INSERT INTO ap_delivery_lines (id, package_id, deliverable_type, agreed_label, agreed_quantity, agreed_value,
        delivered_quantity, evidence_status, reported, status, source_module, link_brand_id, link_subtype,
        period_start, period_end, source_file, source_sheet, source_row_ref, last_updated)
     VALUES (@id, @package_id, @deliverable_type, @agreed_label, @agreed_quantity, @agreed_value,
        @delivered_quantity, @evidence_status, @reported, @status, @source_module, @link_brand_id, @link_subtype,
        @period_start, @period_end, @source_file, @source_sheet, @source_row_ref, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
        agreed_quantity = excluded.agreed_quantity,
        delivered_quantity = excluded.delivered_quantity,
        evidence_status = excluded.evidence_status,
        status = excluded.status,
        last_updated = datetime('now')`
  ).run({
    ...input,
    agreed_label: input.agreed_label ?? null,
    agreed_quantity: input.agreed_quantity ?? null,
    agreed_value: input.agreed_value ?? null,
    delivered_quantity: input.delivered_quantity ?? null,
    source_module: input.source_module ?? null,
    link_brand_id: input.link_brand_id ?? null,
    link_subtype: input.link_subtype ?? null,
    period_start: input.period_start ?? null,
    period_end: input.period_end ?? null,
    source_row_ref: input.source_row_ref ?? null,
  });
}

export interface ControlTaskInput {
  id: string;
  deliverable_id: string;
  leader_action: LeaderAction;
  title: string;
  control_date: string | null;
  week_code: string | null;
  status: ControlStatus;
  next_action: string | null;
  issue_blocker: string | null;
  external_commitment: 0 | 1;
  external_deadline: string | null;
  external_delivery_status: string | null;
  deliverable: { subtype: string; execution_date: string | null; evidence_required: 0 | 1; evidence_status: string | null };
}

export function upsertControlTask(db: Database.Database, input: ControlTaskInput): void {
  const risk = computeRisk(
    {
      control_date: input.control_date,
      status: input.status,
      external_commitment: input.external_commitment,
      external_deadline: input.external_deadline,
      external_delivery_status: input.external_delivery_status,
    },
    input.deliverable
  );

  db.prepare(
    `INSERT INTO control_tasks (id, deliverable_id, leader_action, title, control_date, week_code, status,
        risk_level, risk_reason, next_action, issue_blocker, external_commitment, external_deadline,
        external_delivery_status, last_updated)
     VALUES (@id, @deliverable_id, @leader_action, @title, @control_date, @week_code, @status,
        @risk_level, @risk_reason, @next_action, @issue_blocker, @external_commitment, @external_deadline,
        @external_delivery_status, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        risk_level = excluded.risk_level,
        risk_reason = excluded.risk_reason,
        last_updated = datetime('now')`
  ).run({
    id: input.id,
    deliverable_id: input.deliverable_id,
    leader_action: input.leader_action,
    title: input.title,
    control_date: input.control_date,
    week_code: input.week_code,
    status: input.status,
    risk_level: risk.level,
    risk_reason: risk.reason,
    next_action: input.next_action,
    issue_blocker: input.issue_blocker,
    external_commitment: input.external_commitment,
    external_deadline: input.external_deadline,
    external_delivery_status: input.external_delivery_status,
  });
}

/** Re-derives risk_level/risk_reason for all open control tasks against "today". Call on read paths. */
export function refreshRisk(db: Database.Database): void {
  const rows = db
    .prepare(
      `SELECT ct.id, ct.control_date, ct.status, ct.external_commitment, ct.external_deadline, ct.external_delivery_status,
              d.subtype, d.execution_date, d.evidence_required, d.evidence_status
       FROM control_tasks ct JOIN deliverables d ON d.id = ct.deliverable_id
       WHERE ct.status NOT IN ('CLOSED','APPROVED','DELIVERED')`
    )
    .all() as Array<{
    id: string;
    control_date: string | null;
    status: ControlStatus;
    external_commitment: number;
    external_deadline: string | null;
    external_delivery_status: string | null;
    subtype: string;
    execution_date: string | null;
    evidence_required: number;
    evidence_status: string | null;
  }>;

  const update = db.prepare("UPDATE control_tasks SET risk_level = ?, risk_reason = ? WHERE id = ?");
  const tx = db.transaction((items: typeof rows) => {
    for (const r of items) {
      const risk = computeRisk(
        {
          control_date: r.control_date,
          status: r.status,
          external_commitment: r.external_commitment as 0 | 1,
          external_deadline: r.external_deadline,
          external_delivery_status: r.external_delivery_status,
        },
        { subtype: r.subtype, execution_date: r.execution_date, evidence_required: r.evidence_required as 0 | 1, evidence_status: r.evidence_status }
      );
      update.run(risk.level, risk.reason, r.id);
    }
  });
  tx(rows);
}

/** Re-aggregates delivered_quantity for A&P delivery lines that declare a link_brand_id/link_subtype
 *  (e.g. "Tasting" -> count Demo deliverables for that brand). Never duplicates the underlying records. */
export function refreshApDeliveryQuantities(db: Database.Database): void {
  const rows = db
    .prepare(
      `SELECT id, link_brand_id, link_subtype, agreed_quantity FROM ap_delivery_lines
       WHERE link_brand_id IS NOT NULL AND link_subtype IS NOT NULL`
    )
    .all() as Array<{ id: string; link_brand_id: string; link_subtype: string; agreed_quantity: number | null }>;

  const countStmt = db.prepare(`SELECT COUNT(*) c FROM deliverables WHERE brand_id = ? AND subtype = ?`);
  const update = db.prepare(
    `UPDATE ap_delivery_lines SET delivered_quantity = ?, evidence_status = ?, status = ?, last_updated = datetime('now') WHERE id = ?`
  );

  const tx = db.transaction((items: typeof rows) => {
    for (const r of items) {
      const executed = (countStmt.get(r.link_brand_id, r.link_subtype) as { c: number }).c;
      const agreed = r.agreed_quantity ?? 0;
      const evidence = executed >= agreed && agreed > 0 ? "COMPLETE" : executed > 0 ? "PARTIAL" : "PENDING";
      const status = executed >= agreed && agreed > 0 ? "DELIVERED" : executed > 0 ? "IN DELIVERY" : "PENDING";
      update.run(executed, evidence, status, r.id);
    }
  });
  tx(rows);
}
