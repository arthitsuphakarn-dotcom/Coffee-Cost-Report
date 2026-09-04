"use client";

import { Fragment } from "react";
import { formatNumber, formatPercent } from "@/lib/format";
import { FG_UNIT_WEIGHT_GRAMS } from "@/lib/fgUnitWeights";
import type { Order303Report } from "@/lib/types";
import { inputCell, roleBorder, td, tdNum, tfootCell, tfootNum, th } from "./reportTableStyles";

/**
 * Table for sheet 303's formulas that are actually MB51-derivable
 * (ราคาต่อหน่วย/Yield/Loss) — see lib/pivot303.ts. Yield needs each output
 * material's weight per unit (grams/bag), which isn't in MB51 — 8 of the 15
 * FG codes have a confirmed weight (`FG_UNIT_WEIGHT_GRAMS`, given by the
 * user 2026-08-21) shown as plain text here since it's fixed, not editable;
 * anything else still falls back to the editable master field (same UX as
 * 301's %STD). The source sheet's ~20 manual daily defect-reason columns
 * are not included — still pending the on-site conversation the project
 * docs flag as open.
 */
export default function Stage303Table({
  report,
  collapsed,
  onToggleCollapsed,
  onUnitWeightChange,
}: {
  report: Order303Report;
  collapsed: Record<string, boolean>;
  onToggleCollapsed: (order: string) => void;
  onUnitWeightChange: (material: string, value: string) => void;
}) {
  const totals = report.groups.reduce(
    (acc, g) => ({
      residualQuantity: acc.residualQuantity + g.residualQuantity,
      residualAmount: acc.residualAmount + g.residualAmount,
    }),
    { residualQuantity: 0, residualAmount: 0 },
  );

  return (
    <div className="max-h-[90vh] overflow-x-auto rounded-lg border border-zinc-300 bg-white shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className={`${th} sticky top-0 z-30 !bg-sky-300`}>Order</th>
            <th className={`${th} sticky top-0 z-30 !bg-sky-300`}>Material</th>
            <th className={`${th} sticky top-0 z-30 !bg-sky-300`}>Material description</th>
            <th className={`${th} sticky top-0 z-30 !bg-sky-300`}>EUn</th>
            <th className={`${th} sticky top-0 z-30 text-right !bg-sky-300`}>Quantity</th>
            <th className={`${th} sticky top-0 z-30 text-right !bg-sky-300`}>Amount</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>ราคาต่อหน่วย</th>
            {/* <th className={`${th} sticky top-0 z-30 text-right`}>น้ำหนัก/หน่วย (g)</th> */}
            <th className={`${th} sticky top-0 z-30 text-right`}>% Yield</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>% Loss</th>
          </tr>
        </thead>
        <tbody>
          {report.groups.map((group) => {
            const key = `303:${group.order}`;
            const isCollapsed = collapsed[key];
            return (
              <Fragment key={group.order}>
                {/* sum row (top of group, Excel-style) */}
                <tr className="border-t-2 border-t-zinc-400 bg-cyan-100 font-bold">
                  <td className={td}>
                    <button
                      onClick={() => onToggleCollapsed(group.order)}
                      className="text-md mr-1.5 inline-flex w-4 select-none border-t-zinc-400 font-normal hover:font-bold cursor-pointer"
                      aria-label={isCollapsed ? "expand" : "collapse"}
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </button>
                    <span className="font-mono">{group.order}</span>
                  </td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={tdNum}>{formatNumber(group.residualQuantity)}</td>
                  <td className={tdNum}>{formatNumber(group.residualAmount)}</td>
                  <td className={tdNum}></td>
                  {/* <td className={tdNum}></td> */}
                  <td className={tdNum}>{formatPercent(group.yield)}</td>
                  <td className={`${tdNum} ${(group.loss ?? 0) > 0.02 ? "text-red-600" : ""}`}>{formatPercent(group.loss)}</td>
                </tr>

                {!isCollapsed &&
                  group.lines.map((m) => (
                    <tr key={m.material} className="hover:bg-zinc-50/60">
                      <td className={`${td} ${roleBorder[m.role]}`}></td>
                      <td className={`${td} font-mono`}>{m.material}</td>
                      <td className={td}>{m.materialDescription}</td>
                      <td className={td}>{m.eun}</td>
                      <td className={tdNum}>{formatNumber(m.quantity)}</td>
                      <td className={tdNum}>{formatNumber(m.amount)}</td>
                      <td className={tdNum}>{formatNumber(m.pricePerKg)}</td>
                      {/* <td className={tdNum}>
                        {m.role !== "output" ? null : FG_UNIT_WEIGHT_GRAMS[m.material] ? (
                          <span title="น้ำหนักยืนยันแล้ว ไม่แก้ไขในนี้">{formatNumber(FG_UNIT_WEIGHT_GRAMS[m.material], 0)}</span>
                        ) : (
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={m.unitWeightGrams ?? ""}
                            onChange={(e) => onUnitWeightChange(m.material, e.target.value)}
                            placeholder="-"
                            className={inputCell}
                          />
                        )}
                      </td> */}
                      <td className={tdNum}></td>
                      <td className={tdNum}></td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className={tfootCell} colSpan={4}>
              รวมทั้งหมด ({report.groups.length} Order)
            </td>
            <td className={tfootNum}>{formatNumber(totals.residualQuantity)}</td>
            <td className={tfootNum}>{formatNumber(totals.residualAmount)}</td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
