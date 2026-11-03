import { computeMonthly301Summary } from "./monthly301Summary";
import { latestStdPercent } from "../core/stdMaster";
import type { RawMovementRow, StdMaster } from "../core/types";

/**
 * "Settlement Rule Report" — the yearly cross-tab the accounting team keeps in
 * the source workbook's "Summary สูตร" area, opened from the 301 tab by
 * clicking the "Settlement Rule" column header.
 *
 * One block per green-coffee variety (Robusta / Arabica), listing each clean
 * output grade with:
 *  - %STD (ล่าสุด) — the latest entry in the effective-dated %STD history
 *    (sheet 301 col J's hand-entered master value; lib/stdMaster.ts).
 *  - สัดส่วนเกิดจริง — the actual settlement rule per calendar month (sheet 301
 *    col M = ROUND(qty ÷ green-input qty, 2)), sourced directly from
 *    lib/monthly301Summary.ts (ก้อน A/C decision: officially the same number,
 *    not a separately re-derived one).
 *  - Average — the plain mean of that grade's monthly settlement-rule figures
 *    over the months that had output.
 *  - %Yield / %Loss rows per group — Σ of the grade rows above them (source
 *    M sum row, not N's Σ H), and 100 − that; the Average column likewise.
 *    Grade figures are held at whole %, the precision the popup and export
 *    show, so the block always adds up on screen.
 *
 * Deliberately shows RAW numbers, not normalized to sum-to-100 per month
 * (PM+BA decision, docs/monthly-301-summary-and-std-effective-date-plan.md
 * §4.1): a month's %Yield/%Loss for Preclean is real data the cost-accounting
 * team needs to see, not something to hide by rescaling to 100. This means
 * monthly totals will NOT sum to exactly 100 (typically ~98) — different from
 * this report's first version, which normalized on purpose.
 *
 * Variety of an output row is read straight from its material code, the same
 * split lib/summaryDashboard.ts already uses (54002340 = อาราบิก้า,
 * 54002341 = โรบัสต้า; clean codes 57000000-02 = Arabica, 57000003-04 =
 * Robusta) — no order-level join needed.
 */

const ARABICA_GREEN_CODE = "54002340";
const ROBUSTA_GREEN_CODE = "54002341";
const ARABICA_CLEAN_CODES = ["57000000", "57000001", "57000002"] as const;
const ROBUSTA_CLEAN_CODES = ["57000003", "57000004"] as const;

const GREEN_FALLBACK_DESC: Record<string, string> = {
  [ARABICA_GREEN_CODE]: "สารกาแฟอาราบิก้า",
  [ROBUSTA_GREEN_CODE]: "สารกาแฟโรบัสต้า",
};

export type SettlementVariety = "robusta" | "arabica";

export interface SettlementRuleMaterialRow {
  material: string;
  materialDescription: string;
  /** Latest %STD master value for this grade, or null if none entered. */
  stdPercent: number | null;
  /** monthKey ("YYYY-MM") -> settlement rule % (0..100, raw/un-normalized);
   * null when the variety produced nothing that month. */
  monthly: Record<string, number | null>;
  /** Plain mean over months with output; null when nothing produced. */
  average: number | null;
}

export interface SettlementRuleSection {
  variety: SettlementVariety;
  varietyLabel: string;
  /** Green-coffee "สาร" input shown as the block's parent row. */
  greenCode: string;
  greenDescription: string;
  materials: SettlementRuleMaterialRow[];
  /** %Yield per month = Σ settlement rule of this section's grades (source
   * M sum row); null when the variety produced nothing that month. */
  yieldByMonth: Record<string, number | null>;
  /** %Loss per month = 100 − yield. */
  lossByMonth: Record<string, number | null>;
  /** Σ of the grades' Average figures. */
  yieldAverage: number | null;
  lossAverage: number | null;
}

export interface SettlementRuleReport {
  /** "YYYY-MM" keys — a full Jan–Dec run for every year present in 301 data. */
  months: string[];
  /** Distinct years covered, ascending (usually one). */
  years: string[];
  sections: SettlementRuleSection[];
}

const SECTION_CONFIG = [
  { variety: "robusta" as const, greenCode: ROBUSTA_GREEN_CODE, varietyLabel: "Robusta", cleanCodes: ROBUSTA_CLEAN_CODES },
  { variety: "arabica" as const, greenCode: ARABICA_GREEN_CODE, varietyLabel: "Arabica", cleanCodes: ARABICA_CLEAN_CODES },
];

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? present.reduce((s, v) => s + v, 0) : null;
}

export function computeSettlementRuleReport(rows: RawMovementRow[], stdMaster: StdMaster): SettlementRuleReport {
  const rows301 = rows.filter((r) => r.order?.startsWith("301"));
  const monthly = computeMonthly301Summary(rows301, stdMaster);
  const monthlyByKey = new Map(monthly.months.map((m) => [m.monthKey, m]));

  const years = Array.from(new Set(rows301.map((r) => r.postingDate.slice(0, 4)))).sort();
  const months = years.flatMap((y) => Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`));

  const descByMaterial = new Map<string, string>();
  for (const r of rows301) {
    if (r.materialDescription && !descByMaterial.has(r.material)) descByMaterial.set(r.material, r.materialDescription);
  }

  const sections: SettlementRuleSection[] = SECTION_CONFIG.map((cfg) => {
    const cleanCodes = cfg.cleanCodes as readonly string[];

    const materials: SettlementRuleMaterialRow[] = cleanCodes.map((code) => {
      const monthlyVals: Record<string, number | null> = {};
      for (const mk of months) {
        const section = monthlyByKey.get(mk)?.sections.find((s) => s.variety === cfg.variety);
        const line = section?.lines.find((l) => l.material === code);
        // Already whole % (M = ROUND(H, 2)); Math.round only strips float noise.
        monthlyVals[mk] = line?.settlementRule != null ? Math.round(line.settlementRule * 100) : null;
      }
      const active = months.map((mk) => monthlyVals[mk]).filter((v): v is number => v !== null);
      const avg = average(active);
      return {
        material: code,
        materialDescription: descByMaterial.get(code) ?? code,
        stdPercent: latestStdPercent(stdMaster, code),
        monthly: monthlyVals,
        average: avg !== null ? Math.round(avg) : null,
      };
    });

    // Summed from the grade rows rather than taken from the section's Σ H
    // yield: each grade is rounded to a whole % on its own, so Σ H drifts ±1
    // from the rows above it (e.g. 97 + 2 shown over a %Yield of 100).
    // Months the variety produced nothing stay blank (section.yield gate).
    const yieldByMonth: Record<string, number | null> = {};
    const lossByMonth: Record<string, number | null> = {};
    for (const mk of months) {
      const section = monthlyByKey.get(mk)?.sections.find((s) => s.variety === cfg.variety);
      const y = section?.yield != null ? sumOrNull(materials.map((m) => m.monthly[mk])) : null;
      yieldByMonth[mk] = y;
      lossByMonth[mk] = y !== null ? 100 - y : null;
    }
    const yieldAverage = sumOrNull(materials.map((m) => m.average));

    return {
      variety: cfg.variety,
      varietyLabel: cfg.varietyLabel,
      greenCode: cfg.greenCode,
      greenDescription: descByMaterial.get(cfg.greenCode) ?? GREEN_FALLBACK_DESC[cfg.greenCode] ?? cfg.greenCode,
      materials,
      yieldByMonth,
      lossByMonth,
      yieldAverage,
      lossAverage: yieldAverage !== null ? 100 - yieldAverage : null,
    };
  });

  return { months, years, sections };
}
