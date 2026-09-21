"use client";

import { formatNumber, formatPercent } from "@/lib/core/format";
import type { SummaryDashboardReport } from "@/lib/core/types";

// `dashTh` bakes in bg-surface-2 — pairing it with a second bg-* utility on the
// same element is unreliable in Tailwind (whichever rule the compiler
// emits last wins, not source order), so the colored band cells use their
// own background-free base instead of layering on top of `dashTh`.
const thBase = "border border-border px-3 py-2 text-sm font-semibold text-text whitespace-nowrap";
const bandTh = (bg: string, fg: string) => `${thBase} text-center font-bold ${bg} ${fg}`;
const subTh = (bg: string, fg: string) => `${thBase} text-right ${bg} ${fg}`;
const dashTh = "border border-border bg-surface-2 px-3 py-2 text-left text-sm font-semibold text-text whitespace-nowrap";
const dashTd = "border border-border px-3 py-2 text-sm whitespace-nowrap font-mono";
const dashTdNum = `${dashTd} text-right tabular-nums`;

/**
 * One row per month, Preclean → Roasting → Packing, matching
 * `Roasting Dashboard Initiative.xlsx`'s "Dash" sheet layout, restyled to
 * match the "Coffee Roasting Performance & Monitoring" reference screenshot
 * — colored group bands (same preclean/roasting/packing tokens as the KPI
 * cards above) and numbered rows. Columns are the 9 the source `Dash` sheet
 * actually has; the combined %Yield only appears as a KPI card above
 * (DashboardOverview), not repeated here, matching the reference layout.
 * `%Yield 3` here is Packing's own stage yield (FG ÷ Output Roasting, per
 * the source formula and the user's confirmation) — not the combined
 * farm-to-bag yield.
 */
export default function SummaryDashboardTable({
  report,
  selectedMonthKey,
  onSelectMonth,
}: {
  report: SummaryDashboardReport;
  /** When set, highlights that row — driven by the same cross-filter state
   * the charts above use (DashboardOverview), so clicking a chart point and
   * clicking a table row select the same thing. Both props are optional so
   * this table still works stand-alone if ever reused without the filter. */
  selectedMonthKey?: string | null;
  onSelectMonth?: (monthKey: string) => void;
}) {
  const excludedMaterials = Array.from(new Set(report.months.flatMap((m) => m.packing.excludedMaterials))).sort();
  // Roasting/Packing aren't attributable to one variety or supplier (see
  // lib/summaryDashboard.ts) — show "-" rather than the forced-empty
  // numbers computeSummaryDashboard returns while a filter is active.
  const rc = (formatted: string) => (report.filtersActive ? "-" : formatted);

  return (
    <div>
      {excludedMaterials.length > 0 && (
        <div className="mb-4 rounded-lg border border-packing bg-packing-soft p-3.5 text-sm text-packing-line">
          ไม่นับ FG code {excludedMaterials.join(", ")} ในยอด FG/%Yield 3 — ไม่อยู่ในตารางน้ำหนักที่ยืนยันแล้ว
          (lib/fgUnitWeights.ts) ตามสูตรที่ให้มา (ไม่ใช่ข้อมูลที่ขาด)
        </div>
      )}
      <div className="shadow-card overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={dashTh} rowSpan={2}></th>
              <th className={dashTh} rowSpan={2}>
                เดือน
              </th>
              <th className={bandTh("bg-preclean-soft", "text-preclean-line")} colSpan={4}>
                Preclean
              </th>
              <th className={bandTh("bg-roasting-soft", "text-roasting-line")} colSpan={3}>
                Roasting
              </th>
              <th className={bandTh("bg-packing-soft", "text-packing-line")} colSpan={2}>
                Packing
              </th>
            </tr>
            <tr>
              <th className={subTh("bg-preclean-soft", "text-preclean-line")}>Input Preclean</th>
              <th className={subTh("bg-preclean-soft", "text-preclean-line")}>Yield 1</th>
              <th className={subTh("bg-preclean-soft", "text-preclean-line")}>Lot 1</th>
              <th className={subTh("bg-preclean-soft", "text-preclean-line")}>%Yield 1</th>
              <th className={subTh("bg-roasting-soft", "text-roasting-line")}>Input RM</th>
              <th className={subTh("bg-roasting-soft", "text-roasting-line")}>Output Roasting</th>
              <th className={subTh("bg-roasting-soft", "text-roasting-line")}>%Yield 2</th>
              <th className={subTh("bg-packing-soft", "text-packing-line")}>FG</th>
              <th className={subTh("bg-packing-soft", "text-packing-line")}>%Yield 3</th>
            </tr>
          </thead>
          <tbody>
            {report.months.map((m, i) => (
              <tr
                key={m.monthKey}
                onClick={onSelectMonth ? () => onSelectMonth(m.monthKey) : undefined}
                className={`${onSelectMonth ? "cursor-pointer" : ""} ${
                  m.monthKey === selectedMonthKey ? "bg-roasting-soft" : "hover:bg-surface-2"
                }`}
                title={onSelectMonth ? "คลิกเพื่อกรองเดือนนี้" : undefined}
              >
                <td className={`${dashTd} text-text-muted`}>{i + 1}.</td>
                <td className={`${dashTd} font-sans font-medium`}>{m.monthLabel}</td>
                <td className={dashTdNum}>{formatNumber(-m.preclean.inputQuantity)}</td>
                <td className={dashTdNum}>{formatNumber(m.preclean.totalOutputQuantity)}</td>
                <td className={dashTdNum}>{formatNumber(m.preclean.lot1OutputQuantity)}</td>
                <td className={dashTdNum}>{formatPercent(m.preclean.yield)}</td>
                <td className={dashTdNum}>{rc(formatNumber(-m.roasting.inputQuantity))}</td>
                <td className={dashTdNum}>{rc(formatNumber(m.roasting.outputQuantity))}</td>
                <td className={dashTdNum}>{rc(formatPercent(m.roasting.yield))}</td>
                <td className={dashTdNum}>{rc(formatNumber(m.packing.outputWeightKg))}</td>
                <td className={dashTdNum}>{rc(formatPercent(m.packing.yield))}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-t-text-muted bg-surface-2 font-bold">
              <td className={dashTd}></td>
              <td className={`${dashTd} font-sans font-bold`}>Grand total</td>
              <td className={dashTdNum}>{formatNumber(-report.total.preclean.inputQuantity)}</td>
              <td className={dashTdNum}>{formatNumber(report.total.preclean.aOutputQuantity)}</td>
              <td className={dashTdNum}>{formatNumber(report.total.preclean.lot1OutputQuantity)}</td>
              <td className={dashTdNum}>{formatPercent(report.total.preclean.yield)}</td>
              <td className={dashTdNum}>{rc(formatNumber(-report.total.roasting.inputQuantity))}</td>
              <td className={dashTdNum}>{rc(formatNumber(report.total.roasting.outputQuantity))}</td>
              <td className={dashTdNum}>{rc(formatPercent(report.total.roasting.yield))}</td>
              <td className={dashTdNum}>{rc(formatNumber(report.total.packing.outputWeightKg))}</td>
              <td className={dashTdNum}>{rc(formatPercent(report.total.packing.yield))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
