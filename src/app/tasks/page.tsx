import { TaskRow, EmptyRow } from "@/components/ui/TaskRow";
import { getTasksByBucket, type Bucket } from "@/lib/queries/dashboard";
import { getDb } from "@/lib/db/client";
import type { ControlTaskView } from "@/lib/db/types";

const BUCKET_LABEL: Record<Bucket, string> = {
  needReview: "Need My Review",
  overdue: "Overdue",
  atRisk: "At Risk",
  blocked: "Blocked",
  externalDue: "External Deadlines",
  today: "Today",
  thisWeek: "This Week",
  next2Weeks: "Next 2 Weeks",
};

function bySubtype(subtype: string): ControlTaskView[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT ct.*, d.workstream as deliverable_workstream, d.subtype as deliverable_subtype,
              d.pic_role as deliverable_pic_role, d.sku_name as deliverable_sku_name,
              c.id as campaign_id, c.name as campaign_name, c.campaign_type,
              b.name as brand_name
       FROM control_tasks ct
       JOIN deliverables d ON d.id = ct.deliverable_id
       LEFT JOIN campaigns c ON c.id = d.campaign_id
       LEFT JOIN brands b ON b.id = d.brand_id
       WHERE d.subtype = ?
       ORDER BY CASE ct.risk_level WHEN 'RED' THEN 0 WHEN 'AMBER' THEN 1 ELSE 2 END
       LIMIT 200`
    )
    .all(subtype) as ControlTaskView[];
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; subtype?: string; week?: string }>;
}) {
  const params = await searchParams;
  const bucket = (params.bucket as Bucket) ?? "needReview";
  const tasks = params.subtype ? bySubtype(params.subtype) : getTasksByBucket(bucket);
  const filtered = params.week ? tasks.filter((t) => t.week_code === params.week) : tasks;
  const title = params.subtype ? params.subtype : BUCKET_LABEL[bucket] ?? "Tasks";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">{title}</h1>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">{filtered.length} items</div>
      </div>
      <section className="glass rounded-2xl overflow-hidden">
        {filtered.length === 0 ? <EmptyRow label="Nothing here — all clear" /> : filtered.map((t) => <TaskRow key={t.id} task={t} />)}
      </section>
    </div>
  );
}
