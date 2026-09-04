import { formatMonthLabel, monthKeyOf } from "./dates";
import { FG_UNIT_WEIGHT_GRAMS } from "./fgUnitWeights";
import type {
  PackingMonthSummary,
  PrecleanMonthSummary,
  RawMovementRow,
  RoastingMonthSummary,
  SummaryDashboardMonth,
  SummaryDashboardReport,
  SupplierYieldPoint,
} from "./types";

/**
 * Reproduces `Roasting Dashboard Initiative.xlsx`'s "Dash" sheet: one row
 * per month, Preclean → Roasting → Packing yield, plus the workbook's
 * headline combined-yield KPI. See docs/roasting-dashboard-analysis.md.
 *
 * Classification is by SLoc + movement type (MvT) + material code, exactly
 * as the workbook's own "เงื่อนไข" sheet defines it — NOT by quantity sign
 * the way the 301/302/303 per-order tabs infer roles. Verified this
 * matters: the same-order sign-based approach the other tabs use pulls in
 * unrelated postings (cost adjustments, etc.) on the same order and was
 * off by 10–34% against the workbook's own cached numbers when tried here.
 * The precise rule, cross-checked against the raw sheet until every one of
 * the 7 available months matched the source's numbers exactly:
 *
 * | Stage    | Direction | SLoc | MvT     | Material            |
 * |----------|-----------|------|---------|----------------------|
 * | Preclean | input     | P001 | 261/262 | starts with "54"     |
 * | Preclean | output    | P002 | 101/102 | CLEAN_BEAN_CODES     |
 * | Roasting | input     | P002 | 261/262 | CLEAN_BEAN_CODES     |
 * | Roasting | output    | P003 | 101/102 | ROASTED_BLEND_CODES  |
 * | Packing  | input     | P003 | 261/262 | ROASTED_BLEND_CODES  |
 * | Packing  | output    | M001 | 101/102 | FG_CODES              |
 *
 * One correction against "เงื่อนไข" itself: that sheet states Packing's
 * input side uses MvT "101 102" (copy-pasted from Roasting's *output* row
 * right above it in the same sheet) — the real data uses "261 262"
 * (goods-issue, consistent with every other input side). Confirmed by
 * matching the raw sheet's cached values only once corrected; with
 * "101 102" as literally written, Packing's input came out as 0. See
 * docs/roasting-dashboard-analysis.md.
 */
const CLEAN_BEAN_CODES = new Set(["57000000", "57000001", "57000002", "57000003", "57000004"]);
const ROASTED_BLEND_CODES = new Set(["57000100", "57000101", "57000102", "57000103", "57000104", "57000105", "57000106"]);
const FG_CODES = new Set([
  "59000001",
  "59000002",
  "59000003",
  "59000004",
  "59000005",
  "59000006",
  "59000007",
  "59000008",
  "59000009",
  "59000010",
  "59000011",
  "59000012",
  "59000013",
  "59000014",
  "59100000",
]);

/**
 * The two Preclean output material codes the user confirmed are "Lot#1"
 * (grade B) — Clean Arabica B (57000002) and Clean Robusta B (57000004) —
 * everything else 301 outputs is grade "A". Confirmed 2026-08-21 as a pure
 * material-code rule (see docs/roasting-dashboard-analysis.md) — not
 * editable master data since it's a fixed classification, unlike STD%/
 * unit-weight.
 */
const LOT1_ARABICA_CODE = "57000002";
const LOT1_ROBUSTA_CODE = "57000004";

const GI_MVT = new Set(["261", "262"]);
const GR_MVT = new Set(["101", "102"]);

