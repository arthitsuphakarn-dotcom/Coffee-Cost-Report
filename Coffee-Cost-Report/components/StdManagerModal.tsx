"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { sortedStdEntries, stdPercentAsOf } from "@/lib/stdMaster";
import type { StdMaster } from "@/lib/types";
import type { SettlementRuleSection } from "@/lib/settlementRuleReport";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** Pre-effective-dating data migrates to this sentinel `from` (see
 * lib/store.ts) — shown as "ค่าเดิม" rather than a fake "ม.ค. 0000". */
const LEGACY_SENTINEL_FROM = "0000-01";

function thMonth(monthKey: string): string {
  if (monthKey === LEGACY_SENTINEL_FROM) return "ค่าเดิม (ก่อนระบบเริ่มเก็บประวัติ)";
  const [y, m] = monthKey.split("-");
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return monthKey;
  return `${THAI_MONTHS[idx]} ${y}`;
}

function MaterialRow({
  material,
  materialDescription,
  stdMaster,
  currentMonth,
  availableMonths,
  onAddEntry,
  onDeleteEntry,
}: {
  material: string;
  materialDescription: string;
  stdMaster: StdMaster;
  currentMonth: string;
  availableMonths: string[];
  onAddEntry: (material: string, from: string, value: number) => void;
  onDeleteEntry: (material: string, from: string) => void;
}) {
  const entries = sortedStdEntries(stdMaster, material);
  const currentValue = stdPercentAsOf(stdMaster, material, currentMonth);
  const [newFrom, setNewFrom] = useState(currentMonth);
  const [newValue, setNewValue] = useState("");

  function submitAdd() {
    const value = Number(newValue);
    if (!newFrom || newValue === "" || Number.isNaN(value) || value < 0 || value > 100) return;
    onAddEntry(material, newFrom, value);
    setNewValue("");
  }

  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <div className="text-xs">
          <span className="font-mono font-semibold">{material}</span>{" "}
          <span className="text-text-muted">{materialDescription}</span>
        </div>
        <div className="text-xs text-text-muted whitespace-nowrap">
          ค่าที่ใช้เดือน {thMonth(currentMonth)}: <span className="font-semibold text-text">{currentValue === null ? "-" : `${currentValue}%`}</span>
        </div>
      </div>

      <div className="space-y-1">
        {entries.length === 0 && <div className="text-xs text-text-muted">ยังไม่มีค่า %STD</div>}
        {entries.map((e) => (
          <div key={e.from} className="flex items-center justify-between gap-2 text-xs">
            <span>
              ตั้งแต่ <span className="font-mono">{thMonth(e.from)}</span> = <span className="font-semibold">{e.value}%</span>
            </span>
            <button
              type="button"
              onClick={() => onDeleteEntry(material, e.from)}
              title="ลบ"
              className="text-text-muted hover:text-down cursor-pointer"
            >
              <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2 text-xs">
        <span className="text-text-muted">+ เพิ่ม:</span>
        <select
          value={newFrom}
          onChange={(e) => setNewFrom(e.target.value)}
          className="rounded border border-border bg-transparent px-1 py-0.5 font-mono text-xs"
        >
          {availableMonths.map((mk) => (
            <option key={mk} value={mk}>
              {thMonth(mk)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="ค่า %"
          className="w-16 rounded border border-border bg-transparent px-1 py-0.5 text-right font-mono text-xs"
        />
        <button
          type="button"
          onClick={submitAdd}
          className="rounded bg-roasting px-2 py-0.5 text-xs font-medium text-white hover:bg-roasting-line cursor-pointer"
        >
          เพิ่ม
        </button>
      </div>
    </div>
  );
}

export default function StdManagerModal({
  open,
  onClose,
  stdMaster,
  sections,
  availableMonths,
  onAddEntry,
  onDeleteEntry,
}: {
  open: boolean;
  onClose: () => void;
  stdMaster: StdMaster;
  /** Reuses Settlement Rule Report's already-computed variety/material list. */
  sections: SettlementRuleSection[] | null;
  availableMonths: string[];
  onAddEntry: (material: string, from: string, value: number) => void;
  onDeleteEntry: (material: string, from: string) => void;
}) {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
  };
  }, [open, onClose]);

  if (!open) return null;

  const currentMonth = availableMonths[availableMonths.length - 1] ?? "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="จัดการ %STD"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-text">จัดการ %STD</h2>
            <p className="text-[0.7rem] text-text-muted">
              มาตรฐานจาก SAP T-Code MM03 — ค่ามีผล &quot;ตั้งแต่เดือนที่กรอกเป็นต้นไป&quot; ไม่กระทบเดือนก่อนหน้า
              (กระทบเฉพาะ ปันใหม่ตาม STD / ราคาหลังปัน — ไม่กระทบ Settlement Rule)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-full px-2 py-1 text-text-muted hover:bg-surface-2 hover:text-text cursor-pointer"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>

        <div className="overflow-auto px-5 py-4">
          {!sections || sections.every((s) => s.materials.length === 0) ? (
            <p className="py-10 text-center text-sm text-text-muted">ไม่พบข้อมูล Order 301 สำหรับจัดการ %STD</p>
          ) : (
            <div className="space-y-5">
              {sections.map((section) => (
                <div key={section.variety} className="space-y-2">
                  <div className="text-xs font-bold text-text">{section.varietyLabel}</div>
                  {section.materials.map((m) => (
                    <MaterialRow
                      key={m.material}
                      material={m.material}
                      materialDescription={m.materialDescription}
                      stdMaster={stdMaster}
                      currentMonth={currentMonth}
                      availableMonths={availableMonths}
                      onAddEntry={onAddEntry}
                      onDeleteEntry={onDeleteEntry}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
