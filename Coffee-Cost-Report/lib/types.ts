export interface RawMovementRow {
  material: string;
  materialDescription: string;
  order: string;
  eun: string;
  quantity: number;
  amount: number;
  /** From MB51's "Pstng Date" column, as "YYYY-MM-DD". */
  postingDate: string;
  /** MB51's "SLoc" (storage location) — needed by the Summary Dashboard's
   * material-movement classification (see lib/summaryDashboard.ts). */
  sLoc: string;
  /** MB51's "MvT" (movement type), e.g. "261" (goods issue), "101" (goods
   * receipt) — same use as sLoc. */
  mvt: string;
  /** MB51's "Batch" column, e.g. "130825-TTW". Only used to derive the
   * supplier code (see lib/summaryDashboard.ts's extractSupplier) for the
   * Summary Dashboard's by-supplier chart — optional column, defaults to
   * "" if the sheet doesn't have it. */
  batch: string;
}

export interface UploadBatch {
  fileName: string;
  uploadedAt: string;
  rows: RawMovementRow[];
}

/** One %STD value effective from a given month onward (see lib/stdMaster.ts). */
export interface StdEntry {
  /** "YYYY-MM" — the value applies from this month onward, until superseded
   * by a later entry for the same material. */
  from: string;
  value: number;
}
/** History per material, not a single scalar — %STD can change over time
 * (e.g. a new crop standard), and past months must keep using the value that
 * was in effect back then. Resolve with lib/stdMaster.ts's stdPercentAsOf. */
export type StdMaster = Record<string, StdEntry[]>;
/** Grams per unit (e.g. per bag) for a 303/305 output material — needed to
 * convert bag counts into kg for yield. Not in MB51; editable master data,
 * same pattern as StdMaster. */
export type UnitWeightMaster = Record<string, number>;

/**
 * The 4 production-order prefixes from the reference workbook. All 4 now use
 * their own real, verified formulas (see docs/source-analysis.md and
 * lib/pivotOrderReport.ts / pivot302.ts / pivot303.ts / pivot305.ts). 303 and
 * 305 both still have a manual defect-tracking log in the source sheet that
 * needs confirming on-site before it can be reproduced for real.
 */
export const STAGE_PREFIXES = ["301", "302", "303", "305"] as const;
export type StagePrefix = (typeof STAGE_PREFIXES)[number];

export const STAGE_LABELS: Record<StagePrefix, string> = {
  "301": "301 · Preclean",
  "302": "302 · Roasting",
  "303": "303 · Packaging",
  "305": "305 · Repacking",
};

/**
 * "input" = net quantity < 0 for this material in this order (issued).
 * "output" = net quantity > 0 (received/graded out).
 * "neutral" = net quantity nets to exactly 0 (e.g. a fully-reversed
 * movement) — still shown, not dropped, so no material silently
 * disappears from the report.
 */
export type MaterialRole = "input" | "output" | "neutral";

export interface MaterialLine {
  material: string;
  materialDescription: string;
  eun: string;
  role: MaterialRole;
  quantity: number;
  amount: number;
  pricePerKg: number | null;
  proportion: number | null;
  stdPercent: number | null;
  reallocatedCost: number | null;
  reallocatedPricePerKg: number | null;
  settlementRule: number | null;
}

export interface OrderGroup {
  order: string;
  totalInputQuantity: number;
  totalInputAmount: number;
  semiQuantity: number;
  materials: MaterialLine[];
  /** Sum of every material line's signed quantity/amount in the group — the
   * same small residual the source Excel's own "{order} Sum" row shows
   * (mass-balance check: input + all outputs, near zero). */
  inputSemiQuantity: number;
  totalReallocatedCost: number;
  residualQuantity: number;
  residualAmount: number;
  totalYield: number | null;
  totalLoss: number | null;
  totalSettlement: number | null;
  /** Sum of every output material's stdPercent in the group (source sheet
   * 301's "J{sum}" — column J's own Sum-row total, the denominator its
   * "ปันใหม่ตาม STD" reallocation formula divides by). */
  totalStdPercent: number;
  missingStd: boolean;
}

export interface OrderStageReport {
  stage: StagePrefix;
  groups: OrderGroup[];
  materialsMissingStd: string[];
}

