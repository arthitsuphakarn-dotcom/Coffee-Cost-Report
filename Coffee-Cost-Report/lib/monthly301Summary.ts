import { monthKeyOf } from "./dates";
import { stdPercentAsOf } from "./stdMaster";
import type { RawMovementRow, StdMaster } from "./types";

/**
 * "สรุปรายเดือน 301" — a per-calendar-month breakdown of the source
 * workbook's "Summary เพิ่มแต่ละสูตร" block (`ตรวจ MB51_0769.xlsx` sheet
 * `301`, cells `A88:O99`). That block aggregates the whole sheet into one
 * period; this splits it by month.
 *
 * Per variety group (Robusta = green 54002341 + clean 57000003/04;
 * Arabica = green 54002340 + clean 57000000/01/02), for one month:
 *
 * | src col | field                | formula (output row; green row 90)      |
 * |---------|----------------------|----------------------------------------|
 * | G Semi  | semiQuantity         | Σ output qty                           |
 * | H       | proportion           | outQty ÷ |inputQty|   (green row = 1)   |
 * | I       | pricePerKg           | amount ÷ qty                            |
 * | J % STD | stdPercent           | effective-dated master value as of this |
 * |         |                      | month (stdPercentAsOf) — ก้อน B         |
 * | K       | reallocatedCost      | |inputAmount| × stdPercent ÷ 100        |
 * | L       | reallocatedPricePerKg| reallocatedCost ÷ outQty                |
 * | M       | settlementRule       | ROUND(proportion, 2)                    |
 * | N % Yield | section.yield      | Σ H over outputs                        |
 * | O % Loss  | section.loss       | 1 − yield                              |
 *
 * Sign convention follows the rest of the app: Quantity/Amount keep their
 * real MB51 sign (input issued = negative); ratios are positive fractions.
 */

const ARABICA_GREEN_CODE = "54002340";
const ROBUSTA_GREEN_CODE = "54002341";
const ARABICA_CLEAN_CODES = ["57000000", "57000001", "57000002"] as const;
const ROBUSTA_CLEAN_CODES = ["57000003", "57000004"] as const;

const GREEN_FALLBACK_DESC: Record<string, string> = {
  [ARABICA_GREEN_CODE]: "สารกาแฟอาราบิก้า",
  [ROBUSTA_GREEN_CODE]: "สารกาแฟโรบัสต้า",
};

/**
 * Last-resort names for the clean-bean grades, used when NO row in the
 * description source carries a description for that code. This happens when
 * a grade has zero 301 movement in the whole set the description map is
 * built from (e.g. the month-range filter is narrowed to a month that grade
 * didn't produce in) — the section still emits a row for every configured
 * grade, so without this it would show the bare code as its own name. Also
 * covers the phase-2 DB source, where MB51_DESCRIPTION can come through
 * empty (the store maps the literal string "NULL" to "").
 */
const CLEAN_FALLBACK_DESC: Record<string, string> = {
  "57000000": "เมล็ดกาแฟ Clean Arabica Size S&M",
  "57000001": "เมล็ดกาแฟ Clean Arabica Size L",
  "57000002": "เมล็ดกาแฟ Clean Arabica B",
  "57000003": "เมล็ดกาแฟ Clean Robusta Size mix",
  "57000004": "เมล็ดกาแฟ Clean Robusta B",
};

export type SummaryVariety = "robusta" | "arabica";

const SECTION_CONFIG = [
  { variety: "robusta" as const, greenCode: ROBUSTA_GREEN_CODE, varietyLabel: "Robusta", cleanCodes: ROBUSTA_CLEAN_CODES },
  { variety: "arabica" as const, greenCode: ARABICA_GREEN_CODE, varietyLabel: "Arabica", cleanCodes: ARABICA_CLEAN_CODES },
];

export interface Monthly301Line {
  material: string;
  materialDescription: string;
  role: "input" | "output";
  quantity: number;
  amount: number;
  /** H — สัดส่วน, positive fraction; the green input row is 1 (100%). */
  proportion: number | null;
  pricePerKg: number | null;
  stdPercent: number | null;
  /** K — ปันใหม่ตาม STD. */
  reallocatedCost: number | null;
  /** L — ราคาหลังปัน. */
  reallocatedPricePerKg: number | null;
  /** M — Settlement Rule = ROUND(proportion, 2); null on the input row. */
  settlementRule: number | null;
}

