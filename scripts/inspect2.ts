import { getDb } from "../src/lib/db/client";

const db = getDb();
console.log("control_tasks by workstream:");
console.log(
  db
    .prepare(
      `SELECT d.workstream, COUNT(*) c FROM control_tasks ct JOIN deliverables d ON d.id=ct.deliverable_id GROUP BY d.workstream`
    )
    .all()
);
console.log("brands with control tasks:");
console.log(
  db
    .prepare(
      `SELECT COUNT(DISTINCT d.brand_id) c FROM control_tasks ct JOIN deliverables d ON d.id=ct.deliverable_id WHERE d.brand_id IS NOT NULL`
    )
    .get()
);
console.log("control tasks with null brand:");
console.log(
  db
    .prepare(
      `SELECT COUNT(*) c FROM control_tasks ct JOIN deliverables d ON d.id=ct.deliverable_id WHERE d.brand_id IS NULL`
    )
    .get()
);
console.log("top brands by control task count:");
console.log(
  db
    .prepare(
      `SELECT b.name, COUNT(*) c FROM control_tasks ct JOIN deliverables d ON d.id=ct.deliverable_id JOIN brands b ON b.id=d.brand_id GROUP BY b.name ORDER BY c DESC LIMIT 15`
    )
    .all()
);
console.log("subtypes:");
console.log(
  db.prepare(`SELECT workstream, subtype, COUNT(*) c FROM deliverables GROUP BY workstream, subtype ORDER BY c DESC LIMIT 20`).all()
);
console.log("pic roles on control tasks:");
console.log(
  db
    .prepare(
      `SELECT d.pic_role, COUNT(*) c FROM control_tasks ct JOIN deliverables d ON d.id=ct.deliverable_id GROUP BY d.pic_role`
    )
    .all()
);
