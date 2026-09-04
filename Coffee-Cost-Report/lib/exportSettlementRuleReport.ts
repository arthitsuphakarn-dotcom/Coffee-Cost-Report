import * as XLSX from "xlsx";
import type { SettlementRuleReport } from "./settlementRuleReport";

const THAI_MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-07" -> "ก.ค." (or "ก.ค. 26" when the report spans more than one year). */
function monthHeader(monthKey: string, multiYear: boolean): string {
  const [year, month] = monthKey.split("-");
  const abbr = THAI_MONTH_ABBR[Number(month) - 1] ?? monthKey;
  return multiYear ? `${abbr} ${year.slice(2)}` : abbr;
}

/** 2dp, blank for null — keeps the sheet clean rather than writing "-". */
function cell(n: number | null): number | null {
  return n === null || Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

/** Whole %, blank for null — matches the on-screen popup and the source report. */
function pctCell(n: number | null): number | null {
  return n === null || Number.isNaN(n) ? null : Math.round(n);
}

export function buildSettlementRuleWorkbook(report: SettlementRuleReport): XLSX.WorkBook {
  const multiYear = report.years.length > 1;
  const monthHeaders = report.months.map((mk) => monthHeader(mk, multiYear));
  const aoa: (string | number | null)[][] = [];

  aoa.push(["Settlement Rule Report"]);
  aoa.push([]);

  for (const section of report.sections) {
    aoa.push(["Code", section.varietyLabel, "%STD (ล่าสุด)", ...monthHeaders, "Average"]);
    aoa.push([section.greenCode, section.greenDescription, null, ...report.months.map(() => null), null]);

    for (const m of section.materials) {
      aoa.push([
        m.material,
        m.materialDescription,
        cell(m.stdPercent),
        ...report.months.map((mk) => pctCell(m.monthly[mk] ?? null)),
        pctCell(m.average),
      ]);
    }

    aoa.push([
      "% Yield",
      "",
      null,
      ...report.months.map((mk) => pctCell(section.yieldByMonth[mk] ?? null)),
      pctCell(section.yieldAverage),
    ]);
    aoa.push([
      "% Loss",
      "",
      null,
      ...report.months.map((mk) => pctCell(section.lossByMonth[mk] ?? null)),
      pctCell(section.lossAverage),
    ]);
    aoa.push([]);
  }

  aoa.push(["%STD (ล่าสุด)", "Sheet > 301 > Summary สูตร > %STD ช่อง J — ค่าล่าสุดที่มีการเปลี่ยนแปลง"]);
  aoa.push(["สัดส่วนเกิดจริง", "Sheet > 301 > Summary สูตร > Settlement Rule ช่อง M — ตัวเลขจริง ไม่ปรับให้รวม = 100"]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [{ wch: 12 }, { wch: 34 }, { wch: 10 }, ...report.months.map(() => ({ wch: 7 })), { wch: 9 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Settlement Rule");
  return workbook;
}