/**
 * Variety split for the "สารกาแฟ" (raw material) dropdown filter — checked
 * directly against the raw file's own material descriptions, not guessed:
 * green-coffee (Code 54) has exactly two real codes, `54002340`
 * "สารกาแฟอาราบิก้า" and `54002341` "สารกาแฟโรบัสต้า" (a third code,
 * `54000541`, is an LPG refill that happens to share the "54" prefix but
 * never appears under a 301 order at P001/261-262, so it was never actually
 * counted — confirmed 2026-08-25). Clean-bean codes (Code 57, Preclean's
 * output / Roasting's input) are split the same way `เงื่อนไข`'s block 1
 * already documents.
 *
 * The filter only covers Preclean (green coffee in, clean beans out) and
 * Roasting's *input* — from Roasting's output onward, every downstream
 * material code (roasted blend, FG) is a deliberate multi-variety blend
 * recipe (e.g. "A80+R20"), so there is no honest per-variety figure for
 * Roasting output / Packing / combined yield. `computeSummaryDashboard`
 * returns those as empty + `filtersActive: true` rather than computing a
 * misleading number — the UI must check that flag and show "-", not trust
 * a zero.
 */
const ARABICA_GREEN_CODE = "54002340";
const ROBUSTA_GREEN_CODE = "54002341";
const ARABICA_CLEAN_CODES = new Set(["57000000", "57000001", "57000002"]);
const ROBUSTA_CLEAN_CODES = new Set(["57000003", "57000004"]);

export type Variety = "arabica" | "robusta";

export interface DashboardFilters {
  /** Restricts to one variety's green-coffee + clean-bean rows (Preclean
   * and Roasting-input only — see the block comment above). */
  variety?: Variety | null;
  /** Restricts to one supplier's rows, by the same batch-derived code the
   * by-supplier chart already uses. Applied on top of `variety`. */
  supplier?: string | null;
}

function filterRowsByVariety(rows: RawMovementRow[], variety: Variety): RawMovementRow[] {
  const greenCode = variety === "arabica" ? ARABICA_GREEN_CODE : ROBUSTA_GREEN_CODE;
  const cleanCodes = variety === "arabica" ? ARABICA_CLEAN_CODES : ROBUSTA_CLEAN_CODES;
  return rows.filter((r) => r.material === greenCode || cleanCodes.has(r.material));
}

/**
 * Supplier code from MB51's "Batch" column (e.g. "130825-TTW" → "TTW"),
 * exactly matching the user-provided formula:
 * `=IFERROR(REGEXREPLACE(Batch, "[^A-Za-z/]", ""),"-")` — keep only
 * letters and "/", fall back to "-".
 */
function extractSupplier(batch: string): string {
  const cleaned = batch.replace(/[^A-Za-z/]/g, "");
  return cleaned || "-";
}

/**
 * `filters` genuinely restricts the rows every figure is computed from —
 * KPI cards, the Yield1/Lot1 charts, and the summary table below all derive
 * from the same filtered `months`/`total`, so picking a variety or supplier
 * actually changes every number, not just which bars are visually dimmed
 * (that was the gap flagged 2026-08-25: supplier selection used to only
 * isolate bars in the one chart it lived in). The by-supplier breakdown
 * itself (`bySupplier`/`suppliers`) deliberately only applies the `variety`
 * filter, not `supplier` — it's the chart used *to pick* a supplier, so it
 * always shows every supplier for comparison; the selected one is
 * highlighted by the caller (DashboardOverview), not removed from the data.
 */
export function computeSummaryDashboard(rows: RawMovementRow[], filters?: DashboardFilters): SummaryDashboardReport {
  const variety = filters?.variety ?? null;
  const supplier = filters?.supplier ?? null;
  const filtersActive = variety !== null || supplier !== null;

  const varietyScoped = variety ? filterRowsByVariety(rows, variety) : rows;
  const scoped = supplier ? varietyScoped.filter((r) => extractSupplier(r.batch) === supplier) : varietyScoped;

  // Month list always comes from the full, unfiltered rows so every month
  // still shows a row (possibly all-zero) under a filter, instead of
  // disappearing — easier to compare "this supplier had nothing in March"
  // against the other months than to have March vanish from the table.
  const monthKeys = Array.from(new Set(rows.map((r) => monthKeyOf(r.postingDate)))).sort();

  const months = monthKeys.map((monthKey) => buildMonth(monthKey, scoped.filter((r) => monthKeyOf(r.postingDate) === monthKey), filtersActive));

  const total = buildMonth("TOTAL", scoped, filtersActive);
  total.monthLabel = "รวมทั้งหมด";

  const bySupplier = computeBySupplier(varietyScoped, monthKeys);
  const suppliers = Array.from(new Set(bySupplier.map((p) => p.supplier))).sort();

  return { months, total, bySupplier, suppliers, filtersActive };
}

