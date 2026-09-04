import * as XLSX from "xlsx";
import type { Monthly301Section, Monthly301Summary } from "./monthly301Summary";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function thMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${THAI_MONTHS[Number(m) - 1] ?? monthKey} ${y}`;
}

/** Mirrors Monthly301SummaryView.tsx's CombinedTable column order exactly —
 * one shared shape for the on-screen view and this export, so the two
 * cannot drift the way they did before 2026-08-31's review (%Yield/%Loss
 * were still separate rows here after the on-screen view moved them to
 * columns). */
const HEADERS = [
  "Code",
  "Material",
  "Quantity",
  "Amount",
  "Semi",
  "สัดส่วน",
  "ราคา/Kg.",
  "%STD",
  "ปันใหม่ตาม STD",
  "ราคาหลังปัน",
  "Settlement Rule",
  "% Yield",
  "% Loss",
];

type Cell = string | number | null;

function num(n: number | null): Cell {
  return n === null || Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

/** proportion/yield fractions (0..1) -> whole-ish % for the sheet. */
function pct(n: number | null): Cell {
  return n === null || Number.isNaN(n) ? null : Math.round(n * 10000) / 100;
}

function pushPeriod(aoa: Cell[][], title: string, sections: Monthly301Section[], diffQuantity: number, diffAmount: number): void {
  aoa.push([title]);
  aoa.push(HEADERS);

  sections.forEach((section, sectionIndex) => {
    for (const l of section.lines) {
      aoa.push([
        l.material,
        l.materialDescription,
        num(l.quantity),
        num(l.amount),
        null,
        pct(l.proportion),
        num(l.pricePerKg),
        l.stdPercent === null ? null : Math.round(l.stdPercent),
        num(l.reallocatedCost),
        num(l.reallocatedPricePerKg),
        pct(l.settlementRule),
        null,
        null,
      ]);
    }

    aoa.push([
      `รวม ${section.varietyLabel}`,
      "",
      num(section.quantityTotal),
      num(section.amountTotal),
      num(section.semiQuantity),
      pct(section.proportionTotal),
      null,
      null,
      null,
      null,
      pct(section.settlementRuleTotal),
      pct(section.yield),
      pct(section.loss),
    ]);

    // Blank divider between varieties, same as the on-screen spacer <tr> —
    // not after the last one (that blank comes from the caller instead).
    if (sectionIndex < sections.length - 1) aoa.push([]);
  });

  aoa.push(["รวมทั้งหมด (Robusta + Arabica)", "", num(diffQuantity), num(diffAmount)]);
  aoa.push([]);
}

export function buildMonthly301Workbook(summary: Monthly301Summary, monthKey?: string): XLSX.WorkBook {
  const months = monthKey ? summary.months.filter((m) => m.monthKey === monthKey) : summary.months;

  const aoa: Cell[][] = [["สรุปรายเดือน 301"], []];
  for (const month of months) pushPeriod(aoa, thMonth(month.monthKey), month.sections, month.diffQuantity, month.diffAmount);
  // "รวมทั้งหมด" period block (whole filtered range as one period) —
  // commented out per user request (2026-08-31), matching the on-screen
  // view. `summary.total` is still computed, so this is a one-line restore.
  // if (!monthKey && summary.total) {
  //   pushPeriod(aoa, "รวมทั้งหมด", summary.total.sections, summary.total.diffQuantity, summary.total.diffAmount);
  // }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 34 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 9 },
    { wch: 10 },
    { wch: 8 },
    { wch: 15 },
    { wch: 12 },
    { wch: 14 },
    { wch: 9 },
    { wch: 9 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "สรุปรายเดือน 301");
  return workbook;
}
