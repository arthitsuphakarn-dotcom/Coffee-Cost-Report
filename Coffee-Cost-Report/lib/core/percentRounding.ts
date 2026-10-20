/**
 * Ratios are shown at 0.01% (formatPercent / the exports' pct). Rounding each
 * cell on its own lets a column of parts drift off its total by ±0.01
 * (e.g. 15.83 + 64.13 + 20.03 = 99.99), so ratios that are read together are
 * rounded here, at the source, and every derived figure is built from the
 * rounded values — the screen and the Excel export then always tie out.
 */

/** 0..1 fraction units per 0.01% — the precision ratios are displayed at. */
const UNITS = 10000;

/** Round a 0..1 fraction to 0.01%. */
export function roundToDisplayPercent(fraction: number): number {
  return Math.round(fraction * UNITS) / UNITS;
}

/**
 * Round a set of parts to 0.01% so they still add up to their own rounded
 * total (100% for a full breakdown). Largest-remainder method: every part is
 * rounded down, then the units lost to rounding go back one each to the parts
 * with the biggest dropped remainder — no part moves more than 0.01% from its
 * true value. Nulls stay null and don't take part.
 */
export function roundPartsKeepingTotal(parts: (number | null)[]): (number | null)[] {
  const scaled = parts.map((p) => (p === null ? null : p * UNITS));
  const floors = scaled.map((v) => (v === null ? null : Math.floor(v)));
  const target = Math.round(scaled.reduce<number>((s, v) => s + (v ?? 0), 0));
  let remaining = target - floors.reduce<number>((s, v) => s + (v ?? 0), 0);

  const byRemainder = scaled
    .map((v, i) => ({ i, remainder: v === null ? -1 : v - Math.floor(v) }))
    .filter(({ i }) => scaled[i] !== null)
    .sort((a, b) => b.remainder - a.remainder);
  for (const { i } of byRemainder) {
    if (remaining <= 0) break;
    floors[i] = floors[i]! + 1;
    remaining--;
  }

  return floors.map((v) => (v === null ? null : v / UNITS));
}