const EMPTY_ROASTING: RoastingMonthSummary = { inputQuantity: 0, outputQuantity: 0, yield: null };
const EMPTY_PACKING: PackingMonthSummary = { inputQuantity: 0, outputWeightKg: 0, yield: null, excludedMaterials: [] };

function buildMonth(monthKey: string, rows: RawMovementRow[], filtersActive: boolean): SummaryDashboardMonth {
  const preclean = precleanSummary(rows);
  // Roasting output / Packing / combined yield aren't attributable to one
  // variety or supplier (blending happens at Roasting) — see the block
  // comment above filterRowsByVariety. Returning fixed empties (rather than
  // computing against the filtered rows) avoids ever showing a real-looking
  // zero for "no data this filter" versus "this stage genuinely produced
  // nothing" — the UI keys off `filtersActive` to render "-" instead.
  const roasting = filtersActive ? EMPTY_ROASTING : roastingSummary(rows);
  const packing = filtersActive ? EMPTY_PACKING : packingSummary(rows, roasting.outputQuantity);
  const combinedYield = !filtersActive && roasting.inputQuantity > 0 ? packing.outputWeightKg / roasting.inputQuantity : null;

  return {
    monthKey,
    monthLabel: monthKey === "TOTAL" ? "รวมทั้งหมด" : formatMonthLabel(monthKey),
    preclean,
    roasting,
    packing,
    combinedYield,
  };
}

function precleanSummary(rows: RawMovementRow[]): PrecleanMonthSummary {
  let inputNet = 0;
  let aOutputQuantity = 0;
  let lot1ArabicaQuantity = 0;
  let lot1RobustaQuantity = 0;
  for (const r of rows) {
    if (!r.order.startsWith("301")) continue;
    if (r.sLoc === "P001" && GI_MVT.has(r.mvt) && r.material.startsWith("54")) {
      // Net, don't sum abs() per row: MvT 262 here is a *reversal* of a 261
      // issue (opposite sign), not a second input — summing abs() would
      // double-count every reversed row instead of cancelling it out.
      inputNet += r.quantity;
    } else if (r.sLoc === "P002" && GR_MVT.has(r.mvt) && CLEAN_BEAN_CODES.has(r.material)) {
      if (r.material === LOT1_ARABICA_CODE) lot1ArabicaQuantity += r.quantity;
      else if (r.material === LOT1_ROBUSTA_CODE) lot1RobustaQuantity += r.quantity;
      else aOutputQuantity += r.quantity;
    }
  }
  const inputQuantity = Math.abs(inputNet);
  const lot1OutputQuantity = lot1ArabicaQuantity + lot1RobustaQuantity;
  const totalOutputQuantity = aOutputQuantity + lot1OutputQuantity;
  return {
    inputQuantity,
    aOutputQuantity,
    lot1OutputQuantity,
    lot1ArabicaQuantity,
    lot1RobustaQuantity,
    totalOutputQuantity,
    // %Yield 1 = total clean-bean output (grade A + Lot#1) ÷ green input —
    // per the user's 2026-09-01 request to fold Lot#1 into %Yield 1 (both
    // the ratio and the tonnage shown on the dashboard). Was grade-A only
    // before; the "Lot 1" column still shows the Lot#1 slice on its own.
    yield: inputQuantity > 0 ? totalOutputQuantity / inputQuantity : null,
  };
}

function roastingSummary(rows: RawMovementRow[]): RoastingMonthSummary {
  let inputNet = 0;
  let outputQuantity = 0;
  for (const r of rows) {
    if (!r.order.startsWith("302")) continue;
    if (r.sLoc === "P002" && GI_MVT.has(r.mvt) && CLEAN_BEAN_CODES.has(r.material)) {
      inputNet += r.quantity; // net, same reversal reasoning as precleanSummary
    } else if (r.sLoc === "P003" && GR_MVT.has(r.mvt) && ROASTED_BLEND_CODES.has(r.material)) {
      outputQuantity += r.quantity;
    }
  }
  const inputQuantity = Math.abs(inputNet);
  return { inputQuantity, outputQuantity, yield: inputQuantity > 0 ? outputQuantity / inputQuantity : null };
}

