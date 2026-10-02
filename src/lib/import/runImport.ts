import { getDb } from "../db/client";
import { recomputeCampaignDateRanges, refreshApDeliveryQuantities, refreshRisk } from "../db/repo";
import { SOURCE_FILES } from "./sources";
import { importPromotionMaster } from "./promotionMaster";
import { importPromotionOnline } from "./promotionOnline";
import { importDemoPlan } from "./demoPlan";
import { importApDemoDelivery } from "./apDemoDelivery";
import { importApPlan } from "./apPlan";
import { importDigitalContent } from "./digitalContent";
import { importEnewContainer } from "./enewContainer";
import { importContainerWs } from "./containerWs";
import { importDigitalVideo } from "./digitalVideo";

export function runFullImport() {
  const db = getDb();
  const results: Record<string, unknown> = {};

  console.log("Importing Promotion Master File (in-store)...");
  results.promotionMaster = importPromotionMaster(db, SOURCE_FILES.promotionMaster);

  console.log("Importing Online promotions (W39-ONLINE, W40-ONLINE)...");
  results.promotionOnlineW39 = importPromotionOnline(db, SOURCE_FILES.monthlyPromotionSep, "W39-ONLINE");
  results.promotionOnlineW40 = importPromotionOnline(db, SOURCE_FILES.monthlyPromotionOct, "W40-ONLINE");

  console.log("Importing Demo Plan...");
  results.demoPlan = importDemoPlan(db, SOURCE_FILES.demoPlanOct);

  console.log("Importing A&P26 packages...");
  results.apPlan = importApPlan(db, SOURCE_FILES.marketingCalendar);

  console.log("Importing Demo commitments into A&P delivery...");
  results.apDemoDelivery = importApDemoDelivery(db, SOURCE_FILES.demoPlanOct);

  console.log("Importing RT Digital26 (Social + Retail Email)...");
  results.digitalContent = importDigitalContent(db, SOURCE_FILES.marketingCalendar, "RT Digital26");

  console.log("Importing Enew26 (Email + Container signals)...");
  results.enewContainer = importEnewContainer(db, SOURCE_FILES.marketingCalendar, "Enew26");

  console.log("Importing Container+WS26 (Wholesale supply + digital dependency)...");
  results.containerWs = importContainerWs(db, SOURCE_FILES.marketingCalendar);

  console.log("Importing DGTCalendar (Branded Video)...");
  results.digitalVideo = importDigitalVideo(db, SOURCE_FILES.marketingCalendar);

  console.log("Recomputing campaign date ranges...");
  recomputeCampaignDateRanges(db);

  console.log("Refreshing A&P delivery quantities...");
  refreshApDeliveryQuantities(db);

  console.log("Refreshing risk levels...");
  refreshRisk(db);

  const counts = {
    brands: (db.prepare("SELECT COUNT(*) c FROM brands").get() as { c: number }).c,
    campaigns: (db.prepare("SELECT COUNT(*) c FROM campaigns").get() as { c: number }).c,
    promotions: (db.prepare("SELECT COUNT(*) c FROM promotions").get() as { c: number }).c,
    deliverables: (db.prepare("SELECT COUNT(*) c FROM deliverables").get() as { c: number }).c,
    control_tasks: (db.prepare("SELECT COUNT(*) c FROM control_tasks").get() as { c: number }).c,
    ap_packages: (db.prepare("SELECT COUNT(*) c FROM ap_packages").get() as { c: number }).c,
    ap_delivery_lines: (db.prepare("SELECT COUNT(*) c FROM ap_delivery_lines").get() as { c: number }).c,
    digital_activities: (db.prepare("SELECT COUNT(*) c FROM digital_activities").get() as { c: number }).c,
    supply_signals: (db.prepare("SELECT COUNT(*) c FROM supply_signals").get() as { c: number }).c,
  };

  return { results, counts };
}

if (require.main === module) {
  const out = runFullImport();
  console.log(JSON.stringify(out, null, 2));
}
