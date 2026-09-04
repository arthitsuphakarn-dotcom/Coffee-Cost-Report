import * as XLSX from "xlsx";
import type { RawMovementRow } from "./types";

const REQUIRED_COLUMNS = [
  "Material",
  "Material description",
  "Order",
  "EUn",
  "Quantity in UnE",
  "Amt.in Loc.Cur.",
  "Pstng Date",
  "SLoc",
  "MvT",
] as const;

export class Mb51ParseError extends Error {}

export function parseMb51Workbook(buffer: ArrayBuffer): RawMovementRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  // Different monthly MB51 exports have used different sheet names for the
  // same raw-data shape ("MB51 328", "MB51 M. 1-7", ...) and aren't always
  // the first sheet in the file — match any sheet starting with "MB51"
  // rather than one hardcoded name.
  const sheetName = workbook.SheetNames.find((n) => n.trim().toUpperCase().startsWith("MB51")) ?? workbook.SheetNames[0];
  if (!sheetName) {
    throw new Mb51ParseError("ไฟล์นี้ไม่มี sheet ให้อ่าน");
  }
  const sheet = workbook.Sheets[sheetName];

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  if (grid.length < 2) {
    throw new Mb51ParseError(`Sheet "${sheetName}" ไม่มีข้อมูล`);
  }

  const headerRow = grid[0].map((h) => (typeof h === "string" ? h.trim() : h));
  const colIndex: Record<string, number> = {};
  for (const col of REQUIRED_COLUMNS) {
    const idx = headerRow.indexOf(col);
    if (idx === -1) {
      throw new Mb51ParseError(`ไม่พบคอลัมน์ "${col}" ใน sheet "${sheetName}" — ตรวจสอบว่าไฟล์ตรงกับรูปแบบ MB51 export`);
    }
    colIndex[col] = idx;
  }
  // Optional (not required to parse — only used by the dashboard's
  // by-supplier chart, so a file without it should still upload fine).
  const batchColIndex = headerRow.indexOf("Batch");

  const rows: RawMovementRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((v) => v === null || v === "")) continue;

    const order = normalizeString(row[colIndex["Order"]]);
    if (!order) continue; // rows with no production order are out of scope for all order-type reports

    const material = normalizeString(row[colIndex["Material"]]);
    const quantity = toNumber(row[colIndex["Quantity in UnE"]]);
    const amount = toNumber(row[colIndex["Amt.in Loc.Cur."]]);
    const postingDate = toIsoDate(row[colIndex["Pstng Date"]]);
    if (!material || quantity === null || amount === null || !postingDate) continue;

    rows.push({
      material,
      materialDescription: normalizeString(row[colIndex["Material description"]]) ?? "",
      order,
      eun: normalizeString(row[colIndex["EUn"]]) ?? "",
      quantity,
      amount,
      postingDate,
      sLoc: normalizeString(row[colIndex["SLoc"]]) ?? "",
      mvt: normalizeString(row[colIndex["MvT"]]) ?? "",
      batch: (batchColIndex !== -1 ? normalizeString(row[batchColIndex]) : null) ?? "",
    });
  }

  if (rows.length === 0) {
    throw new Mb51ParseError(`ไม่พบแถวข้อมูลที่มีเลข Order ใน sheet "${sheetName}"`);
  }

  return rows;
}

function normalizeString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function toIsoDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    // Excel serial date fallback, in case a cell wasn't auto-converted to a Date.
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  if (typeof v === "string" && v.trim() !== "") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  return null;
}
