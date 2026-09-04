"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatPercent } from "@/lib/format";
import { computeSummaryDashboard, type Variety } from "@/lib/summaryDashboard";
import type { RawMovementRow } from "@/lib/types";
import SummaryDashboardTable from "./SummaryDashboardTable";

const VARIETY_LABEL: Record<Variety, string> = { arabica: "Arabica", robusta: "Robusta" };

const SUPPLIER_COLORS = ["#2563eb", "#0891b2", "#a855f7", "#84cc16", "#f97316", "#ec4899", "#64748b"];
const GRID_COLOR = "var(--color-border)";
const AXIS_STYLE = { fontSize: 12, fontFamily: "var(--font-mono)", fill: "var(--color-text-muted)" };

/** Line `dot` renderer that draws the selected month's point larger, so the
 * cross-filter selection is visible on the line charts too, not just via
 * the ReferenceLine. `payload.monthKey` comes from the chart data points
 * built below — every series (yield1, arabica/robusta) carries it. */
function monthAwareDot(color: string, selectedMonthKey: string | null) {
  return function Dot(props: { cx?: number; cy?: number; payload?: { monthKey?: string } }) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return <></>;
    const isSelected = selectedMonthKey !== null && payload?.monthKey === selectedMonthKey;
    return (
      <circle
        key={`${payload?.monthKey ?? cx}-dot`}
        cx={cx}
        cy={cy}
        r={isSelected ? 5.5 : 3}
        fill={color}
        stroke={isSelected ? "var(--color-surface)" : "none"}
        strokeWidth={isSelected ? 2 : 0}
      />
    );
  };
}

type Accent = "preclean" | "roasting" | "packing";

// Tailwind can't see classes assembled via template-literal interpolation
// (`border-l-${accent}`) at build time, so each accent needs its own fully
// literal class string here instead of a shared "border-l-" + accent join.
const KPI_BORDER: Record<Accent, string> = {
  preclean: "border-l-preclean",
  roasting: "border-l-roasting",
  packing: "border-l-packing",
};
// const CLUSTER_STYLE: Record<Accent, string> = {
//   preclean: "text-preclean border-preclean",
//   roasting: "text-roasting border-roasting",
//   packing: "text-packing border-packing",
// };

