import { getDb } from "../db/client";

const db = getDb();

console.log("--- risk distribution ---");
console.log(db.prepare("SELECT risk_level, status, COUNT(*) c FROM control_tasks GROUP BY risk_level, status ORDER BY c DESC").all());

console.log("--- sample control tasks ---");
console.log(
  db
    .prepare(
      `SELECT ct.title, ct.leader_action, ct.control_date, ct.status, ct.risk_level, ct.risk_reason
       FROM control_tasks ct ORDER BY RANDOM() LIMIT 12`
    )
    .all()
);

console.log("--- sample campaigns ---");
console.log(db.prepare("SELECT id, name, campaign_type, status FROM campaigns ORDER BY RANDOM() LIMIT 10").all());

console.log("--- demo brands ---");
console.log(db.prepare("SELECT DISTINCT b.name FROM brands b WHERE b.source_tag LIKE '%Demo%' LIMIT 20").all());

console.log("--- A&P suppliers sample ---");
console.log(db.prepare("SELECT DISTINCT b.name FROM brands b WHERE b.source_tag = 'A&P26' LIMIT 10").all());

console.log("--- deliverable workstream counts ---");
console.log(db.prepare("SELECT workstream, subtype, COUNT(*) c FROM deliverables GROUP BY workstream, subtype ORDER BY c DESC").all());
