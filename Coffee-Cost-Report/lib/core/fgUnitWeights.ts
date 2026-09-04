/**
 * Confirmed grams-per-bag for Packing's finished-good (Code 59) materials —
 * given directly by the user 2026-08-21 as an exact SQL formula (matching
 * their own production reporting query), replacing the previous open
 * "editable, unconfirmed" unit-weight master-data question for these
 * materials. Any FG material code NOT listed here is deliberately excluded
 * from the weight-based yield calc (contributes 0), per the formula's own
 * `ELSE 0` — not a gap to fill in, a confirmed exclusion.
 */
export const FG_UNIT_WEIGHT_GRAMS: Record<string, number> = {
  "59000001": 500,
  "59000002": 500,
  "59000003": 500,
  "59000004": 500,
  "59000007": 500,
  "59000011": 500,
  "59000014": 500,
  "59100000": 500,
  "59000008": 250,
};
