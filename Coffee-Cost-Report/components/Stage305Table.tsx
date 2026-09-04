"use client";

import { Fragment } from "react";
import { formatNumber, formatPercent } from "@/lib/format";
import { FG_UNIT_WEIGHT_GRAMS } from "@/lib/fgUnitWeights";
import type { Order305Report } from "@/lib/types";
import { inputCell, roleBorder, td, tdNum, tfootCell, tfootNum, th } from "./reportTableStyles";

/**
 * Table for sheet 305's real formulas (ราคาต่อหน่วย/Yield/Loss) — see
 * lib/pivot305.ts. Yield needs a grams-per-bag weight for both the blend
 * input row and each BAG output row (input and output bag sizes can differ —
 * e.g. one 500g bag repacked into two 250g bags), same confirmed-table/
 * editable-fallback pattern as 303's "น้ำหนัก/หน่วย (g)" column. The source
 * sheet's manual daily defect-reason columns aren't included — same as 303,
 * still pending the on-site conversation with production/QA.
 */
export default function Stage305Table({
  report,
  collapsed,
  onToggleCollapsed,
  onUnitWeightChange,
}: {
  report: Order305Report;
  collapsed: Record<string, boolean>;
  onToggleCollapsed: (order: string) => void;
  onUnitWeightChange: (material: string, value: string) => void;
}) {
  const totals = report.groups.reduce(
    (acc, g) => ({
      residualQuantity: acc.residualQuantity + g.residualQuantity,
      residualAmount: acc.residualAmount + g.residualAmount,
      outputWeightG: acc.outputWeightG + (g.outputWeightG ?? 0),
    }),
    { residualQuantity: 0, residualAmount: 0, outputWeightG: 0 },
  );

  return (
    <div className="max-h-[90vh] overflow-x-auto rounded-lg border border-zinc-300 bg-white shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className={`${th} sticky top-0 z-30 !bg-violet-300`}>Order</th>
            <th className={`${th} sticky top-0 z-30 !bg-violet-300`}>Material</th>
            <th className={`${th} sticky top-0 z-30 !bg-violet-300`}>Material description</th>
            <th className={`${th} sticky top-0 z-30 !bg-violet-300`}>EUn</th>
            <th className={`${th} sticky top-0 z-30 !bg-violet-300`}>MvT</th>
            <th className={`${th} sticky top-0 z-30 text-right !bg-violet-300`}>Quantity</th>
            <th className={`${th} sticky top-0 z-30 text-right !bg-violet-300`}>Amount</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>G</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>KG</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>ราคาต่อหน่วย</th>
            {/* <th className={`${th} sticky top-0 z-30 text-right`}>น้ำหนัก/หน่วย (g)</th> */}
            <th className={`${th} sticky top-0 z-30 text-right`}>% Yield</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>% Loss</th>
          </tr>
        </thead>
        <tbody>
          {report.groups.map((group) => {
            const key = `305:${group.order}`;
            const isCollapsed = collapsed[key];
            return (
              <Fragment key={group.order}>
                {/* sum row (top of group, Excel-style) */}
                <tr className="border-t-2 border-t-zinc-400 bg-violet-100 font-bold">
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
                  <td className={td}></td>
                  <td className={tdNum}></td>
                  <td className={tdNum}></td>
                  <td className={tdNum}></td>
                  <td className={tdNum}></td>
                  <td className={tdNum}></td>
                  {/* <td className={tdNum}></td> */}
                  <td className={tdNum}>{formatPercent(group.yield)}</td>
                  <td className={`${tdNum} ${(group.loss ?? 0) > 0.02 ? "text-red-600" : ""}`}>{formatPercent(group.loss)}</td>
                </tr>

                {!isCollapsed &&
                  group.lines.map((m) => {
                    const isBlendInput = m.role === "input" && m.material === group.blendInputMaterial;
                    const editableWeight = (isBlendInput || m.role === "output") && m.eun === "BAG";
                    return (
                      <tr key={m.material} className="hover:bg-zinc-50/60">
                        <td className={`${td} ${roleBorder[m.role]}`}></td>
                        <td className={`${td} font-mono`}>{m.material}</td>
                        <td className={td}>{m.materialDescription}</td>
                        <td className={td}>{m.eun}</td>
                        <td className={td}>{m.mvt}</td>
                        <td className={tdNum}>{formatNumber(m.quantity)}</td>
                        <td className={tdNum}>{formatNumber(m.amount)}</td>
                        <td className={tdNum}>{formatNumber(m.outputG)}</td>
                        <td className={tdNum}>{formatNumber(m.outputKg)}</td>
                        <td className={tdNum}>{formatNumber(m.pricePerKg)}</td>
                        {/* <td className={tdNum}>
                          {!editableWeight ? null : FG_UNIT_WEIGHT_GRAMS[m.material] ? (
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
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className={tfootCell} colSpan={5}>
              รวมทั้งหมด ({report.groups.length} Order)
            </td>
            <td className={tfootNum}>{formatNumber(totals.residualQuantity)}</td>
            <td className={tfootNum}>{formatNumber(totals.residualAmount)}</td>
            <td className={tfootNum}>{formatNumber(totals.outputWeightG)}</td>
            <td className={tfootNum}>{formatNumber(totals.outputWeightG / 1000)}</td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
