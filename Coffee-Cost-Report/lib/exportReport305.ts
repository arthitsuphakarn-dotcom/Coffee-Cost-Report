import * as XLSX from "xlsx";
import type { Order305Report } from "./types";

/** Column set + order mirrors components/Stage305Table.tsx exactly — the
 * on-screen 305 table was rebuilt 2026-08-26 with MvT / G / KG columns and
 * without the old "น้ำหนัก/หน่วย (g)" column; this export had never been
 * updated to match until now. */
const HEADERS = [
  "Order",
  "Material",
  "Material description",
  "EUn",
  "MvT",
  "Quantity",
  "Amount",
  "G",
  "KG",
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

export function buildReport305Workbook(report: Order305Report): XLSX.WorkBook {
  const aoa: Cell[][] = [HEADERS];
  const totals = { residualQuantity: 0, residualAmount: 0, outputWeightG: 0 };

  for (const group of report.groups) {
    group.lines.forEach((m) => {
      aoa.push([
        "",
        m.material,
        m.materialDescription,
        m.eun,
        m.mvt,
        num(m.quantity),
        num(m.amount),
        num(m.outputG),
        num(m.outputKg),
        num(m.pricePerKg),
        null,
        null,
      ]);
    });

    // Group sum row — mirrors Stage305Table's bold group header row, which
    // shows only %Yield/%Loss (Quantity/Amount/G/KG left blank there).
    aoa.push([
      `${group.order} Sum`,
      "",
      "",
      "",
      "",
      null,
      null,
      null,
      null,
      null,
      pct(group.yield),
      pct(group.loss),
    ]);
    aoa.push([]);

    totals.residualQuantity += group.residualQuantity;
    totals.residualAmount += group.residualAmount;
    totals.outputWeightG += group.outputWeightG ?? 0;
  }

  // Grand-total row — mirrors the table's <tfoot> "รวมทั้งหมด (N Order)".
  aoa.push([
    `รวมทั้งหมด (${report.groups.length} Order)`,
    "",
    "",
    "",
    "",
    num(totals.residualQuantity),
    num(totals.residualAmount),
    num(totals.outputWeightG),
    num(totals.outputWeightG / 1000),
    null,
    null,
    null,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "305");
  return workbook;
}
