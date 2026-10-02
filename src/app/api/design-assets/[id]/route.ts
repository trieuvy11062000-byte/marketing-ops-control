import { NextRequest, NextResponse } from "next/server";
import { AUDIT_FIELDS, updateDesignAssetAudit, updateDesignAssetEvidenceLink, type AuditField } from "@/lib/queries/designBriefs";
import type { LeaderAuditState } from "@/lib/db/types";

const VALID_STATES: LeaderAuditState[] = ["TO CHECK", "DONE", "ISSUE"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const assetId = decodeURIComponent(id);

  if (body.evidenceLink !== undefined) {
    updateDesignAssetEvidenceLink(assetId, body.evidenceLink || null);
  }

  if (body.field && body.value) {
    if (!AUDIT_FIELDS.includes(body.field as AuditField)) {
      return NextResponse.json({ error: `Unknown audit field: ${body.field}` }, { status: 400 });
    }
    if (!VALID_STATES.includes(body.value)) {
      return NextResponse.json({ error: `Invalid state: ${body.value}` }, { status: 400 });
    }
    updateDesignAssetAudit(assetId, body.field as AuditField, body.value as LeaderAuditState);
  }

  return NextResponse.json({ ok: true });
}
