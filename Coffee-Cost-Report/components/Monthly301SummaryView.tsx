"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight, faFileExcel } from "@fortawesome/free-solid-svg-icons";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Monthly301Line, Monthly301Section, Monthly301Summary } from "@/lib/monthly301Summary";
import { td, tdNum, th, tfootCell, tfootNum } from "./reportTableStyles";

// const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const ENG_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function thMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${ENG_MONTHS[Number(m) - 1] ?? monthKey} ${y}`;
}

function rangeLabel(from: string, to: string): string {
  if (!from || !to) return "";
  return from === to ? thMonth(from) : `${thMonth(from)} – ${thMonth(to)}`;
}

/** One column-group in the pivoted table: a calendar month, or the whole
 * filtered range treated as one period ("รวมทั้งหมด", ก้อน A's original
 * whole-sheet-as-one-period reading, applied to the current filter). */
interface Period {
  key: string;
  label: string;
  isTotal: boolean;
  sections: Monthly301Section[];
  /** Σ input+output across BOTH varieties (source A88:O99's row 100 =
   * E93+E99) — shown as the table's own bottom row, not a separate strip. */
  diffQuantity: number;
  diffAmount: number;
}

/** The 11 A88:O99 sub-columns repeated under every period — matching the
 * reference: %Yield/%Loss are their own trailing COLUMNS (source N/O),
 * not separate rows underneath. `render` reads from a material's line;
 * blank when the period has no matching line (shouldn't happen — every
 * grade always gets a line — kept as a guard). %Yield/%Loss have no
 * per-material meaning (source computes them on the sum row only), so
 * their `render` always returns blank here — the "รวม {variety}" row
 * fills them in separately. */
const SUB_COLS: { label: string; render: (l: Monthly301Line | undefined) => string }[] = [
  { label: "Quantity", render: (l) => formatNumber(l?.quantity ?? null) },
  { label: "Amount", render: (l) => formatNumber(l?.amount ?? null) },
  { label: "Semi", render: () => "" },
  { label: "สัดส่วน", render: (l) => formatPercent(l?.proportion ?? null) },
  { label: "ราคา/Kg.", render: (l) => formatNumber(l?.pricePerKg ?? null) },
  { label: "%STD", render: (l) => (l?.stdPercent == null ? "" : formatNumber(l.stdPercent, 0)) },
  { label: "ปันใหม่ตาม STD", render: (l) => formatNumber(l?.reallocatedCost ?? null) },
  { label: "ราคาหลังปัน", render: (l) => formatNumber(l?.reallocatedPricePerKg ?? null) },
  { label: "Settlement Rule", render: (l) => formatPercent(l?.settlementRule ?? null) },
  { label: "% Yield", render: () => "" },
  { label: "% Loss", render: () => "" },
];
const QUANTITY_COL_INDEX = 0;
const AMOUNT_COL_INDEX = 1;
const SEMI_COL_INDEX = 2;
const PROPORTION_COL_INDEX = 3;
const SETTLEMENT_COL_INDEX = 8;
const YIELD_COL_INDEX = 9;
const LOSS_COL_INDEX = 10;

/** Blank per-period, per-sub-column cells — used by summary rows that only
 * populate one or two of the 9 sub-columns (matches each real leaf column's
 * width, unlike a colSpan+CSS-grid approximation). */
function periodCells(periods: Period[], valueAt: (period: Period, colIndex: number) => string, cellClass: (colIndex: number) => string) {
  return periods.map((p) => SUB_COLS.map((_, i) => <td key={`${p.key}:${i}`} className={cellClass(i)}>{valueAt(p, i)}</td>));
}

function VarietySection({ label, periods, sectionOf }: { label: string; periods: Period[]; sectionOf: (p: Period) => Monthly301Section | undefined }) {
  const referenceSection = sectionOf(periods[periods.length - 1]);
  if (!referenceSection) return null;

  return (
    <>
      {referenceSection.lines.map((refLine) => (
        <tr key={refLine.material} className={refLine.role === "input" ? "bg-blue-50 font-semibold" : "hover:bg-zinc-50/60"}>
          <td className={`${td} font-mono`}>{refLine.material}</td>
          <td className={td}>{refLine.materialDescription}</td>
          {periods.map((p) => {
            const line = sectionOf(p)?.lines.find((l) => l.material === refLine.material);
            return SUB_COLS.map((c, i) => (
              <td key={`${p.key}:${i}`} className={`${tdNum} ${p.isTotal ? "!bg-zinc-50" : ""}`}>
                {c.render(line)}
              </td>
            ));
          })}
        </tr>
      ))}
      <tr className="bg-zinc-100 font-bold">
        <td className={`${tfootCell} !py-2`} colSpan={2}>
          รวม {label}
        </td>
        {periods.map((p) => {
          const section = sectionOf(p);
          const loss = section?.loss ?? null;
          // Quantity/Amount/สัดส่วน totals come straight off the section now
          // (lib/monthly301Summary.ts) — the on-screen view and the Excel
          // export read the same computed fields instead of each deriving
          // their own (they drifted before — daily-reports/2026-08-31 R10).
          // Quantity/Amount land near zero (mass-balance, native SAP sign);
          // สัดส่วน does not (green's proportion is stored as +100%).
          const quantityTotal = section?.quantityTotal ?? null;
          const amountTotal = section?.amountTotal ?? null;
          const proportionTotal = section?.proportionTotal ?? null;
          return SUB_COLS.map((_, i) => {
            const value =
              i === QUANTITY_COL_INDEX
                ? formatNumber(quantityTotal)
                : i === AMOUNT_COL_INDEX
                  ? formatNumber(amountTotal)
                  : i === SEMI_COL_INDEX
                    ? formatNumber(section?.semiQuantity ?? null)
                    : i === PROPORTION_COL_INDEX
                      ? formatPercent(proportionTotal)
                      : i === SETTLEMENT_COL_INDEX
                        ? formatPercent(section?.settlementRuleTotal ?? null)
                        : i === YIELD_COL_INDEX
                          ? formatPercent(section?.yield ?? null)
                          : i === LOSS_COL_INDEX
                            ? formatPercent(loss)
                            : "";
            return (
              <td key={`${p.key}:${i}`} className={`${tfootNum} ${i === LOSS_COL_INDEX && (loss ?? 0) > 0.02 ? "text-red-600" : ""}`}>
                {value}
              </td>
            );
          });
        })}
      </tr>
    </>
  );
}

