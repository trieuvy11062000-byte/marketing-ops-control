import * as XLSX from "xlsx";

export function loadSheetRows(filePath: string, sheetName: string): unknown[][] {
  const wb = XLSX.readFile(filePath, { sheets: [sheetName], cellDates: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][];
}

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildHeaderMap(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeader(cell);
    if (norm && !map.has(norm)) map.set(norm, idx);
  });
  return map;
}

/** Finds the first header column whose normalized text starts with any candidate. */
export function findCol(map: Map<string, number>, ...candidates: string[]): number | null {
  for (const [key, idx] of map) {
    for (const cand of candidates) {
      if (key.startsWith(cand)) return idx;
    }
  }
  return null;
}

export function cell(row: unknown[], idx: number | null): unknown {
  if (idx == null) return null;
  return row[idx] ?? null;
}