export interface Monthly301Section {
  variety: SummaryVariety;
  varietyLabel: string;
  greenCode: string;
  greenDescription: string;
  /** [green input, ...clean outputs]. */
  lines: Monthly301Line[];
  /** G — Σ output qty. */
  semiQuantity: number;
  /** Σ quantity over every line (green input + all outputs) — mass-balance
   * residual for the "รวม {variety}" row, sits near zero. Single source of
   * truth for both the on-screen view and the export (they used to compute
   * this inline separately and drift — see daily-reports/2026-08-31 R10). */
  quantityTotal: number;
  /** Σ amount over every line — same rationale as quantityTotal. */
  amountTotal: number;
  /** Σ proportion over every line (green row counts as +1) — a literal
   * column sum, does NOT net to zero. */
  proportionTotal: number;
  /** N — Σ proportion over outputs. */
  yield: number | null;
  /** O — 1 − yield. */
  loss: number | null;
  /** Σ settlementRule over outputs (source M sum row). */
  settlementRuleTotal: number | null;
}

export interface Monthly301Month {
  monthKey: string;
  sections: Monthly301Section[];
  /** Mass-balance residual across both blocks (Σ input + all outputs) —
   * the source's row-101 "Diff" check; should sit near zero. */
  diffQuantity: number;
  diffAmount: number;
}

/** Same shape as one month, but built from every row in the filtered range
 * treated as a single period (the original A88:O99 "whole sheet = 1 period"
 * behaviour ก้อน A split apart) — used as the "รวมทั้งหมด" column next to the
 * per-month ones. %STD resolves as of the latest month in range, same
 * "current value" convention used elsewhere (Settlement Rule Report,
 * StdManagerModal). */
export interface Monthly301Total {
  sections: Monthly301Section[];
  diffQuantity: number;
  diffAmount: number;
}

export interface Monthly301Summary {
  /** Only months that carry 301 data, ascending. */
  months: Monthly301Month[];
  /** Null only when there's no 301 data at all in range. */
  total: Monthly301Total | null;
}

function diffOf(sections: Monthly301Section[]): { diffQuantity: number; diffAmount: number } {
  let diffQuantity = 0;
  let diffAmount = 0;
  for (const s of sections) {
    for (const l of s.lines) {
      diffQuantity += l.quantity;
      diffAmount += l.amount;
    }
  }
  return { diffQuantity, diffAmount };
}

export function computeMonthly301Summary(
  rows: RawMovementRow[],
  stdMaster: StdMaster,
  /**
   * Rows to harvest material descriptions from — pass the FULL upload here,
   * not the month-range-filtered subset, so a grade with no movement in the
   * filtered range still resolves its real name instead of falling back to
   * the bare code. Defaults to `rows` for callers that already pass the
   * whole set (Settlement Rule report, unfiltered export).
   */
  descriptionRows: RawMovementRow[] = rows,
): Monthly301Summary {
  const rows301 = rows.filter((r) => r.order?.startsWith("301"));

  const descByMaterial = new Map<string, string>();
  for (const r of descriptionRows) {
    if (!r.order?.startsWith("301")) continue;
    if (r.materialDescription && !descByMaterial.has(r.material)) descByMaterial.set(r.material, r.materialDescription);
  }

  const monthKeys = Array.from(new Set(rows301.map((r) => monthKeyOf(r.postingDate)))).sort();

  const months = monthKeys.map((monthKey) => {
    const monthRows = rows301.filter((r) => monthKeyOf(r.postingDate) === monthKey);
    const sections = SECTION_CONFIG.map((cfg) => buildSection(cfg, monthKey, monthRows, descByMaterial, stdMaster));
    return { monthKey, sections, ...diffOf(sections) };
  });

  const asOfMonth = monthKeys[monthKeys.length - 1];
  const total: Monthly301Total | null =
    monthKeys.length > 0
      ? (() => {
          const sections = SECTION_CONFIG.map((cfg) => buildSection(cfg, asOfMonth, rows301, descByMaterial, stdMaster));
          return { sections, ...diffOf(sections) };
        })()
      : null;

  return { months, total };
}

