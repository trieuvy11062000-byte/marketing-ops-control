import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { importDemoReportFiles, type UploadedFile } from "@/lib/import/demoReportImport";

/** Reusable Weekly Demo Report Import Engine — accepts the Demo Record Excel,
 *  Post-Event Evaluation docx and/or pdf together (or any subset). Multiple
 *  files for the same week are complementary sources merged into ONE weekly
 *  report; re-uploading a file reconciles rather than duplicating. Future weeks
 *  need no code changes — the week code is detected from the files themselves. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const fileEntries = form.getAll("files");
  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const files: UploadedFile[] = [];
  for (const entry of fileEntries) {
    if (!(entry instanceof File)) continue;
    if (!/\.(xlsx|xls|docx|pdf)$/i.test(entry.name)) {
      return NextResponse.json({ error: `Unsupported file type: ${entry.name}` }, { status: 400 });
    }
    files.push({ name: entry.name, buffer: Buffer.from(await entry.arrayBuffer()) });
  }

  const db = getDb();
  let result;
  try {
    result = await importDemoReportFiles(db, files);
  } catch (err) {
    return NextResponse.json({ error: `Failed to process files: ${(err as Error).message}` }, { status: 422 });
  }

  if (!result.weekCode) {
    return NextResponse.json({ error: result.warnings[0] ?? "Could not detect a week from the uploaded files" }, { status: 422 });
  }

  db.prepare(
    `INSERT INTO import_batches (id, file_name, deliverables_created, status)
     VALUES (@id, @file_name, @deliverables_created, 'COMPLETE')`
  ).run({
    id: `DEMO-REPORT__${result.weekCode}__${Date.now()}`,
    file_name: files.map((f) => f.name).join(", "),
    deliverables_created: result.sessionsCreated,
  });

  return NextResponse.json({ result });
}
