"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload } from "lucide-react";
import type { DesignBriefImportResult } from "@/lib/import/designBriefImport";

export function DesignBriefUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<DesignBriefImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/design-brief", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
      } else {
        setResult(data.result);
        router.refresh();
      }
    } catch {
      setError("Upload failed — check the file and try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="glass rounded-2xl px-4 py-5 flex flex-col gap-3">
      <div>
        <h2 className="text-[14px] font-semibold">Design Brief Import</h2>
        <div className="text-[12px] text-foreground-muted mt-1">
          Upload a Design Brief workbook (.xlsx) — every sheet is read, classified, and turned into a Design
          Asset Checklist automatically. No template or prior explanation required; unclear data is flagged
          NEEDS MAPPING rather than guessed.
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="self-start flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-medium bg-glass-surface-strong hover:bg-glass-surface border border-glass-border transition-colors disabled:opacity-50"
      >
        <Upload size={14} />
        {uploading ? "Processing…" : "Upload Design Brief"}
      </button>

      {error && (
        <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
          {error}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          {[
            { label: "Sheets Scanned", value: result.sheetsScanned },
            { label: "Briefs Imported", value: result.briefsImported },
            { label: "Briefs Excluded", value: result.briefsExcluded },
            { label: "Assets Created", value: result.assetsCreated },
            { label: "Needs Mapping", value: result.needsMappingAssets, accent: result.needsMappingAssets > 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl px-3 py-2 bg-glass-surface flex flex-col items-start">
              <span className="font-mono-tag text-[16px] font-bold" style={{ color: s.accent ? "var(--amber)" : undefined }}>
                {s.value}
              </span>
              <span className="text-[9.5px] uppercase tracking-wide text-foreground-muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}
      {result && (
        <Link href="/design" className="text-[12px] text-foreground-muted hover:text-foreground hover:underline self-start">
          View Design Asset Checklist →
        </Link>
      )}
    </div>
  );
}
