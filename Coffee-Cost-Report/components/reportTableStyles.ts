import type { MaterialRole } from "@/lib/types";

export const th = "border border-border bg-surface-2 px-2 py-3 text-left text-xs font-semibold text-text whitespace-nowrap";
export const td = "border border-border px-2 py-1 text-xs whitespace-nowrap font-mono";
export const tdNum = `${td} text-right tabular-nums`;

/** Page-bottom grand-total row ("รวมทั้งหมด (ทุก Order)") — sums every order's
 * own Sum-row values, column by column. */
export const tfootCell = `${td} sticky bottom-0 z-30 border-t-2 !border-t-zinc-500 bg-zinc-200 py-2 font-bold`;
export const tfootNum = `${tfootCell} sticky bottom-0 z-30 text-right tabular-nums`;
export const inputCell =
  "w-16 bg-transparent text-right text-xs font-mono outline-none focus:bg-preclean-soft focus:ring-1 focus:ring-up rounded-sm px-1 py-0.5";

export const roleBorder: Record<MaterialRole, string> = {
  input: "border-l-2 border-l-rose-300",
  output: "border-l-2 border-l-emerald-300",
  neutral: "border-l-2 border-l-border",
};
