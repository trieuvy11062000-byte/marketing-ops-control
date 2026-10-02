import { getDb } from "../src/lib/db/client";

const db = getDb();
console.log("brands:", db.prepare("SELECT COUNT(*) c FROM brands").get());
console.log("campaigns:", db.prepare("SELECT COUNT(*) c FROM campaigns").get());
console.log("deliverables:", db.prepare("SELECT COUNT(*) c FROM deliverables").get());
console.log("control_tasks:", db.prepare("SELECT COUNT(*) c FROM control_tasks").get());
console.log("\nBrands:");
console.log(db.prepare("SELECT id, name FROM brands ORDER BY name").all());
console.log("\nWorkstreams:");
console.log(db.prepare("SELECT workstream, COUNT(*) c FROM deliverables GROUP BY workstream").all());
console.log("\nStatuses (control_tasks):");
console.log(db.prepare("SELECT status, COUNT(*) c FROM control_tasks GROUP BY status").all());
console.log("\nRisk levels:");
console.log(db.prepare("SELECT risk_level, COUNT(*) c FROM control_tasks GROUP BY risk_level").all());
console.log("\nWeek code range on control_tasks:");
console.log(db.prepare("SELECT MIN(week_code) mn, MAX(week_code) mx FROM control_tasks WHERE week_code IS NOT NULL").get());
console.log("\nSample control tasks joined:");
console.log(db.prepare(`
  SELECT ct.title, ct.status, ct.risk_level, ct.control_date, ct.week_code, d.workstream, d.subtype, b.name as brand, c.name as campaign
  FROM control_tasks ct
  JOIN deliverables d ON d.id = ct.deliverable_id
  JOIN campaigns c ON c.id = d.campaign_id
  LEFT JOIN brands b ON b.id = d.brand_id
  LIMIT 15
`).all());
console.log("\nCampaign types:");
console.log(db.prepare("SELECT campaign_type, COUNT(*) c FROM campaigns GROUP BY campaign_type").all());
console.log("\nLeader actions:");
console.log(db.prepare("SELECT leader_action, COUNT(*) c FROM control_tasks GROUP BY leader_action").all());