function SubBadge({ label, value, tone, title, align }: { label: string; value: string; tone?: "good" | "warn"; title: string; align: "start" | "end" }) {
  return (
    <div className={`flex flex-col gap-0.5 ${align === "end" ? "items-end" : "items-start"}`} title={title}>
      <span className="text-[0.7rem] leading-tight text-text-muted">{label}</span>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[0.88rem] font-semibold ${
          tone === "warn" ? "bg-down/15 text-down" : "bg-up/15 text-up"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  sub,
  subTone,
  subs,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  subTone?: "good" | "warn";
  /** Two badges shown in one row, pinned to opposite corners (index 0 =
   * bottom-left, index 1 = bottom-right) instead of the single `sub` pill —
   * used by the %Yield 3 card to show both yield-3 formulas at once. */
  subs?: { label: string; value: string; tone?: "good" | "warn"; title: string }[];
  accent: Accent;
}) {
  return (
    <div className={`shadow-card rounded-[10px] border border-border border-l-6 bg-surface p-3.5 ${KPI_BORDER[accent]}`}>
      <div className="min-h-[1.7em] text-[0.7rem] font-semibold leading-snug text-text-muted">{label}</div>
      <div className="flex items-baseline gap-2.0">
        <span className="font-mono text-[1.9rem] font-semibold text-text tabular-nums">{value}</span>
        <span className="text-[0.9rem] text-text-muted pl-2">{unit}</span>
      </div>
      {subs ? (
        <div className={`mt-1.5 flex items-end gap-2 ${subs.length > 1 ? "justify-between" : "justify-start"}`}>
          {subs.map((s, i) => (
            <SubBadge key={s.label} {...s} align={subs.length > 1 && i === subs.length - 1 ? "end" : "start"} />
          ))}
        </div>
      ) : (
        sub && (
          <div
            className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[0.78rem] font-semibold ${
              subTone === "warn" ? "bg-down/15 text-down" : "bg-up/15 text-up"
            }`}
          >
            {sub}
          </div>
        )
      )}
    </div>
  );
}

// function ClusterLabel({ children, accent }: { children: React.ReactNode; accent: Accent }) {
//   return <div className={`border-b-2 pb-1.5 text-[0.66rem] font-bold uppercase tracking-widest ${CLUSTER_STYLE[accent]}`}>{children}</div>;
// }

function ChartCard({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <div className="shadow-card rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-0.5 text-[0.85rem] font-semibold text-text">{title}</h3>
      {caption && <p className="mb-2.5 text-[0.7rem] text-text-muted">{caption}</p>}
      <div className="cursor-pointer" style={{ width: "100%", height: 220 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Reads the clicked point's month off a recharts click event. Recharts v3
 * (this project uses ^3.10.1) changed the chart-root `onClick` callback's
 * first argument from v2's `{ activePayload: [...] }` shape to
 * `MouseHandlerDataParam` (`activeIndex`, `activeLabel`, ... — no
 * `activePayload` at all). The original implementation read the old
 * `activePayload[0].payload.monthKey` shape, which silently no-ops on v3
 * (the field is just `undefined`, no runtime error) — found 2026-08-25 via
 * an actual browser click test, not just a type-check, since this compiles
 * fine either way. Fixed by using `activeIndex` (the clicked point's
 * position in the chart's `data` array) to look up the real month key from
 * `monthKeysInOrder`, which every chart below shares since they're all
 * built from the same `report.months` sequence.
 */
function monthKeyFromChartClick(state: unknown, monthKeysInOrder: string[]): string | null {
  const activeIndex = (state as { activeIndex?: number | string } | null)?.activeIndex;
  if (activeIndex === undefined || activeIndex === null) return null;
  const idx = typeof activeIndex === "number" ? activeIndex : Number(activeIndex);
  return Number.isInteger(idx) ? (monthKeysInOrder[idx] ?? null) : null;
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "all";
  options: { value: T; label: string }[];
  onChange: (value: T | "all") => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | "all")}
        className="rounded border border-border bg-surface pl-2 pr-3 py-1 text-xs text-text outline-none focus:ring-1 focus:ring-roasting"
      >
        <option value="all">ทั้งหมด</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1.5 rounded-full border border-roasting bg-roasting-soft px-3 py-1 text-xs font-medium text-roasting-line hover:bg-roasting/20"
      title="คลิกเพื่อล้างตัวกรองนี้"
    >
      {label}
      <span className="text-sm leading-none">×</span>
    </button>
  );
}

/**
 * Overview page for the Summary Dashboard tab: KPI cards + trend charts on
 * top of the existing month-by-month table (SummaryDashboardTable). Design
 * matches the standalone Artifact preview built for this same dashboard —
 * same tokens (globals.css: --preclean/--roasting/--packing), same Sarabun
 * + IBM Plex Mono type system, same cluster-labeled KPI row.
 */
export default function DashboardOverview({ rows, dateRangeLabel }: { rows: RawMovementRow[]; dateRangeLabel: string }) {
  // Real filters: variety and supplier actually restrict the rows every
  // figure below is computed from (see lib/summaryDashboard.ts's
  // DashboardFilters) — this is what makes selecting one genuinely change
  // every chart, KPI, and the table together, not just dim bars in whichever
  // chart you clicked. Fixed 2026-08-25 after the user found the previous
  // version's supplier click only affected the one chart it lived in.
  const [variety, setVariety] = useState<Variety | "all">("all");
  const [supplierFilter, setSupplierFilter] = useState<string | "all">("all");
  // Month selection stays a highlight (KPI switches to that month + a
  // reference line on every chart), not a row filter — collapsing 3 trend
  // charts down to a single point would defeat the point of a trend chart.
  // It's still genuinely cross-chart: one click updates the KPI row, all 3
  // charts' reference line, and the table's highlighted row together.
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const report = useMemo(
    () => computeSummaryDashboard(rows, { variety: variety === "all" ? null : variety, supplier: supplierFilter === "all" ? null : supplierFilter }),
    [rows, variety, supplierFilter]
  );
  const total = report.total;

  function toggleMonth(monthKey: string | null) {
    if (!monthKey) return;
    setSelectedMonthKey((prev) => (prev === monthKey ? null : monthKey));
  }

  /** Bar/legend clicks on the supplier chart set the real `supplierFilter`
   * dropdown (not a separate visual-only state) — clicking there and
   * picking the same name from the dropdown are now the same action. */
  function toggleSupplier(supplier: string | null) {
    if (!supplier) return;
    setSupplierFilter((prev) => (prev === supplier ? "all" : supplier));
  }

  function toggleRM(variety: string | null) {
    if (!variety) return;
    setSupplierFilter((prev) => (prev === variety ? "all" : variety));
  }

  const monthKeysInOrder = useMemo(() => report.months.map((m) => m.monthKey), [report.months]);

  function handleChartClick(state: unknown) {
    toggleMonth(monthKeyFromChartClick(state, monthKeysInOrder));
  }

  const selectedMonth = selectedMonthKey ? report.months.find((m) => m.monthKey === selectedMonthKey) ?? null : null;
  const selectedMonthShortLabel = selectedMonth?.monthLabel.split(" ")[0] ?? null;
  // KPI cards show the selected month's own figures instead of the
  // full-range total whenever a month is picked — the point of cross-filter
  // is that picking a point on a chart actually changes the numbers shown
  // elsewhere, not just highlights something.
  const kpi = selectedMonth ?? total;

  const yield1TrendData = useMemo(
    () =>
      report.months.map((m) => ({
        month: m.monthLabel.split(" ")[0],
        monthKey: m.monthKey,
        yield1: m.preclean.yield !== null ? m.preclean.yield * 100 : null,
      })),
    [report.months]
  );

  const lot1CumulativeData = useMemo(() => {
    const points: { month: string; monthKey: string; arabica: number; robusta: number }[] = [];
    for (const m of report.months) {
      const prev = points[points.length - 1];
      points.push({
        month: m.monthLabel.split(" ")[0],
        monthKey: m.monthKey,
        arabica: (prev?.arabica ?? 0) + m.preclean.lot1ArabicaQuantity,
        robusta: (prev?.robusta ?? 0) + m.preclean.lot1RobustaQuantity,
      });
    }
    return points;
  }, [report.months]);

  const supplierTrendData = useMemo(() => {
    const rowsByMonth = new Map<string, Record<string, string | number | null>>();
    for (const m of report.months) {
      rowsByMonth.set(m.monthKey, { month: m.monthLabel.split(" ")[0], monthKey: m.monthKey });
    }
    for (const p of report.bySupplier) {
      const row = rowsByMonth.get(p.monthKey);
      if (row) row[p.supplier] = p.yield !== null ? p.yield * 100 : null;
    }
    return Array.from(rowsByMonth.values());
  }, [report.months, report.bySupplier]);

  const hasActiveFilter = selectedMonthKey !== null || supplierFilter !== "all" || variety !== "all";

  return (
    <div className="">
      <div className="shadow-card mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2.5">

      {/* ฝั่งซ้าย */}
      <div className="flex items-center gap-3">
        {/* <h2 className="text-sm font-semibold text-text text-xl">
          Coffee Roasting Performance &amp; Monitoring
        </h2> */}

        <span className="rounded-full border border-border bg-surface-2 px-3.5 py-1 text-xs text-text">
          {dateRangeLabel}
          {report.months.length > 0 && (
            <span className="ml-2 font-mono text-text-muted">
              ({report.months.length} เดือน)
            </span>
          )}
        </span>
      </div>

      {/* ฝั่งขวา */}
      <div className="flex items-center gap-2">
        <FilterDropdown
          label="สารกาแฟ"
          value={variety}
          options={(Object.keys(VARIETY_LABEL) as Variety[]).map((v) => ({
            value: v,
            label: VARIETY_LABEL[v],
          }))}
          onChange={setVariety}
        />

        <FilterDropdown
          label="Supplier"
          value={supplierFilter}
          options={report.suppliers.map((s) => ({
            value: s,
            label: s,
          }))}
          onChange={setSupplierFilter}
        />
      </div>

    </div>

      {/* <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
        <FilterDropdown
          label="สารกาแฟ"
          value={variety}
          options={(Object.keys(VARIETY_LABEL) as Variety[]).map((v) => ({ value: v, label: VARIETY_LABEL[v] }))}
          onChange={setVariety}
        />
        <FilterDropdown
          label="Supplier"
          value={supplierFilter}
          options={report.suppliers.map((s) => ({ value: s, label: s }))}
          onChange={setSupplierFilter}
        />
        <span className="text-[0.68rem] text-text-muted">คลิกจุด/แท่งในกราฟ หรือแถวในตาราง เพื่อกรองเดือน · คลิก legend เพื่อกรอง supplier</span>
      </div> */}

      {hasActiveFilter && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[0.68rem] font-medium text-text-muted">กำลังกรอง:</span>
          {selectedMonth && <FilterChip label={`เดือน: ${selectedMonth.monthLabel}`} onClear={() => setSelectedMonthKey(null)} />}
          {variety !== "all" && <FilterChip label={`สารกาแฟ: ${VARIETY_LABEL[variety]}`} onClear={() => setVariety("all")} />}
          {supplierFilter !== "all" && <FilterChip label={`Supplier: ${supplierFilter}`} onClear={() => setSupplierFilter("all")} />}
          <button
            onClick={() => {
              setSelectedMonthKey(null);
              setVariety("all");
              setSupplierFilter("all");
            }}
            className="text-[0.7rem] text-text-muted underline hover:text-text"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      )}

      {report.filtersActive && (
        <div className="mb-4 rounded-lg border border-roasting bg-roasting-soft p-3 text-xs text-roasting-line">
          ตัวกรองสารกาแฟ และ Supplier ใช้ได้กับข้อมูล <strong>Preclean</strong> เท่านั้น — ตั้งแต่ขั้น Roasting
          เป็นต้นไปเป็นการผสมสารกาแฟหลายล็อตเข้าด้วยกัน และอาจมีมากกว่า 1 Supplier จึงไม่มีตัวเลขที่สามารถแยกได้จริง
        </div>
      )}

      {/* <div className="mb-1.5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <ClusterLabel accent="preclean">Preclean</ClusterLabel>
        <ClusterLabel accent="preclean">Preclean</ClusterLabel>
        <ClusterLabel accent="roasting">Roasting</ClusterLabel>
        <ClusterLabel accent="roasting">Roasting</ClusterLabel>
        <ClusterLabel accent="packing">Packing · รวมทั้งสาย</ClusterLabel>
      </div> */}

      {/* <div className="mb-1.5 text-[0.68rem] text-text-muted">
        KPI: <span className="font-medium text-text">{selectedMonth ? selectedMonth.monthLabel : `รวมทั้งหมด (${dateRangeLabel})`}</span>
      </div> */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="สารกาแฟ (Raw Material)"
            value={formatNumber(kpi.preclean.inputQuantity / 1000)}
            unit="ตัน" accent="preclean"
        />
        <KpiCard
          label="%Yield 1 · (Preclean)"
          value={formatNumber(kpi.preclean.totalOutputQuantity / 1000)}
          unit="ตัน"
          //sub={formatPercent(kpi.preclean.yield)}
          subs={[
            {
              label: "เทียบสารกาแฟ",
              value: formatPercent(kpi.preclean.yield),
              tone: (kpi.preclean.yield ?? 1) < 0.7 ? "warn" : "good",
              title: "YIELD 1 = (เกรด A + Lot#1) ÷ สารกาแฟ",
            },
          ]}
          subTone="good"
          accent="preclean"
        />
        <KpiCard
          label="Input RM · (Roasting)"
          value={report.filtersActive ? "-" : formatNumber(kpi.roasting.inputQuantity / 1000)}
          unit={report.filtersActive ? "" : "ตัน"}
          accent="roasting"
        />
        <KpiCard
          label="%Yield 2 · (Roasting)"
          value={report.filtersActive ? "-" : formatNumber(kpi.roasting.outputQuantity / 1000)}
          unit={report.filtersActive ? "" : "ตัน"}
          subs={
            report.filtersActive
              ? undefined
              : [
                  {
                    label: "เทียบ Input RM",
                    value: formatPercent(kpi.roasting.yield),
                    tone: (kpi.roasting.yield ?? 1) < 0.7 ? "warn" : "good",
                    title: "YIELD 1",
                  },
                ]
          }
          accent="roasting"
        />
        <KpiCard
          label="%Yield 3 · (FG)"
          value={report.filtersActive ? "-" : formatNumber(kpi.packing.outputWeightKg / 1000)}
          unit={report.filtersActive ? "" : "ตัน"}
          subs={
            report.filtersActive
              ? undefined
              : [
                  {
                    label: "เทียบ Roasting",
                    value: formatPercent(kpi.packing.yield),
                    tone: (kpi.packing.yield ?? 1) < 0.7 ? "warn" : "good",
                    title: "YIELD 3(FG) ÷ Output Roasting",
                  },
                  {
                    label: "เทียบ Input RM",
                    value: formatPercent(kpi.combinedYield !== null ? Math.abs(kpi.combinedYield) : null),
                    tone: (kpi.combinedYield !== null ? Math.abs(kpi.combinedYield) : 1) < 0.7 ? "warn" : "good",
                    title: "abs(YIELD 3(FG) ตัน ÷ INPUT RM ตัน)",
                  },
                ]
          }
          accent="packing"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <ChartCard title="📈 %Yield 1 Trend" caption="เกรด A + Lot#1 รายเดือน · คลิกจุดเพื่อกรองเดือน">
          <ResponsiveContainer>
            <LineChart data={yield1TrendData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="month" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              {selectedMonthShortLabel && <ReferenceLine x={selectedMonthShortLabel} stroke="var(--color-text)" strokeDasharray="4 3" strokeOpacity={0.55} />}
              <Line
                type="monotone"
                dataKey="yield1"
                name="%Yield 1"
                stroke="var(--color-preclean-line)"
                strokeWidth={2.2}
                dot={monthAwareDot("var(--color-preclean-line)", selectedMonthKey)}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="⚠️ Lot Number 1 (Cumulative)"
          caption={`เกรด B สะสม · รวม ${formatNumber(total.preclean.lot1OutputQuantity)} kg · คลิกจุดเพื่อกรองเดือน`}
        >
          <ResponsiveContainer>
            <LineChart data={lot1CumulativeData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} onClick={handleChartClick}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="month" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} tickFormatter={(value) => Number(value).toLocaleString("en-US")}/>
              <Tooltip formatter={(v) => `${formatNumber(Number(v))} kg`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12, cursor: "pointer" }} onClick={(e) => toggleRM(String(e.dataKey))} />
              {selectedMonthShortLabel && <ReferenceLine x={selectedMonthShortLabel} stroke="var(--color-text)" strokeDasharray="4 3" strokeOpacity={0.55} />}
              <Line type="monotone" dataKey="arabica" name="Arabica" stroke="#92400e" strokeWidth={2.2} dot={monthAwareDot("#92400e", selectedMonthKey)} />
              <Line type="monotone" dataKey="robusta" name="Robusta" stroke="#e0a339" strokeWidth={2.2} dot={monthAwareDot("#e0a339", selectedMonthKey)} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="📃 %Yield 1 Trend By Supplier" caption="คลิกแท่งเพื่อกรองเดือน หรือคลิก legend เพื่อกรอง supplier">
          {report.suppliers.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-text-muted">ไม่พบข้อมูล Batch/Supplier</div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={supplierTrendData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} onClick={handleChartClick}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="month" tick={AXIS_STYLE} />
                <YAxis tick={AXIS_STYLE} domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11, cursor: "pointer" }} onClick={(e) => toggleSupplier(String(e.dataKey))} />
                {selectedMonthShortLabel && <ReferenceLine x={selectedMonthShortLabel} stroke="var(--color-text)" strokeDasharray="4 3" strokeOpacity={0.55} />}
                <ReferenceLine y={100} stroke="var(--color-down)" strokeDasharray="2 2" strokeOpacity={0.6} />
                {report.suppliers.map((s, i) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    name={s}
                    fill={SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]}
                    fillOpacity={supplierFilter !== "all" && supplierFilter !== s ? 0.15 : 1}
                    radius={[2, 2, 0, 0]}
                    onClick={() => toggleSupplier(s)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <SummaryDashboardTable report={report} selectedMonthKey={selectedMonthKey} onSelectMonth={toggleMonth} />
    </div>
  );
}
