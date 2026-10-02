import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { importDesignBriefBuffer } from "@/lib/import/designBriefImport";

/** Reusable Design Brief Import Engine entry point — any future Design Brief
 *  workbook can be dropped here with no code changes: read all sheets, classify,
 *  extract assets, link to existing Brand/Campaign/Promotion, write to the shared
 *  database. Never a separate upload-specific parsing path. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return NextResponse.json({ error: "Only .xlsx/.xls workbooks are supported" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const db = getDb();

  let result;
  try {
    result = importDesignBriefBuffer(db, buffer, file.name);
  } catch (err) {
    return NextResponse.json({ error: `Failed to parse workbook: ${(err as Error).message}` }, { status: 422 });
  }

  db.prepare(
    `INSERT INTO import_batches (id, file_name, deliverables_created, status)
     VALUES (@id, @file_name, @deliverables_created, 'COMPLETE')`
  ).run({
    id: `DESIGN-BRIEF__${file.name}__${Date.now()}`,
    file_name: file.name,
    deliverables_created: result.assetsCreated,
  });

  return NextResponse.json({ result });
}
