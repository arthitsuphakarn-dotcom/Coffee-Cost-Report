"use client";

import { Fragment } from "react";
import { formatNumber, formatPercent } from "@/lib/format";
import type { OrderStageReport, StagePrefix } from "@/lib/types";
import { roleBorder, td, tdNum, tfootCell, tfootNum, th } from "./reportTableStyles";

/** Table for sheet 301's formulas (also used by 305 as a placeholder — see docs/source-analysis.md). */
export default function Stage301Table({
  stage,
  report,
  collapsed,
  onToggleCollapsed,
  onOpenSettlementRule,
  onOpenStdManager,
}: {
  stage: StagePrefix;
  report: OrderStageReport;
  collapsed: Record<string, boolean>;
  onToggleCollapsed: (order: string) => void;
  /** Opens the yearly Settlement Rule Report popup (header-click). */
  onOpenSettlementRule?: () => void;
  /** Opens the %STD change-log manager (header-click) — %STD is now
   * effective-dated master data, resolved per order's month, read-only here. */
  onOpenStdManager?: () => void;
}) {
  const totals = report.groups.reduce(
    (acc, g) => ({
      residualQuantity: acc.residualQuantity + g.residualQuantity,
      residualAmount: acc.residualAmount + g.residualAmount,
      semiQuantity: acc.semiQuantity + g.semiQuantity,
      totalStdPercent: acc.totalStdPercent + g.totalStdPercent,
      totalReallocatedCost: acc.totalReallocatedCost + g.totalReallocatedCost,
    }),
    { residualQuantity: 0, residualAmount: 0, semiQuantity: 0, totalStdPercent: 0, totalReallocatedCost: 0 },
  );

  return (
    <div className="max-h-[90vh] overflow-x-auto rounded-lg border border-zinc-300 bg-white shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className={`${th} sticky top-0 z-30 !bg-blue-300` }>Order</th>
            <th className={`${th} sticky top-0 z-30 !bg-blue-300`}>Material</th>
            <th className={`${th} sticky top-0 z-30 !bg-blue-300`}>Material description</th>
            <th className={`${th} sticky top-0 z-30 !bg-blue-300`}>EUn</th>
            <th className={`${th} sticky top-0 z-30 !bg-blue-300 text-right`}>Quantity</th>
            <th className={`${th} sticky top-0 z-30 !bg-blue-300 text-right`}>Amount</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>Semi</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>สัดส่วน</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>ราคา/Kg.</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>
              <button
                type="button"
                onClick={onOpenStdManager}
                title="จัดการ %STD (ค่ามีผลตามเดือน)"
                className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-blue-900 cursor-pointer"
              >%STD</button>
            </th>
            <th className={`${th} sticky top-0 z-30 text-right`}>ปันใหม่ตาม STD</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>ราคาหลังปัน</th>
            <th className={`${th} sticky top-0 z-30 !bg-blue-300 text-right`}>
              <button
                type="button"
                onClick={onOpenSettlementRule}
                title="ดู Settlement Rule Report (รายปี)"
                className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-blue-900 cursor-pointer"
              >Settlement Rule</button>
            </th>
            <th className={`${th} sticky top-0 z-30 text-right`}>% Yield</th>
            <th className={`${th} sticky top-0 z-30 text-right`}>% Loss</th>
          </tr>
        </thead>
        <tbody>
          {report.groups.map((group) => {
            const key = `${stage}:${group.order}`;
            const isCollapsed = collapsed[key];
            return (
              <Fragment key={group.order}>
                <tr className="border-t-2 border-t-zinc-400 bg-blue-100 font-bold">
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
                  <td className={td}></td> {/* Material Code */}
                  <td className={td}></td> {/* Material Description */}
                  <td className={td}></td> {/* EUn */}
                  <td className={tdNum}>{formatNumber(group.residualQuantity)}</td>
                  <td className={tdNum}>{formatNumber(group.residualAmount)}</td>
                  <td className={tdNum}>{formatNumber(group.semiQuantity)}</td>
                  <td className={tdNum}></td> {/* {formatPercent(group.totalLoss)} */}
                  <td className={tdNum}></td>
                  <td className={tdNum}>{formatNumber(group.totalStdPercent)}</td>
                  <td className={tdNum}>{formatNumber(group.totalReallocatedCost)}</td>
                  <td className={tdNum}></td>
                  <td className={tdNum}>{formatPercent(group.totalSettlement)}</td>
                  <td className={tdNum}>{formatPercent(group.totalYield)}</td>
                  <td className={`${tdNum} ${(group.totalLoss ?? 0) > 0.02 ? "text-red-600" : ""}`}>
                    {formatPercent(group.totalLoss)}
                  </td>
                </tr>

                {!isCollapsed &&
                  group.materials.map((m) => (
                    <tr key={m.material} className="hover:bg-zinc-50/60">
                      <td className={`${td} ${roleBorder[m.role]}`}></td>
                      <td className={`${td} font-mono`}>{m.material}</td>
                      <td className={td}>{m.materialDescription}</td>
                      <td className={td}>{m.eun}</td>
                      <td className={tdNum}>{formatNumber(m.quantity)}</td>
                      <td className={tdNum}>{formatNumber(m.amount)}</td>
                      <td className={tdNum}></td>
                      <td className={tdNum}>{formatPercent(m.proportion)}</td>
                      <td className={tdNum}>{formatNumber(m.pricePerKg)}</td>
                      <td className={tdNum}>{m.role === "output" ? (m.stdPercent === null ? "-" : formatNumber(m.stdPercent, 2)) : null}</td>
                      <td className={tdNum}>{formatNumber(m.reallocatedCost)}</td>
                      <td className={tdNum}>{formatNumber(m.reallocatedPricePerKg)}</td>
                      <td className={tdNum}>{formatPercent(m.settlementRule)}</td>
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
            <td className={tfootNum}>{formatNumber(totals.semiQuantity)}</td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>
            <td className={tfootNum}></td>{/* {formatNumber(totals.totalStdPercent)} */}
            <td className={tfootNum}></td>{/* {formatNumber(totals.totalReallocatedCost)} */}
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
