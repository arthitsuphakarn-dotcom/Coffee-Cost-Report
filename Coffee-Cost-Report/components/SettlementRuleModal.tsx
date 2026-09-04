"use client";

import { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel, faXmark } from "@fortawesome/free-solid-svg-icons";
import { formatNumber } from "@/lib/format";
import type { SettlementRuleReport } from "@/lib/settlementRuleReport";
import { td, tdNum, th } from "./reportTableStyles";

const THAI_MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function monthHeader(monthKey: string, multiYear: boolean): string {
  const [year, month] = monthKey.split("-");
  const abbr = THAI_MONTH_ABBR[Number(month) - 1] ?? monthKey;
  return multiYear ? `${abbr} ${year.slice(2)}` : abbr;
}

function pct(n: number | null): string {
  return n === null || Number.isNaN(n) ? "" : formatNumber(n, 0);
}

export default function SettlementRuleModal({
  open,
  onClose,
  report,
}: {
  open: boolean;
  onClose: () => void;
  report: SettlementRuleReport | null;
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

  const multiYear = (report?.years.length ?? 0) > 1;
  const hasData = report !== null && report.sections.some((s) => s.materials.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settlement Rule Report"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[80vw] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-base font-bold text-text">Settlement Rule Report</h2>
          <div className="flex items-center gap-2">
            <a
              href="/api/export-settlement-rule"
              className="inline-flex items-center gap-1 rounded-full bg-green-700 px-4 py-1 text-sm font-medium text-white hover:bg-green-800"
            >
              <FontAwesomeIcon icon={faFileExcel} />
              Export
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="rounded-full px-2 py-1 text-text-muted hover:bg-surface-2 hover:text-text cursor-pointer"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </header>

        <div className="overflow-auto px-5 py-4">
          {!hasData ? (
            <p className="py-10 text-center text-sm text-text-muted">ไม่พบข้อมูล Order 301 สำหรับสร้างรายงาน</p>
          ) : (
            <div className="space-y-8">
              {report!.sections.map((section) => (
                <div key={section.variety} className="overflow-x-auto rounded-lg border border-zinc-300">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className={`${th} !bg-blue-300`}>Code</th>
                        <th className={`${th} !bg-blue-300`}>{section.varietyLabel}</th>
                        <th className={`${th} !bg-blue-300 text-right`}>
                          %STD (ล่าสุด)
                        </th>
                        {report!.months.map((mk) => (
                          <th key={mk} className={`${th} !bg-blue-300 text-right`}>
                            {monthHeader(mk, multiYear)}
                          </th>
                        ))}
                        <th className={`${th} !bg-zinc-200 text-right`}>Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-blue-50 font-bold">
                        <td className={`${td} font-mono`}>{section.greenCode}</td>
                        <td className={td}>{section.greenDescription}</td>
                        <td className={tdNum}></td>
                        {report!.months.map((mk) => (
                          <td key={mk} className={tdNum}></td>
                        ))}
                        <td className={`${tdNum} !bg-zinc-100`}></td>
                      </tr>

                      {section.materials.map((m) => (
                        <tr key={m.material} className="hover:bg-zinc-50/60">
                          <td className={`${td} font-mono`}>{m.material}</td>
                          <td className={td}>{m.materialDescription}</td>
                          <td className={tdNum}>{m.stdPercent === null ? "" : formatNumber(m.stdPercent, 0)}</td>
                          {report!.months.map((mk) => (
                            <td key={mk} className={tdNum}>
                              {pct(m.monthly[mk] ?? null)}
                            </td>
                          ))}
                          <td className={`${tdNum} !bg-zinc-100 font-semibold`}>{pct(m.average)}</td>
                        </tr>
                      ))}

                      <tr className="border-t-2 border-t-zinc-400 bg-zinc-100 font-bold">
                        <td className={td} colSpan={2}>
                          % Yield
                        </td>
                        <td className={tdNum}></td>
                        {report!.months.map((mk) => (
                          <td key={mk} className={tdNum}>
                            {pct(section.yieldByMonth[mk] ?? null)}
                          </td>
                        ))}
                        <td className={`${tdNum} !bg-zinc-200`}>{pct(section.yieldAverage)}</td>
                      </tr>
                      <tr className="bg-zinc-100 font-bold">
                        <td className={td} colSpan={2}>
                          % Loss
                        </td>
                        <td className={tdNum}></td>
                        {report!.months.map((mk) => (
                          <td key={mk} className={tdNum}>
                            {pct(section.lossByMonth[mk] ?? null)}
                          </td>
                        ))}
                        <td className={`${tdNum} !bg-zinc-200`}>{pct(section.lossAverage)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              <div className="space-y-0.5 text-[0.7rem] text-text-muted">
                <p>
                  <span className="font-semibold">%STD (ล่าสุด)</span> Sheet &gt; 301 &gt; Summary สูตร &gt; %STD ช่อง J — ค่าล่าสุดที่มีการเปลี่ยนแปลง
                </p>
                <p>
                  <span className="font-semibold">สัดส่วนเกิดจริง</span> Sheet &gt; 301 &gt; Summary สูตร &gt; Settlement Rule ช่อง M —
                  ตัวเลขจริง ไม่ปรับให้รวม = 100
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
