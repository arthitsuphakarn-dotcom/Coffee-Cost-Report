import * as XLSX from "xlsx";
import type { Order303Report } from "./types";

/** Column set + order mirrors components/Stage303Table.tsx exactly — the
 * "น้ำหนัก/หน่วย (g)" column was removed from the on-screen table, so it's
 * dropped here too. */
const HEADERS = [
  "Order",
  "Material",
  "Material description",
  "EUn",
  "Quantity",
  "Amount",
  "ราคาต่อหน่วย",
  "% Yield",
  "% Loss",
];

type Cell = string | number | null;

function num(n: number | null | undefined): Cell {
  return n == null || Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

function pct(n: number | null | undefined): Cell {
  return n == null || Number.isNaN(n) ? null : Math.round(n * 10000) / 100;
}

export function buildReport303Workbook(report: Order303Report): XLSX.WorkBook {
  const aoa: Cell[][] = [HEADERS];
  const totals = { residualQuantity: 0, residualAmount: 0 };

  for (const group of report.groups) {
    group.lines.forEach((m) => {
      aoa.push([
        "",
        m.material,
        m.materialDescription,
        m.eun,
        num(m.quantity),
        num(m.amount),
        num(m.pricePerKg),
        null,
        null,
      ]);
    });

    // Group sum row — mirrors Stage303Table's bold group header row.
    aoa.push([
      `${group.order} Sum`,
      "",
      "",
      "",
      num(group.residualQuantity),
      num(group.residualAmount),
      null,
      pct(group.yield),
      pct(group.loss),
    ]);
    aoa.push([]);

    totals.residualQuantity += group.residualQuantity;
    totals.residualAmount += group.residualAmount;
  }

  // Grand-total row — mirrors the table's <tfoot> "รวมทั้งหมด (N Order)".
  aoa.push([
    `รวมทั้งหมด (${report.groups.length} Order)`,
    "",
    "",
    "",
    num(totals.residualQuantity),
    num(totals.residualAmount),
    null,
    null,
    null,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "303");
  return workbook;
}