/** Robusta + Arabica in one table, matching the source A88:O99 block's own
 * shape (both varieties, one grand-total row at the bottom = row 100) —
 * not two separate tables. */
function CombinedTable({ periods }: { periods: Period[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-300 bg-white shadow-sm">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={`${th} !py-2`} rowSpan={2}>
              Code
            </th>
            <th className={`${th} !py-2`} rowSpan={2}>
              Material
            </th>
            {periods.map((p) => (
              <th key={p.key} className={`${th} text-center !py-2 ${p.isTotal ? "!bg-zinc-200" : ""}`} colSpan={SUB_COLS.length}>
                {p.label}
              </th>
            ))}
          </tr>
          <tr>
            {periods.map((p) =>
              SUB_COLS.map((c, i) => (
                <th
                  key={`${p.key}:${i}`}
                  className={`${th} text-right !py-2 ${i === SETTLEMENT_COL_INDEX ? "!bg-blue-300" : ""} ${i === YIELD_COL_INDEX || i === LOSS_COL_INDEX ? "!bg-emerald-100" : ""} ${p.isTotal ? "!bg-zinc-200" : ""}`}
                >
                  {c.label}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          <VarietySection label="Robusta" periods={periods} sectionOf={(p) => p.sections.find((s) => s.variety === "robusta")} />
          <tr aria-hidden className="h-3 bg-zinc-50">
            <td className="border-0 p-0" colSpan={2 + periods.length * SUB_COLS.length} />
          </tr>
          <VarietySection label="Arabica" periods={periods} sectionOf={(p) => p.sections.find((s) => s.variety === "arabica")} />
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-t-zinc-500 bg-zinc-200 font-bold">
            <td className={`${tfootCell} !py-2`} colSpan={2}>
              รวมทั้งหมด (Robusta + Arabica)
            </td>
            {periodCells(
              periods,
              (p, i) => {
                if (i === QUANTITY_COL_INDEX) return formatNumber(p.diffQuantity);
                if (i === AMOUNT_COL_INDEX) return formatNumber(p.diffAmount);
                return "";
              },
              () => tfootNum,
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function Monthly301SummaryView({
  summary,
  from,
  to,
}: {
  summary: Monthly301Summary | null;
  from: string;
  to: string;
}) {
  const [open, setOpen] = useState(true);

  const months = summary?.months ?? [];
  if (months.length === 0 || !summary?.total) return null;

  const periods: Period[] = [
    ...months.map((m) => ({ key: m.monthKey, label: thMonth(m.monthKey), isTotal: false, sections: m.sections, diffQuantity: m.diffQuantity, diffAmount: m.diffAmount })),
    // Commented out per user request (2026-08-31) — the whole-range
    // "รวมทั้งหมด" period column-group isn't wanted for now. Data is still
    // computed (summary.total) so this is a one-line restore.
    // { key: "__total__", label: "รวมทั้งหมด", isTotal: true, sections: summary.total.sections, diffQuantity: summary.total.diffQuantity, diffAmount: summary.total.diffAmount },
  ];

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-bold text-text cursor-pointer"
        >
          <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} className="text-xs text-text-muted" />
          สรุปรายเดือน
          <span className="font-normal text-xs text-text-muted">{rangeLabel(from, to)}</span>
        </button>
        <a
          href={`/api/export-monthly-301?from=${from}&to=${to}`}
          className="inline-flex items-center gap-1 rounded-full bg-green-700 px-1 py-1 text-sm font-medium text-white hover:bg-green-800"
        >
          <FontAwesomeIcon icon={faFileExcel} />
          Export
        </a>
      </div>

      {open && (
        <div className="border-t border-border px-3 py-4">
          <CombinedTable periods={periods} />
        </div>
      )}
    </div>
  );
}
