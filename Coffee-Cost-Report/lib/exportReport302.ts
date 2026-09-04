import * as XLSX from "xlsx";
import type { Order302Report } from "./types";

/** Column set + order mirrors components/Stage302Table.tsx exactly. */
const HEADERS = [
  "Order",
  "Material",
  "Material description",
  "EUn",
  "Quantity",
  "Amount",
  "ใส่สาร",
  "สัดส่วนผสม",
  "สัดส่วน",
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

export function buildReport302Workbook(report: Order302Report): XLSX.WorkBook {
  const aoa: Cell[][] = [HEADERS];
  const totals = { residualQuantity: 0, residualAmount: 0, totalInputQuantity: 0 };

  for (const group of report.groups) {
    group.lines.forEach((m) => {
      aoa.push([
        "",
        m.material,
        m.materialDescription,
        m.eun,
        num(m.quantity),
        num(m.amount),
        null,
        pct(m.mixRatio),
        pct(m.outputRatio),
        num(m.pricePerKg),
        null,
        null,
      ]);
    });

    // Group sum row — mirrors Stage302Table's bold group header row:
    // ใส่สาร (total input qty), สัดส่วน (totalMixRatio), ราคาต่อหน่วย
    // (totalPricePerKg) and %Yield/%Loss land here; สัดส่วนผสม stays blank.
    aoa.push([
      `${group.order} Sum`,
      "",
      "",
      "",
      num(group.residualQuantity),
      num(group.residualAmount),
      num(group.totalInputQuantity),
      null,
      pct(group.totalMixRatio),
      num(group.totalPricePerKg),
      pct(group.yield),
      pct(group.loss),
    ]);
    aoa.push([]);

    totals.residualQuantity += group.residualQuantity;
    totals.residualAmount += group.residualAmount;
    totals.totalInputQuantity += group.totalInputQuantity;
  }

  // Grand-total row — mirrors the table's <tfoot> "รวมทั้งหมด (N Order)".
  aoa.push([
    `รวมทั้งหมด (${report.groups.length} Order)`,
    "",
    "",
    "",
    num(totals.residualQuantity),
    num(totals.residualAmount),
    num(totals.totalInputQuantity),
    null,
    null,
    null,
    null,
    null,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "302");
  return workbook;
}