/**
 * `roastingOutputQuantity` (this same month's Roasting output) is the
 * yield denominator here — the source workbook's own "%Yield 3" formula
 * (FG ÷ Output Roasting), confirmed by the user — not this stage's own
 * netted input, which is kept as `inputQuantity` for reference only (the
 * two are usually close but not definitionally the same figure).
 *
 * FG weight uses the confirmed `FG_UNIT_WEIGHT_GRAMS` table only — no
 * fallback to the editable UnitWeightMaster here. The user's formula is
 * exact (`ELSE 0` for anything not listed), so any FG material outside
 * that table is excluded from `outputWeightKg` by design, not "missing."
 * Verified against all 7 available months of the source's cached FG
 * totals: matches exactly for 6, off by exactly one excluded material's
 * contribution in the 7th (see docs — flagged to the user, not guessed).
 */
function packingSummary(rows: RawMovementRow[], roastingOutputQuantity: number): PackingMonthSummary {
  let inputNet = 0;
  let outputWeightKg = 0;
  const excludedMaterials = new Set<string>();
  for (const r of rows) {
    if (!r.order.startsWith("303")) continue;
    if (r.sLoc === "P003" && GI_MVT.has(r.mvt) && ROASTED_BLEND_CODES.has(r.material)) {
      inputNet += r.quantity; // net, same reversal reasoning as precleanSummary
    } else if (r.sLoc === "M001" && GR_MVT.has(r.mvt) && FG_CODES.has(r.material)) {
      const grams = FG_UNIT_WEIGHT_GRAMS[r.material];
      if (grams) outputWeightKg += (r.quantity * grams) / 1000;
      else excludedMaterials.add(r.material);
    }
  }
  const inputQuantity = Math.abs(inputNet);
  return {
    inputQuantity,
    outputWeightKg,
    yield: roastingOutputQuantity > 0 ? outputWeightKg / roastingOutputQuantity : null,
    excludedMaterials: Array.from(excludedMaterials).sort(),
  };
}

function computeBySupplier(rows: RawMovementRow[], monthKeys: string[]): SupplierYieldPoint[] {
  const key = (monthKey: string, supplier: string) => `${monthKey} ${supplier}`;
  const inputNet = new Map<string, number>();
  const output = new Map<string, number>();
  const suppliersByMonth = new Map<string, Set<string>>();

  for (const r of rows) {
    if (!r.order.startsWith("301")) continue;
    const isInput = r.sLoc === "P001" && GI_MVT.has(r.mvt) && r.material.startsWith("54");
    // Total clean-bean output (grade A + Lot#1), matching the main %Yield 1
    // definition after the user's 2026-09-01 change — the "By Supplier"
    // chart must use the same numerator as the headline %Yield 1 trend, or
    // the two disagree. Was grade-A only (Lot#1 codes excluded).
    const isOutput = r.sLoc === "P002" && GR_MVT.has(r.mvt) && CLEAN_BEAN_CODES.has(r.material);
    if (!isInput && !isOutput) continue;

    const monthKey = monthKeyOf(r.postingDate);
    const supplier = extractSupplier(r.batch);
    const k = key(monthKey, supplier);
    if (!suppliersByMonth.has(monthKey)) suppliersByMonth.set(monthKey, new Set());
    suppliersByMonth.get(monthKey)!.add(supplier);

    if (isInput) inputNet.set(k, (inputNet.get(k) ?? 0) + r.quantity);
    else output.set(k, (output.get(k) ?? 0) + r.quantity);
  }

  const points: SupplierYieldPoint[] = [];
  for (const monthKey of monthKeys) {
    const suppliers = Array.from(suppliersByMonth.get(monthKey) ?? []).sort();
    for (const supplier of suppliers) {
      const k = key(monthKey, supplier);
      const inputQuantity = Math.abs(inputNet.get(k) ?? 0);
      const outputQuantity = output.get(k) ?? 0;
      points.push({
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        supplier,
        inputQuantity,
        outputQuantity,
        yield: inputQuantity > 0 ? outputQuantity / inputQuantity : null,
      });
    }
  }
  return points;
}
