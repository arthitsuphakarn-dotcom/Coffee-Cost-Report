"use client";

import { useRef } from "react";
import { formatMonthLabel } from "@/lib/dates";

/**
 * Month-range picker: a chip button (styled like the reference dashboard
 * screenshot's date-range control) that opens a small panel with quick
 * presets plus explicit "from"/"to" selects. Built on <details>/<summary>
 * rather than a JS-managed popover — free open/close + keyboard support,
 * no click-outside wiring needed.
 */
export default function MonthRangeFilter({
  availableMonths,
  from,
  to,
  onChange,
}: {
  availableMonths: string[];
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const first = availableMonths[0];
  const last = availableMonths[availableMonths.length - 1];
  const isFullRange = from === first && to === last;

  function applyPreset(months: number) {
    const toIdx = availableMonths.length - 1;
    const fromIdx = Math.max(0, toIdx - (months - 1));
    onChange(availableMonths[fromIdx], availableMonths[toIdx]);
  }

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  const label = isFullRange
    ? `ทุกเดือน (${formatMonthLabel(first)} – ${formatMonthLabel(last)})`
    : from === to
      ? formatMonthLabel(from)
      : `${formatMonthLabel(from)} – ${formatMonthLabel(to)}`;

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="shadow-card flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-text hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <span className="text-text-muted transition-transform group-open:rotate-180">▾</span>
      </summary>

      <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-border bg-surface p-3 shadow-lg">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              onChange(first, last);
              close();
            }}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              isFullRange ? "border-up bg-up/10 text-up" : "border-border text-text-muted hover:bg-surface-2"
            }`}
          >
            ทั้งหมด
          </button>
          {[3, 6].map((n) => (
            <button
              key={n}
              type="button"
              disabled={availableMonths.length < 1}
              onClick={() => {
                applyPreset(n);
                close();
              }}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-text-muted hover:bg-surface-2"
            >
              {n} เดือนล่าสุด
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              applyPreset(1);
              close();
            }}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-text-muted hover:bg-surface-2"
          >
            เดือนล่าสุด
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
          <label className="text-[11px] text-text-muted">
            จากเดือน
            <select
              value={from}
              onChange={(e) => onChange(e.target.value, e.target.value > to ? e.target.value : to)}
              className="mt-1 w-full rounded border border-border bg-surface px-1.5 py-1 text-xs text-text"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-text-muted">
            ถึงเดือน
            <select
              value={to}
              onChange={(e) => onChange(e.target.value < from ? e.target.value : from, e.target.value)}
              className="mt-1 w-full rounded border border-border bg-surface px-1.5 py-1 text-xs text-text"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </details>
  );
}