function buildSection(
  cfg: (typeof SECTION_CONFIG)[number],
  monthKey: string,
  monthRows: RawMovementRow[],
  descByMaterial: Map<string, string>,
  stdMaster: StdMaster,
): Monthly301Section {
  const cleanCodes = cfg.cleanCodes as readonly string[];

  const agg = new Map<string, { quantity: number; amount: number }>();
  for (const r of monthRows) {
    if (r.material !== cfg.greenCode && !cleanCodes.includes(r.material)) continue;
    const cur = agg.get(r.material) ?? { quantity: 0, amount: 0 };
    cur.quantity += r.quantity;
    cur.amount += r.amount;
    agg.set(r.material, cur);
  }

  const green = agg.get(cfg.greenCode);
  const inputQtyAbs = green ? Math.abs(green.quantity) : 0;
  const inputAmountAbs = green ? Math.abs(green.amount) : 0;

  const greenDescription = descByMaterial.get(cfg.greenCode) ?? GREEN_FALLBACK_DESC[cfg.greenCode] ?? cfg.greenCode;

  const lines: Monthly301Line[] = [
    {
      material: cfg.greenCode,
      materialDescription: greenDescription,
      role: "input",
      quantity: green?.quantity ?? 0,
      amount: green?.amount ?? 0,
      proportion: inputQtyAbs > 0 ? 1 : null,
      pricePerKg: inputQtyAbs > 0 ? inputAmountAbs / inputQtyAbs : null,
      stdPercent: null,
      reallocatedCost: null,
      reallocatedPricePerKg: null,
      settlementRule: null,
    },
  ];

  let semiQuantity = 0;
  let yieldSum = 0;
  let settlementRuleTotal = 0;
  let anyOutput = false;

  for (const code of cleanCodes) {
    // Keep a row for every configured grade even with zero movement this
    // month — matches the source A88:O99 block, where %STD / ปันใหม่ตาม STD
    // still appear on a grade that produced nothing.
    const a = agg.get(code) ?? { quantity: 0, amount: 0 };
    if (agg.has(code)) anyOutput = true;

    const outQty = a.quantity;
    const outAmount = a.amount;
    semiQuantity += outQty;

    const proportion = inputQtyAbs > 0 ? outQty / inputQtyAbs : null;
    const std = stdPercentAsOf(stdMaster, code, monthKey);
    const reallocatedCost = std !== null && inputAmountAbs > 0 ? (inputAmountAbs * std) / 100 : null;
    const settlementRule = proportion !== null ? Math.round(proportion * 100) / 100 : null;

    if (proportion !== null) yieldSum += proportion;
    if (settlementRule !== null) settlementRuleTotal += settlementRule;

    lines.push({
      material: code,
      materialDescription: descByMaterial.get(code) ?? CLEAN_FALLBACK_DESC[code] ?? code,
      role: "output",
      quantity: outQty,
      amount: outAmount,
      proportion,
      pricePerKg: outQty !== 0 ? outAmount / outQty : null,
      stdPercent: std,
      reallocatedCost,
      reallocatedPricePerKg: reallocatedCost !== null && outQty !== 0 ? reallocatedCost / outQty : null,
      settlementRule,
    });
  }

  const canYield = anyOutput && inputQtyAbs > 0;

  const quantityTotal = lines.reduce((s, l) => s + l.quantity, 0);
  const amountTotal = lines.reduce((s, l) => s + l.amount, 0);
  const proportionTotal = lines.reduce((s, l) => s + (l.proportion ?? 0), 0);

  return {
    variety: cfg.variety,
    varietyLabel: cfg.varietyLabel,
    greenCode: cfg.greenCode,
    greenDescription,
    lines,
    semiQuantity,
    quantityTotal,
    amountTotal,
    proportionTotal,
    yield: canYield ? yieldSum : null,
    loss: canYield ? 1 - yieldSum : null,
    settlementRuleTotal: anyOutput ? settlementRuleTotal : null,
  };
}