/** Sheet 302 (Roasting): no STD/reallocation concept — just a blend-mix
 * ratio among inputs, plus each material's share of total output. */
export interface Order302Line {
  material: string;
  materialDescription: string;
  eun: string;
  role: MaterialRole;
  quantity: number;
  amount: number;
  pricePerKg: number | null;
  /** สัดส่วนผสม — input rows only: |qty| ÷ total input qty (blend recipe ratio). */
  mixRatio: number | null;
  /** สัดส่วน — all rows: |qty| ÷ total output qty. */
  outputRatio: number | null;
}

export interface Order302Group {
  order: string;
  totalInputQuantity: number;
  totalInputAmount: number;
  totalOutputQuantity: number;
  totalMixRatio: number;
  totalPricePerKg: number;
  lines: Order302Line[];
  residualQuantity: number;
  residualAmount: number;
  yield: number | null;
  loss: number | null;
}

export interface Order302Report {
  stage: "302";
  groups: Order302Group[];
}

/**
 * Sheet 303 (Packaging): yield needs each output material's unit weight
 * (grams/bag) to convert bag counts to kg — not present in MB51, so it's
 * editable master data (UnitWeightMaster), same UX as STD%. Packaging
 * consumables (box/film/valve — PC/EA units) are shown as line items for
 * completeness but don't participate in the weight-based yield calc.
 */
export interface Order303Line {
  material: string;
  materialDescription: string;
  eun: string;
  role: MaterialRole;
  quantity: number;
  amount: number;
  pricePerKg: number | null;
  /** Output rows only, and only once unitWeightGrams is set. */
  unitWeightGrams: number | null;
}

export interface Order303Group {
  order: string;
  /** The KG-denominated input material (the roasted blend) — yield's
   * denominator. Null if the order has no single clear KG input (flagged,
   * not guessed). */
  blendInputMaterial: string | null;
  blendInputQuantity: number | null;
  lines: Order303Line[];
  residualQuantity: number;
  residualAmount: number;
  outputWeightKg: number | null;
  yield: number | null;
  loss: number | null;
  missingUnitWeight: boolean;
}

export interface Order303Report {
  stage: "303";
  groups: Order303Group[];
  materialsMissingUnitWeight: string[];
}

/**
 * Sheet 305 (ห้อง Repacking, "CPR"/retail-repack line) — verified against
 * both reference files 2026-08-26 (see docs/source-analysis.md).
 * Structurally the same shape as 303: each order consumes one
 * BAG-denominated "blend" input (a finished bag product from an earlier
 * order, being repacked/relabeled — e.g. "GOLD BLEND ALL CAFE' 500G") plus
 * several PC/EA packaging consumables (valve, film, box, sticker), and
 * produces one or more BAG output(s).
 *
 * Unlike 303, the input here is already a bag-counted product, not a
 * KG-denominated blend — so both input AND output need a grams-per-bag
 * conversion to get a real weight-based yield. This matters because input
 * and output bag sizes aren't always the same: some orders repack a 500g bag
 * into two 250g bags, which would show as 200% "yield" under a naive
 * bag-count ratio — only a weight-based calc gives the right answer (~100%).
 * Same confirmed-table-with-editable-fallback pattern as 303
 * (FG_UNIT_WEIGHT_GRAMS, lib/fgUnitWeights.ts, falling back to the shared
 * editable UnitWeightMaster) — grams-per-bag is a property of the material
 * code itself, so the same table applies whether that material shows up as
 * 303's output or 305's input.
 */
export interface Order305Line {
  material: string;
  materialDescription: string;
  eun: string;
  role: MaterialRole;
  quantity: number;
  amount: number;
  mvt: string;
  outputG: number | null,
  outputKg: number | null,
  pricePerKg: number | null;
  /** Grams per bag — shown/editable for the blend input row and BAG output
   * row(s) only (see blendInputMaterial). */
  unitWeightGrams: number | null;
}

export interface Order305Group {
  order: string;
  /** The BAG-denominated input material being repacked — yield's
   * denominator (by weight). Null if the order has no single clear
   * BAG-unit, non-consumable input (flagged, not guessed). */
  blendInputMaterial: string | null;
  blendInputQuantity: number | null;
  totalInputQuantity: number;
  totalInputAmount: number;
  totalOutputQuantity: number;
  
