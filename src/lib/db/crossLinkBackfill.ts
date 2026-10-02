import type Database from "better-sqlite3";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches existing brand names against free text — longest whole-word match
 *  wins. Never creates a brand; returns null when nothing matches. Mirrors the
 *  matching logic already proven in designBriefImport.ts. */
function matchBrandId(index: { id: string; norm: string }[], text: string): string | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;
  const exact = index.find((b) => b.norm === t);
  if (exact) return exact.id;

  let best: { id: string; len: number } | null = null;
  for (const b of index) {
    if (b.norm.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegExp(b.norm)}\\b`, "i");
    if (re.test(t) && (!best || b.norm.length > best.len)) best = { id: b.id, len: b.norm.length };
  }
  return best?.id ?? null;
}

/** Backfills brand_id on promotions (via sku_name) and digital_activities (via
 *  title) where it is currently NULL — these were never populated by the
 *  original import, which silently broke every Brand page's Promotions count
 *  and the A&P Report tab's Promotion/FOC section. Matches ONLY against
 *  brands that already exist; never invents a new brand. Idempotent — only
 *  ever fills gaps (WHERE brand_id IS NULL), never overwrites a value. */
export function backfillBrandLinks(db: Database.Database): void {
  const index = (db.prepare("SELECT id, name FROM brands").all() as { id: string; name: string }[]).map((b) => ({ id: b.id, norm: b.name.toLowerCase().trim() }));
  if (index.length === 0) return;

  const tx = db.transaction(() => {
    const promos = db.prepare("SELECT id, sku_name FROM promotions WHERE brand_id IS NULL AND sku_name IS NOT NULL").all() as { id: string; sku_name: string }[];
    const updatePromo = db.prepare("UPDATE promotions SET brand_id = ? WHERE id = ?");
    for (const p of promos) {
      const brandId = matchBrandId(index, p.sku_name);
      if (brandId) updatePromo.run(brandId, p.id);
    }

    const digital = db.prepare("SELECT id, title FROM digital_activities WHERE brand_id IS NULL AND title IS NOT NULL").all() as { id: string; title: string }[];
    const updateDigital = db.prepare("UPDATE digital_activities SET brand_id = ? WHERE id = ?");
    for (const d of digital) {
      const brandId = matchBrandId(index, d.title);
      if (brandId) updateDigital.run(brandId, d.id);
    }
  });
  tx();
}
