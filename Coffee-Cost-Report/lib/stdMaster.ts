import type { StdEntry, StdMaster } from "./types";

/**
 * Resolvers for the effective-dated %STD history (lib/types.ts's StdMaster).
 * A material's %STD can change over time (e.g. a new crop-year standard from
 * SAP MM03); past months must keep resolving to whatever value was in effect
 * back then, not today's value.
 */

function sorted(entries: StdEntry[]): StdEntry[] {
  return [...entries].sort((a, b) => a.from.localeCompare(b.from));
}

/** The value in effect for `monthKey` ("YYYY-MM") — the latest entry whose
 * `from` is <= monthKey. Null if the material has no entry that early. */
export function stdPercentAsOf(master: StdMaster, material: string, monthKey: string): number | null {
  const entries = master[material];
  if (!entries || entries.length === 0) return null;
  let result: number | null = null;
  for (const e of sorted(entries)) {
    if (e.from <= monthKey) result = e.value;
    else break;
  }
  return result;
}

/** The most recent entry's value regardless of month — used where the UI
 * shows one "current" %STD (e.g. the Settlement Rule Report's STD column). */
export function latestStdPercent(master: StdMaster, material: string): number | null {
  const entries = master[material];
  if (!entries || entries.length === 0) return null;
  return sorted(entries)[entries.length - 1].value;
}

export function sortedStdEntries(master: StdMaster, material: string): StdEntry[] {
  return sorted(master[material] ?? []);
}