  lines: Order305Line[];
  residualQuantity: number;
  residualAmount: number;
  inputWeightKg: number | null;
  outputWeightG: number | null;
  outputWeightKg: number | null;
  yield: number | null;
  loss: number | null;
  missingUnitWeight: boolean;
}

export interface Order305Report {
  stage: "305";
  groups: Order305Group[];
  materialsMissingUnitWeight: string[];
}

/**
 * Summary Dashboard — one row per month, spanning Preclean → Roasting →
 * Packing, matching `Roasting Dashboard Initiative.xlsx`'s "Dash" sheet
 * (see docs/roasting-dashboard-analysis.md). Classified by SLoc + movement
 * type + material code (see lib/summaryDashboard.ts), not the sign-based
 * role inference the 301/302/303 tabs use.
 *
 * `preclean.yield` = total clean-bean output (grade A + Lot#1) ÷ green
 * input — changed 2026-09-01 at the user's request to fold Lot#1 into
 * %Yield 1 (it's still sellable coffee, just a lower grade, so counting it
 * as yield rather than loss). Was grade-A only before (the source
 * workbook's original "%Yield 1" definition). `aOutputQuantity` and
 * `lot1OutputQuantity` are still kept separately so the dashboard's
 * "Yield 1" / "Lot 1" columns can show the split.
 */
export interface PrecleanMonthSummary {
  inputQuantity: number;
  aOutputQuantity: number;
  lot1OutputQuantity: number;
  /** Lot#1 output split by variety (57000002 Arabica B / 57000004 Robusta
   * B) — feeds the dashboard's "Lot Number 1 (Cumulative)" chart. */
  lot1ArabicaQuantity: number;
  lot1RobustaQuantity: number;
  /** grade A + Lot#1 — the numerator of `yield` and the "Yield 1" tonnage
   * shown on the dashboard (both KPI card and table). */
  totalOutputQuantity: number;
  yield: number | null;
}

export interface RoastingMonthSummary {
  inputQuantity: number;
  outputQuantity: number;
  yield: number | null;
}

/** `yield` = outputWeightKg ÷ Roasting's output for the same month (the
 * source's own "%Yield 3" formula) — NOT ÷ this stage's own input, which
 * is shown separately (`inputQuantity`) as a mass-balance reference; the
 * two are usually very close but not definitionally the same thing. */
export interface PackingMonthSummary {
  inputQuantity: number;
  outputWeightKg: number;
  yield: number | null;
  /** FG material codes seen this month that aren't in the confirmed
   * FG_UNIT_WEIGHT_GRAMS table (lib/fgUnitWeights.ts) — excluded from
   * outputWeightKg by the user's own formula, not a data gap. */
  excludedMaterials: string[];
}

export interface SummaryDashboardMonth {
  monthKey: string;
  monthLabel: string;
  preclean: PrecleanMonthSummary;
  roasting: RoastingMonthSummary;
  packing: PackingMonthSummary;
  /** The workbook's headline KPI: Packing output ÷ Roasting input. */
  combinedYield: number | null;
}

/** One (month, supplier) data point for Preclean's %Yield 1 — supplier is
 * derived from the input/output rows' shared MB51 "Batch" code.
 * `outputQuantity` is total clean-bean output (grade A + Lot#1), same as
 * the headline %Yield 1 numerator (changed 2026-09-01). */
export interface SupplierYieldPoint {
  monthKey: string;
  monthLabel: string;
  supplier: string;
  inputQuantity: number;
  outputQuantity: number;
  yield: number | null;
}

export interface SummaryDashboardReport {
  months: SummaryDashboardMonth[];
  total: SummaryDashboardMonth;
  bySupplier: SupplierYieldPoint[];
  suppliers: string[];
  /** True when a variety or supplier filter (lib/summaryDashboard.ts's
   * DashboardFilters) is active. Roasting/Packing/combinedYield are not
   * attributable to one variety or supplier (blending happens at
   * Roasting), so they come back as empty/null whenever this is true — the
   * UI must show "-" for those fields instead of trusting a real-looking
   * zero. */
  filtersActive: boolean;
}
