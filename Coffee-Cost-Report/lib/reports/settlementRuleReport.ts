import { computeMonthly301Summary } from "./monthly301Summary";
import { roundPartsKeepingTotal } from "../core/percentRounding";
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
 *  - สัดส่วนเกิดจริง — each grade's share of the variety's total clean output
 *    per calendar month (qty ÷ Σ clean output qty ≡ M ÷ ΣM of sheet 301), so
 *    a month's grades add up to 100. Quantities come from
 *    lib/monthly301Summary.ts.
 *  - Average — the plain mean of that grade's monthly figures over the months
 *    the variety had output.
 *  - A total row per group (no label, like the source) — Σ of the grade rows
 *    above it, monthly and Average: 100 for every month with output.
 *
 * Normalized to 100 per month at the user's request (2026-11-03), matching
 * the accounting team's own report — this reverses the 2026-08-31 PM+BA
 * decision to show raw ROUND(qty ÷ green-input, 2) figures with %Yield/%Loss
 * rows (docs/monthly-301-summary-and-std-effective-date-plan.md §4.1).
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
  /** monthKey ("YYYY-MM") -> whole % share of the variety's clean output;
   * null when the variety produced nothing that month. */
  monthly: Record<string, number | null>;
  /** Plain mean over months with output, whole %; null when nothing produced. */
  average: number | null;
}

export interface SettlementRuleSection {
  variety: SettlementVariety;
  varietyLabel: string;
  /** Green-coffee "สาร" input shown as the block's parent row. */
  greenCode: string;
  greenDescription: string;
  materials: SettlementRuleMaterialRow[];
  /** Σ of the grade rows per month (100 with output); null when the variety
   * produced nothing that month. */
  totalByMonth: Record<string, number | null>;
  /** Σ of the grades' Average figures. */
  totalAverage: number | null;
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

/**
 * 0..1 shares -> whole % that still add up to 100. Rounding each grade on its
 * own would let the total row read 99 or 101 under grades the user is adding
 * up, so the report is rounded here, at whole % (what the popup and export
 * show), and the total row is summed from these figures.
 */
function toWholePercents(shares: (number | null)[]): (number | null)[] {
  return roundPartsKeepingTotal(shares, 100).map((v) => (v === null ? null : Math.round(v * 100)));
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

    const monthlyByCode = cleanCodes.map(() => ({}) as Record<string, number | null>);
    for (const mk of months) {
      const section = monthlyByKey.get(mk)?.sections.find((s) => s.variety === cfg.variety);
      const qty = cleanCodes.map((code) => section?.lines.find((l) => l.material === code)?.quantity ?? 0);
      const outputTotal = qty.reduce((s, q) => s + q, 0);
      const shares = toWholePercents(qty.map((q) => (outputTotal > 0 ? q / outputTotal : null)));
      shares.forEach((v, i) => (monthlyByCode[i][mk] = v));
    }

    // Each month's grades add up to exactly 100, so these means do too before
    // rounding — rounding them the same way keeps the Average total at 100.
    const averages = toWholePercents(
      monthlyByCode.map((vals) => {
        const avg = average(months.map((mk) => vals[mk]).filter((v): v is number => v !== null));
        return avg !== null ? avg / 100 : null;
      }),
    );

    const materials: SettlementRuleMaterialRow[] = cleanCodes.map((code, i) => ({
      material: code,
      materialDescription: descByMaterial.get(code) ?? code,
      stdPercent: latestStdPercent(stdMaster, code),
      monthly: monthlyByCode[i],
      average: averages[i],
    }));

    const totalByMonth: Record<string, number | null> = {};
    for (const mk of months) totalByMonth[mk] = sumOrNull(materials.map((m) => m.monthly[mk]));

    return {
      variety: cfg.variety,
      varietyLabel: cfg.varietyLabel,
      greenCode: cfg.greenCode,
      greenDescription: descByMaterial.get(cfg.greenCode) ?? GREEN_FALLBACK_DESC[cfg.greenCode] ?? cfg.greenCode,
      materials,
      totalByMonth,
      totalAverage: sumOrNull(materials.map((m) => m.average)),
    };
  });

  return { months, years, sections };
}
