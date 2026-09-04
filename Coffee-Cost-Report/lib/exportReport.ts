import * as XLSX from "xlsx";
import type { OrderStageReport } from "./types";

/** Column set + order mirrors components/Stage301Table.tsx exactly, so the
 * Excel export and the on-screen table can't drift. */
const HEADERS = [
  "Order",
  "Material",
  "Material description",
  "EUn",
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

/** Plain number, 2dp; blank for null/NaN. */
function num(n: number | null | undefined): Cell {
  return n == null || Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

/** Fraction (0..1) -> percentage number (2dp) — matches the on-screen
 * formatPercent (×100). Blank for null/NaN. */
function pct(n: number | null | undefined): Cell {
  return n == null || Number.isNaN(n) ? null : Math.round(n * 10000) / 100;
}

export function buildReportWorkbook(report: OrderStageReport): XLSX.WorkBook {
  const aoa: Cell[][] = [HEADERS];
  const totals = { residualQuantity: 0, residualAmount: 0, semiQuantity: 0 };

  for (const group of report.groups) {
    group.materials.forEach((m) => {
      aoa.push([
        "",
        m.material,
        m.materialDescription,
        m.eun,
        num(m.quantity),
        num(m.amount),
        null,
        pct(m.proportion),
        num(m.pricePerKg),
        // %STD is only shown on output rows in the table.
        m.role === "output" ? num(m.stdPercent) : null,
        num(m.reallocatedCost),
        num(m.reallocatedPricePerKg),
        pct(m.settlementRule),
        null,
        null,
      ]);
    });

    // Group sum row — mirrors Stage301Table's bold group header row:
    // Semi / %STD total / ปันใหม่ตาม STD total land here; สัดส่วน, ราคา/Kg.
    // and ราคาหลังปัน stay blank on the sum row.
    aoa.push([
      `${group.order} Sum`,
      "",
      "",
      "",
      num(group.residualQuantity),
      num(group.residualAmount),
      num(group.semiQuantity),
      null,
      null,
      num(group.totalStdPercent),
      num(group.totalReallocatedCost),
      null,
      pct(group.totalSettlement),
      pct(group.totalYield),
      pct(group.totalLoss),
    ]);
    aoa.push([]);

    totals.residualQuantity += group.residualQuantity;
    totals.residualAmount += group.residualAmount;
    totals.semiQuantity += group.semiQuantity;
  }

  // Grand-total row — mirrors the table's <tfoot> "รวมทั้งหมด (N Order)".
  aoa.push([
    `รวมทั้งหมด (${report.groups.length} Order)`,
    "",
    "",
    "",
    num(totals.residualQuantity),
    num(totals.residualAmount),
    num(totals.semiQuantity),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, report.stage);
  return workbook;
}
