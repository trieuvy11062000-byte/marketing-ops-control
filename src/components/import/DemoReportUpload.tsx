"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload } from "lucide-react";
import type { DemoReportImportResult } from "@/lib/import/demoReportImport";

export function DemoReportUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<DemoReportImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList) {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      for (const file of Array.from(fileList)) form.append("files", file);
      const res = await fetch("/api/import/demo-report", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
      } else {
        setResult(data.result);
        router.refresh();
      }
    } catch {
      setError("Upload failed — check the files and try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="glass rounded-2xl px-4 py-5 flex flex-col gap-3">
      <div>
        <h2 className="text-[14px] font-semibold">Weekly Demo Report Import</h2>
        <div className="text-[12px] text-foreground-muted mt-1">
          Upload the Demo Record Excel, Post-Event Evaluation (.docx) and/or the evaluation deck (.pdf) together for
          one week — select multiple files at once. The week is detected automatically; multiple files merge into
          one Weekly Demo Report, and re-uploading a file reconciles it rather than creating a duplicate.
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.docx,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="self-start flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-medium bg-glass-surface-strong hover:bg-glass-surface border border-glass-border transition-colors disabled:opacity-50"
      >
        <Upload size={14} />
        {uploading ? "Processing…" : "Upload Demo Report Files"}
      </button>

      {error && (
        <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {[
              { label: "Week", value: result.weekCode ?? "—" },
              { label: "Sessions", value: result.sessionsCreated },
              { label: "Performance Rows", value: result.performanceRowsWritten },
              { label: "Brands", value: result.brandsLinked },
              { label: "Actions", value: result.actionsWritten },
            ].map((s) => (
              <div key={s.label} className="rounded-xl px-3 py-2 bg-glass-surface flex flex-col items-start">
                <span className="font-mono-tag text-[16px] font-bold">{s.value}</span>
                <span className="text-[9.5px] uppercase tracking-wide text-foreground-muted">{s.label}</span>
              </div>
            ))}
          </div>
          {result.warnings.length > 0 && (
            <div className="rounded-lg px-3 py-2 text-[11.5px] flex flex-col gap-1" style={{ background: "var(--amber-bg)", color: "var(--amber)" }}>
              {result.warnings.map((w, i) => <span key={i}>{w}</span>)}
            </div>
          )}
          {result.weekCode && (
            <Link href={`/in-store/demo-report/${result.weekCode}`} className="text-[12px] text-foreground-muted hover:text-foreground hover:underline self-start">
              View {result.weekCode} Weekly Demo Report →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
