import { getDb } from "../db/client";

export interface SearchGroup {
  label: string;
  items: { title: string; subtitle?: string; href: string }[];
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function monthIndex(name: string): number {
  const i = MONTHS.findIndex((m) => m.startsWith(name.toLowerCase()) && name.length >= 3);
  return i; // -1 if not found
}

const STATUS_KEYWORDS: Record<string, string> = {
  overdue: "/tasks?bucket=overdue",
  "at risk": "/tasks?bucket=atRisk",
  risk: "/tasks?bucket=atRisk",
  blocked: "/tasks?bucket=blocked",
  "waiting review": "/tasks?bucket=needReview",
  review: "/tasks?bucket=needReview",
  external: "/tasks?bucket=externalDue",
};

export function search(query: string): SearchGroup[] {
  const db = getDb();
  const q = query.trim();
  if (!q) return [];
  const groups: SearchGroup[] = [];
  const lower = q.toLowerCase();

  // Week code: "W41" or "41"
  const weekMatch = lower.match(/^w?(\d{1,2})$/);
  if (weekMatch) {
    const code = `W${weekMatch[1].padStart(2, "0")}`;
    const exists = db.prepare("SELECT week_code FROM weeks WHERE week_code = ?").get(code);
    if (exists) {
      groups.push({
        label: "Week",
        items: [
          { title: `${code} Overview`, href: `/week/${code}` },
          { title: `${code} — Need My Review`, href: `/tasks?bucket=needReview&week=${code}` },
          { title: `${code} — At Risk`, href: `/tasks?bucket=atRisk&week=${code}` },
        ],
      });
    }
  }

  // Date: "9 Oct", "09 October", "Oct 9"
  const dayMonth = lower.match(/^(\d{1,2})\s+([a-z]{3,})$/) ?? lower.match(/^([a-z]{3,})\s+(\d{1,2})$/);
  if (dayMonth) {
    const [, a, b] = dayMonth;
    const day = /^\d+$/.test(a) ? a : b;
    const monthStr = /^\d+$/.test(a) ? b : a;
    const mi = monthIndex(monthStr);
    if (mi >= 0) {
      const year = new Date().getFullYear();
      const dayNum = parseInt(day, 10);
      groups.push({
        label: "Date",
        items: [
          {
            title: `${dayNum} ${MONTHS[mi][0].toUpperCase()}${MONTHS[mi].slice(1)} ${year}`,
            href: `/?year=${year}&month=${mi + 1}&day=${dayNum}`,
          },
        ],
      });
    }
  } else {
    // Month name alone: "October"
    const mi = monthIndex(lower);
    if (mi >= 0 && lower.length >= 3) {
      const year = new Date().getFullYear();
      groups.push({
        label: "Month",
        items: [{ title: `${MONTHS[mi][0].toUpperCase()}${MONTHS[mi].slice(1)} ${year}`, href: `/?year=${year}&month=${mi + 1}` }],
      });
    }
  }

  // Status keywords
  for (const [kw, href] of Object.entries(STATUS_KEYWORDS)) {
    if (lower.includes(kw)) {
      groups.push({ label: "Status", items: [{ title: `Show: ${kw}`, href }] });
      break;
    }
  }

  // Brands
  const brandRows = db
    .prepare("SELECT id, name FROM brands WHERE name LIKE ? ORDER BY name LIMIT 6")
    .all(`%${q}%`) as { id: string; name: string }[];
  if (brandRows.length) {
    groups.push({
      label: "Brands",
      items: brandRows.map((b) => ({ title: b.name, href: `/brands/${encodeURIComponent(b.id)}` })),
    });
  }

  // Campaigns
  const campaignRows = db
    .prepare("SELECT id, name FROM campaigns WHERE name LIKE ? OR id LIKE ? ORDER BY name LIMIT 6")
    .all(`%${q}%`, `%${q}%`) as { id: string; name: string }[];
  if (campaignRows.length) {
    groups.push({
      label: "Campaigns",
      items: campaignRows.map((c) => ({ title: c.name, subtitle: c.id, href: `/campaigns/${encodeURIComponent(c.id)}` })),
    });
  }

  // Promotions by SKU code/name
  const promoRows = db
    .prepare("SELECT id, sku_name, sku_code, channel FROM promotions WHERE sku_name LIKE ? OR sku_code LIKE ? LIMIT 6")
    .all(`%${q}%`, `%${q}%`) as { id: string; sku_name: string | null; sku_code: string | null; channel: string }[];
  if (promoRows.length) {
    groups.push({
      label: "Promotions",
      items: promoRows.map((p) => ({
        title: `${p.sku_name ?? p.sku_code} — ${p.channel}`,
        href: `/promotions/${encodeURIComponent(p.id)}`,
      })),
    });
  }

  // A&P packages
  const apRows = db.prepare("SELECT id, name FROM ap_packages WHERE name LIKE ? LIMIT 6").all(`%${q}%`) as { id: string; name: string }[];
  if (apRows.length) {
    groups.push({
      label: "A&P Packages",
      items: apRows.map((a) => ({ title: a.name, href: `/ap/${encodeURIComponent(a.id)}` })),
    });
  }

  // Deliverable subtype keywords (Demo, POSM, TVC...)
  const subtypeRows = db
    .prepare("SELECT DISTINCT subtype FROM deliverables WHERE subtype LIKE ? LIMIT 4")
    .all(`%${q}%`) as { subtype: string }[];
  if (subtypeRows.length) {
    groups.push({
      label: "Deliverable type",
      items: subtypeRows.map((s) => ({ title: s.subtype, href: `/tasks?subtype=${encodeURIComponent(s.subtype)}` })),
    });
  }

  return groups;
}
