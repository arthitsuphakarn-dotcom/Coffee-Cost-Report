"use client";

import { Fragment } from "react";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Order302Report } from "@/lib/types";
import { roleBorder, td, tdNum, tfootCell, tfootNum, th } from "./reportTableStyles";

/** Table for sheet 302's own formulas (ใส่สาร/สัดส่วนผสม/สัดส่วน/ราคาต่อหน่วย/Yield/Loss) — see lib/pivot302.ts. */
export default function Stage302Table({
  report,
  collapsed,
  onToggleCollapsed,
}: {
  report: Order302Report;
  collapsed: Record<string, boolean>;
  onToggleCollapsed: (order: string) => void;
}) {
  const totals = report.groups.reduce(
    (acc, g) => ({
      residualQuantity: acc.residualQuantity + g.residualQuantity,
      residualAmount: acc.residualAmount + g.residualAmount,
      totalInputQuantity: acc.totalInputQuantity + g.totalInputQuantity,
    }),
    { residualQuantity: 0, residualAmount: 0, totalInputQuantity: 0 },
  );

  return (
    <div className="max-h-[90vh] overflow-x-auto rounded-lg border border-zinc-300 bg-white shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className={`${th} sticky top-0 z-30 !bg-taupe-600 text-white`}>Order</th>
            <th className={`${th} sticky top-0 z-30 !bg-taupe-600 text-white`}>Material</th>
            <th className={`${th} sticky top-0 z-30 !bg-taupe-600 text-white`}>Material description</th>
            <th className={`${th} sticky top-0 z-30 !bg-taupe-600 text-white`}>EUn</th>
            <th className={`${th} sticky top-0 z-30 text-right !bg-taupe-600 text-white`}>Quantity</th>
            <th className={`${th} sticky top-0 z-30 text-right !bg-taupe-600 text-white`}>Amount</th>
            <th className={`${th} sticky top-0 z-30 text-right !bg-taupe-600 text-white`}>ใส่สาร</th>
            <th className={`${th} sticky top-0 z-30 text-right !bg-taupe-600 text-white`}>สัดส่วนผสม</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>สัดส่วน</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>ราคาต่อหน่วย</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>% Yield</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>% Loss</th>
          </tr>
        </thead>
        <tbody>
          {report.groups.map((group) => {
            const key = `302:${group.order}`;
            const isCollapsed = collapsed[key];
            return (
              <Fragment key={group.order}>
                {/* sum row (top of group, Excel-style) */}
                <tr className="border-t-2 border-t-zinc-400 bg-taupe-300 font-bold">
                  <td className={td}>
                    <button
                      onClick={() => onToggleCollapsed(group.order)}
                      className="text-md mr-1.5 inline-flex w-4 select-none border-t-zinc-400 font-normal hover:font-bold cursor-pointer"
                      aria-label={isCollapsed ? "expand" : "collapse"}
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </button>
                    <span className="font-mono">{group.order}</span>
                  </td> {/* order */}
                  <td className={td}></td> {/* material code */}
                  <td className={td}></td> {/* material name */}
                  <td className={td}></td> {/* EUn */}
                  <td className={tdNum}>{formatNumber(group.residualQuantity)}</td> {/* Quantity */}
                  <td className={tdNum}>{formatNumber(group.residualAmount)}</td> {/* Amount */}
                  <td className={tdNum}>{formatNumber(group.totalInputQuantity)}</td> {/* ใส่สาร */}
                  <td className={tdNum}></td> {/* สัดส่วนผสม */}
                  <td className={tdNum}>{formatPercent(group.totalMixRatio)}</td> {/* สัดส่วน */}
                  <td className={tdNum}>{formatNumber(group.totalPricePerKg)}</td> {/* ราคาต่อหน่วย */}
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
                      <td className={tdNum}></td>
                      <td className={tdNum}>{formatPercent(m.mixRatio)}</td> {/* สัดส่วนผสม */}
                      <td className={tdNum}>{formatPercent(m.outputRatio)}</td> {/* สัดส่วน */}
                      <td className={tdNum}>{formatNumber(m.pricePerKg)}</td> {/* ราคาต่อหน่วย */}
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
            <td className={tfootNum}>{formatNumber(totals.totalInputQuantity)}</td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
