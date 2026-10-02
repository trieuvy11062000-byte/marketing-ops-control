import { getDb } from "../db/client";
import { weekCodeForDate } from "../db/weeks";
import type { QuickTaskPriority, QuickTaskStatus, QuickTaskView } from "../db/types";

const VIEW_SQL = `
  SELECT q.*, b.name as brand_name, c.name as activation_name
  FROM quick_tasks q
  LEFT JOIN brands b ON b.id = q.brand_id
  LEFT JOIN campaigns c ON c.id = q.activation_id
`;

function genId(): string {
  return `QT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function listQuickTasks(status?: QuickTaskStatus): QuickTaskView[] {
  const db = getDb();
  if (status) {
    return db.prepare(`${VIEW_SQL} WHERE q.status = ? ORDER BY q.due_date IS NULL, q.due_date, q.created_date DESC`).all(status) as QuickTaskView[];
  }
  return db.prepare(`${VIEW_SQL} ORDER BY q.due_date IS NULL, q.due_date, q.created_date DESC`).all() as QuickTaskView[];
}

/** Active items for the Dashboard widget — OPEN/WAITING only, most urgent first. */
export function listActiveQuickTasks(limit = 7): QuickTaskView[] {
  const db = getDb();
  return db
    .prepare(`${VIEW_SQL} WHERE q.status IN ('OPEN','WAITING') ORDER BY q.due_date IS NULL, q.due_date, q.created_date DESC LIMIT ?`)
    .all(limit) as QuickTaskView[];
}

export function getQuickTask(id: string): QuickTaskView | undefined {
  const db = getDb();
  return db.prepare(`${VIEW_SQL} WHERE q.id = ?`).get(id) as QuickTaskView | undefined;
}

export interface CreateQuickTaskInput {
  task: string;
  due_date?: string | null;
  priority?: QuickTaskPriority | null;
  pic?: string | null;
  related_person?: string | null;
  brand_id?: string | null;
  activation_id?: string | null;
  related_record?: string | null;
  note?: string | null;
  source?: "MANUAL" | "QUICK_NOTE";
}

export function createQuickTask(input: CreateQuickTaskInput): string {
  const db = getDb();
  const id = genId();
  const weekCode = input.due_date ? weekCodeForDate(input.due_date) : null;
  db.prepare(
    `INSERT INTO quick_tasks (id, task, due_date, priority, pic, related_person, brand_id, activation_id,
        related_record, note, source, week_code, status, last_updated)
     VALUES (@id, @task, @due_date, @priority, @pic, @related_person, @brand_id, @activation_id,
        @related_record, @note, @source, @week_code, 'OPEN', datetime('now'))`
  ).run({
    id,
    task: input.task.trim(),
    due_date: input.due_date ?? null,
    priority: input.priority ?? null,
    pic: input.pic ?? null,
    related_person: input.related_person ?? null,
    brand_id: input.brand_id ?? null,
    activation_id: input.activation_id ?? null,
    related_record: input.related_record ?? null,
    note: input.note ?? null,
    source: input.source ?? "MANUAL",
    week_code: weekCode,
  });
  return id;
}

export interface UpdateQuickTaskInput {
  task?: string;
  due_date?: string | null;
  status?: QuickTaskStatus;
  priority?: QuickTaskPriority | null;
  pic?: string | null;
  related_person?: string | null;
  brand_id?: string | null;
  activation_id?: string | null;
  related_record?: string | null;
  note?: string | null;
  converted_note?: string | null;
}

export function updateQuickTask(id: string, input: UpdateQuickTaskInput): void {
  const db = getDb();
  const existing = db.prepare("SELECT due_date FROM quick_tasks WHERE id = ?").get(id) as { due_date: string | null } | undefined;
  if (!existing) return;

  const nextDueDate = input.due_date !== undefined ? input.due_date : existing.due_date;
  const weekCode = nextDueDate ? weekCodeForDate(nextDueDate) : null;

  const fields: string[] = ["last_updated = datetime('now')", "week_code = @week_code"];
  const params: Record<string, unknown> = { id, week_code: weekCode };

  for (const key of [
    "task",
    "due_date",
    "status",
    "priority",
    "pic",
    "related_person",
    "brand_id",
    "activation_id",
    "related_record",
    "note",
    "converted_note",
  ] as const) {
    if (input[key] !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = input[key];
    }
  }

  db.prepare(`UPDATE quick_tasks SET ${fields.join(", ")} WHERE id = @id`).run(params);
}

export function deleteQuickTask(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM quick_tasks WHERE id = ?").run(id);
}

export function getQuickTaskCounts() {
  const db = getDb();
  const rows = db.prepare("SELECT status, COUNT(*) c FROM quick_tasks GROUP BY status").all() as { status: string; c: number }[];
  const inbox = (
    db
      .prepare("SELECT COUNT(*) c FROM quick_tasks WHERE status IN ('OPEN','WAITING') AND brand_id IS NULL AND activation_id IS NULL AND due_date IS NULL")
      .get() as { c: number }
  ).c;
  const find = (s: string) => rows.find((r) => r.status === s)?.c ?? 0;
  return { open: find("OPEN"), waiting: find("WAITING"), done: find("DONE"), converted: find("CONVERTED"), inbox };
}
