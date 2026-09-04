"use client";

import { useMemo, useRef, useState } from "react";
import { computeOrderReport } from "@/lib/pivotOrderReport";
import { computeOrder302Report } from "@/lib/pivot302";
import { computeOrder303Report } from "@/lib/pivot303";
import { computeOrder305Report } from "@/lib/pivot305";
import { computeSettlementRuleReport } from "@/lib/settlementRuleReport";
import { computeMonthly301Summary } from "@/lib/monthly301Summary";
import { formatMonthLabel, monthKeyOf } from "@/lib/dates";
import { STAGE_LABELS, STAGE_PREFIXES } from "@/lib/types";
import type { StagePrefix, StdMaster, UnitWeightMaster, UploadBatch } from "@/lib/types";
import Stage301Table from "./Stage301Table";
import Stage302Table from "./Stage302Table";
import Stage303Table from "./Stage303Table";
import Stage305Table from "./Stage305Table";
import DashboardOverview from "./DashboardOverview";
import MonthRangeFilter from "./MonthRangeFilter";
import SettlementRuleModal from "./SettlementRuleModal";
import StdManagerModal from "./StdManagerModal";
import Monthly301SummaryView from "./Monthly301SummaryView";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";

export default function ReportView({
  initialBatch,
  initialStdMaster,
  initialUnitWeightMaster,
}: {
  initialBatch: UploadBatch | null;
  initialStdMaster: StdMaster;
  initialUnitWeightMaster: UnitWeightMaster;
}) {
  const batch = initialBatch;
  const [stdMaster, setStdMaster] = useState(initialStdMaster);
  const [unitWeightMaster, setUnitWeightMaster] = useState(initialUnitWeightMaster);
  const [activeStage, setActiveStage] = useState<StagePrefix>("301");
  const [showDashboard, setShowDashboard] = useState(false);
  const [settlementRuleOpen, setSettlementRuleOpen] = useState(false);
  const [stdManagerOpen, setStdManagerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // const fileInputRef = useRef<HTMLInputElement>(null);
  const unitWeightSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const availableMonths = useMemo(() => {
    if (!batch) return [];
    const keys = new Set(batch.rows.map((r) => monthKeyOf(r.postingDate)));
    return Array.from(keys).sort();
  }, [batch]);

  const [monthFrom, setMonthFrom] = useState<string>(() => availableMonths[0] ?? "");
  const [monthTo, setMonthTo] = useState<string>(() => availableMonths[availableMonths.length - 1] ?? "");

  const filteredRows = useMemo(() => {
    if (!batch) return [];
    if (!monthFrom || !monthTo) return batch.rows;
    return batch.rows.filter((r) => {
      const mk = monthKeyOf(r.postingDate);
      return mk >= monthFrom && mk <= monthTo;
    });
  }, [batch, monthFrom, monthTo]);

  const report301 = useMemo(() => (batch ? computeOrderReport("301", filteredRows, stdMaster) : null), [batch, filteredRows, stdMaster]);
  const report302 = useMemo(() => (batch ? computeOrder302Report(filteredRows) : null), [batch, filteredRows]);
  const report303 = useMemo(
    () => (batch ? computeOrder303Report(filteredRows, unitWeightMaster) : null),
    [batch, filteredRows, unitWeightMaster]
  );
  const report305 = useMemo(
    () => (batch ? computeOrder305Report(filteredRows, unitWeightMaster) : null),
    [batch, filteredRows, unitWeightMaster]
  );
  // Yearly cross-tab — deliberately built from the full upload, not the
  // month-range-filtered rows (see lib/settlementRuleReport.ts).
  const settlementRuleReport = useMemo(
    () => (batch ? computeSettlementRuleReport(batch.rows, stdMaster) : null),
    [batch, stdMaster]
  );
  // Follows the top month-range filter (uses filteredRows), so the monthly
  // summary above the 301 order table always matches what's filtered.
  const monthly301Summary = useMemo(
    // 3rd arg = full upload for description lookup, so a grade with no
    // movement in the filtered range still shows its real name, not the code.
    () => (batch ? computeMonthly301Summary(filteredRows, stdMaster, batch.rows) : null),
    [batch, filteredRows, stdMaster]
  );
  const dashboardDateRangeLabel = useMemo(() => {
    if (!monthFrom || !monthTo) return "";
    const first = formatMonthLabel(monthFrom);
    const last = formatMonthLabel(monthTo);
    return first === last ? first : `${first} – ${last}`;
  }, [monthFrom, monthTo]);

  const groupCounts: Record<StagePrefix, number> = {
    "301": report301?.groups.length ?? 0,
    "302": report302?.groups.length ?? 0,
    "303": report303?.groups.length ?? 0,
    "305": report305?.groups.length ?? 0,
  };
  const hasAnyData = batch !== null;

  // async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
  //   e.preventDefault();
  //   const file = fileInputRef.current?.files?.[0];
  //   if (!file) return;

  //   setUploading(true);
  //   setUploadError(null);
  //   try {
  //     const formData = new FormData();
  //     formData.append("file", file);
  //     const res = await fetch("/api/upload", { method: "POST", body: formData });
  //     const data = await res.json();
  //     if (!res.ok) {
  //       setUploadError(data.error ?? "อัปโหลดไม่สำเร็จ");
  //       return;
  //     }
  //     // Full reload so the server component re-reads the new upload from disk
  //     // and this component gets the raw rows again (needed for client-side recompute).
  //     window.location.reload();
  //   } catch {
  //     setUploadError("เกิดข้อผิดพลาดระหว่างอัปโหลด");
  //   } finally {
  //     setUploading(false);
  //   }
  // }

  function handleStdEntryAdd(material: string, from: string, value: number) {
    setStdMaster((prev) => {
      const existing = prev[material] ?? [];
      const withoutSameMonth = existing.filter((e) => e.from !== from);
      return { ...prev, [material]: [...withoutSameMonth, { from, value }].sort((a, b) => a.from.localeCompare(b.from)) };
    });

    fetch("/api/std", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ material, from, value }),
    }).catch(() => {});
  }

  function handleStdEntryDelete(material: string, from: string) {
    setStdMaster((prev) => ({ ...prev, [material]: (prev[material] ?? []).filter((e) => e.from !== from) }));

    fetch("/api/std", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ material, from }),
    }).catch(() => {});
  }

  function handleUnitWeightChange(material: string, value: string) {
    const parsed = value === "" ? null : Number(value);
    if (parsed === null || Number.isNaN(parsed)) return;

    setUnitWeightMaster((prev) => ({ ...prev, [material]: parsed }));

    if (unitWeightSaveTimers.current[material]) clearTimeout(unitWeightSaveTimers.current[material]);
    unitWeightSaveTimers.current[material] = setTimeout(() => {
      fetch("/api/unit-weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material, grams: parsed }),
      }).catch(() => {});
    }, 500);
  }

  function toggleCollapsed(order: string) {
    const key = `${activeStage}:${order}`;
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const activeOrders =
    activeStage === "301" ? report301?.groups : activeStage === "302" ? report302?.groups : activeStage === "303" ? report303?.groups : report305?.groups;

  function expandAll() {
    if (!activeOrders) return;
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const g of activeOrders) next[`${activeStage}:${g.order}`] = false;
      return next;
    });
  }

  function collapseAll() {
    if (!activeOrders) return;
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const g of activeOrders) next[`${activeStage}:${g.order}`] = true;
      return next;
    });
  }

  return (
    <div className="flex-1 mx-auto w-full max-w-[1400px] px-6 py-10 bg-zinc-100">
      {/* <header className="mb-6">
        <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-widest text-text-muted">
          โรงงานกาแฟ · ห้องคั่ว + Packing
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-text">Coffee Roasting Performance Monitoring &amp; Cost Report</h1>
        <p className="mt-1 text-sm text-text-muted">สำหรับบัญชีต้นทุนสินค้า</p>
      </header> */}

      <section className="mb-6 pl-0 pr-3 px-5">
        {/* <h2 className="mb-3 text-sm font-semibold text-text">อัปโหลดข้อมูล MB51</h2> */}
        {/* <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            required
            className="text-sm text-text file:mr-3 file:rounded file:border-0 file:bg-roasting file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-roasting-line"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded bg-roasting px-4 py-1.5 text-sm font-medium text-white hover:bg-roasting-line disabled:opacity-50"
          >
            {uploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
          </button>
          {batch && (
            <span className="text-xs text-text-muted">
              ไฟล์ล่าสุด: <span className="font-medium text-text">{batch.fileName}</span> ·{" "}
              {new Date(batch.uploadedAt).toLocaleString("th-TH")} · {batch.rows.length.toLocaleString("th-TH")} แถว
            </span>
          )}
        </form> */}
        {uploadError && <p className="mt-2 text-sm text-down">{uploadError}</p>}
        {/* <p className="mt-2 text-xs text-text-muted">
          ต้องมี sheet ที่ชื่อขึ้นต้นด้วย &quot;MB51&quot; (เช่น &quot;MB51 328&quot;, &quot;MB51 M. 1-7&quot;) พร้อมคอลัมน์ Material,
          Material description, Order, EUn, Quantity in UnE, Amt.in Loc.Cur., Pstng Date
        </p> */}

        {batch && availableMonths.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 ">
            {/* mt-4 border-t border-border pt-3 */}
            {/* <span className="text-xs text-text-muted">
              ข้อมูลครอบคลุมเดือน:{" "}
              <span className="font-medium text-text">{availableMonths.map(formatMonthLabel).join(", ")}</span>
            </span> */}
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Coffee Roasting Performance Monitoring &amp; Cost Report
            </h1>
            {availableMonths.length > 1 && (
              <MonthRangeFilter availableMonths={availableMonths} from={monthFrom} to={monthTo} onChange={(f, t) => { setMonthFrom(f); setMonthTo(t); }} />
            )}
          </div>
        )}
      </section>

      {!hasAnyData && (
        <section className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          ยังไม่มีข้อมูล — อัปโหลดไฟล์ MB51 ด้านบนเพื่อเริ่มดูรายงาน
        </section>
      )}

      {hasAnyData && (
        <>
          <div className="pl-1 mb-4 overflow-x-auto border-b border-border overflow-y-hidden">
            <div className="flex min-w-max gap-3">
              <button
                onClick={() => setShowDashboard(true)}
                className={`relative -mb-px rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
                  showDashboard
                    ? "border-border bg-taupe-500 text-text text-white"
                    : "border-transparent bg-surface-2 text-text-muted hover:bg-border/40 cursor-pointer hover:shadow-sm"
                }`}
              >
                Dashboard Summary
              </button>
              {STAGE_PREFIXES.map((stage) => {
                const isActive = !showDashboard && stage === activeStage;
                // const isPlaceholder = stage === "305";
                // const isPartial = stage === "303";
                return (
                  <button
                    key={stage}
                    onClick={() => {
                      setShowDashboard(false);
                      setActiveStage(stage);
                    }}
                    className={`relative -mb-px rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
                      isActive
                        ? "border-border bg-taupe-500 text-text text-white"
                        : "border-transparent bg-surface-2 text-text-muted hover:bg-border/40 cursor-pointer hover:shadow-sm"
                    }`}
                  >
                    {STAGE_LABELS[stage]}
                    <span
                      className={`ml-2 text-xs ${
                        isActive ? "text-white" : "text-text-muted"
                      }`}
                    >
                      ({groupCounts[stage]} รายการ)
                    </span>
                    {/* {isPlaceholder && (
                      <span
                        title="ใช้สูตรเดียวกับ 301 ชั่วคราว รอยืนยันสูตรจริงหน้างาน"
                        className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-800"
                      >
                        รอสูตรจริง
                      </span>
                    )}
                    {isPartial && (
                      <span
                        title="สูตร Yield/Loss เป็นของจริง แต่ยังไม่รวม log ของเสียรายวัน (รอสอบถามหน้างาน)"
                        className="ml-1.5 rounded bg-packing-soft px-1 py-0.5 text-[10px] font-semibold text-packing-line"
                      >
                        ไม่รวม log รายวัน
                      </span>
                    )} */}
                  </button>
                );
              })}
            </div>
          </div>

          {showDashboard ? (
            <DashboardOverview rows={filteredRows} dateRangeLabel={dashboardDateRangeLabel} />
          ) : (
            <>
              {/* {activeStage === "305" && (
                <div className="mb-4 rounded-lg border border-violet-300 bg-violet-50 p-3 text-xs text-violet-800">
                  คอลัมน์ ราคาต่อหน่วย/Yield/Loss คำนวณจากสูตรจริงของ sheet 305 แล้ว (ต้องกรอกน้ำหนัก/หน่วย (กรัม) ของวัตถุดิบ
                  input และ output ก่อน Yield/Loss ถึงจะคำนวณได้ เพราะขนาดถุงก่อน/หลังไม่เท่ากันเสมอไป) — ยังไม่รวมคอลัมน์
                  บันทึกของเสียรายวัน (QA เบิก, โรบอทตีแตก, ฟิล์มยับ ฯลฯ) ซึ่งต้องสอบถามหน้างานก่อน เหมือนกับ 303
                </div>
              )} */}
              {/* {activeStage === "303" && (
                <div className="mb-4 rounded-lg border border-packing bg-packing-soft p-3 text-xs text-packing-line">
                  คอลัมน์ ราคาต่อหน่วย/Yield/Loss คำนวณจากสูตรจริงของ sheet 303 แล้ว (ต้องกรอกน้ำหนัก/หน่วย (กรัม) ต่อวัตถุดิบ
                  output ก่อน Yield/Loss ถึงจะคำนวณได้) — ยังไม่รวมคอลัมน์บันทึกของเสียรายวัน (QA เบิก, โรบอทตีแตก, ฟิล์มยับ
                  ฯลฯ) ซึ่งต้องสอบถามหน้างานก่อน
                </div>
              )} */}

              {activeStage === "301" && (
                <Monthly301SummaryView summary={monthly301Summary} from={monthFrom} to={monthTo} />
              )}

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="rounded-full border border-border bg-surface px-4 py-.5 text-xs font-medium text-text hover:bg-surface-2 cursor-pointer"
                  >
                    ขยายทั้งหมด
                  </button>
                  <button
                    onClick={collapseAll}
                    className="rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-text hover:bg-surface-2 cursor-pointer"
                  >
                    ยุบทั้งหมด
                  </button>
                </div>
                <a
                  href={`/api/export?stage=${activeStage}&from=${monthFrom}&to=${monthTo}`}
                  className="inline-flex items-center gap-1 rounded-full bg-green-700 px-4 py-1 text-sm font-medium text-white hover:bg-green-800"
                >
                  <FontAwesomeIcon icon={faFileExcel} />
                  Export
                </a>
              </div>

              {groupCounts[activeStage] === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
                  ไม่พบ Order ที่ขึ้นต้นด้วย {activeStage} ในไฟล์ที่อัปโหลด
                </div>
              ) : activeStage === "301" && report301 ? (
                <Stage301Table
                  stage="301"
                  report={report301}
                  collapsed={collapsed}
                  onToggleCollapsed={toggleCollapsed}
                  onOpenSettlementRule={() => setSettlementRuleOpen(true)}
                  onOpenStdManager={() => setStdManagerOpen(true)}
                />
              ) : activeStage === "302" && report302 ? (
                <Stage302Table report={report302} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
              ) : activeStage === "303" && report303 ? (
                <Stage303Table report={report303} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} onUnitWeightChange={handleUnitWeightChange} />
              ) : activeStage === "305" && report305 ? (
                <Stage305Table report={report305} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} onUnitWeightChange={handleUnitWeightChange} />
              ) : null}
            </>
          )}
        </>
      )}

      <SettlementRuleModal
        open={settlementRuleOpen}
        onClose={() => setSettlementRuleOpen(false)}
        report={settlementRuleReport}
      />

      <StdManagerModal
        open={stdManagerOpen}
        onClose={() => setStdManagerOpen(false)}
        stdMaster={stdMaster}
        sections={settlementRuleReport?.sections ?? null}
        availableMonths={availableMonths}
        onAddEntry={handleStdEntryAdd}
        onDeleteEntry={handleStdEntryDelete}
      />
    </div>
  );
}
