import type { Order302Group, Order302Line, Order302Report, RawMovementRow } from "./types";

/**
 * Sheet 302 (ห้อง Roasting) — verified against the source workbook's own
 * formulas (see docs/source-analysis.md): group by Order, split materials
 * into input (clean beans consumed, net qty < 0 — commonly more than one
 * grade blended together) and output (roasted blend produced, net qty > 0).
 *
 * Unlike 301, there's no STD%/cost-reallocation step here — 302 has two
 * simpler ratio columns instead:
 *   - สัดส่วนผสม (mixRatio): each input's share of the total input blend
 *     (source: `=E{row}/G{header}` where G = SUM of input rows)
 *   - สัดส่วน (outputRatio): each row's qty as a share of total output qty
 *     (source: `=E{row}/E{output row}`)
 * Yield/Loss (source: `=E{output}/G{header}` and `=100%+Yield`) reduce to
 * the same totalOutputQtyAbs/totalInputQtyAbs ratio used elsewhere, just
 * expressed here as a positive fraction for readability.
 *
 * Not implemented: the source sum row's "สูตร FG" column
 * (`='303 '!AM{n}`), which pulls the finished-good material name from a
 * specific row in sheet 303. That's a positional cross-reference with no
 * reliable Order-to-Order mapping derivable from MB51 alone — reproducing
 * it would mean guessing which 303 order corresponds to which 302 order,
 * so it's left out rather than guessed. "Por Ver" is likewise omitted,
 * same as the other stages — its business meaning still isn't confirmed.
 */
export function computeOrder302Report(rows: RawMovementRow[]): Order302Report {
  const inScope = rows.filter((r) => r.order && r.order.startsWith("302"));

  const byOrderMaterial = new Map<string, { row: RawMovementRow; quantity: number; amount: number }>();
  for (const r of inScope) {
    const key = `${r.order}::${r.material}`;
    const existing = byOrderMaterial.get(key);
    if (existing) {
      existing.quantity += r.quantity;
      existing.amount += r.amount;
    } else {
      byOrderMaterial.set(key, { row: r, quantity: r.quantity, amount: r.amount });
    }
  }

  const byOrder = new Map<string, { row: RawMovementRow; quantity: number; amount: number }[]>();
  for (const entry of byOrderMaterial.values()) {
    const list = byOrder.get(entry.row.order) ?? [];
    list.push(entry);
    byOrder.set(entry.row.order, list);
  }

  const groups: Order302Group[] = [];
  const byMaterialCode = (a: { row: RawMovementRow }, b: { row: RawMovementRow }) => a.row.material.localeCompare(b.row.material);

  for (const [order, entries] of byOrder) {
    const inputEntries = entries.filter((e) => e.quantity < 0).sort(byMaterialCode);
    const outputEntries = entries.filter((e) => e.quantity > 0).sort(byMaterialCode);
    const neutralEntries = entries.filter((e) => e.quantity === 0).sort(byMaterialCode);
    if (inputEntries.length === 0 || outputEntries.length === 0) continue;

    const totalInputQuantity = inputEntries.reduce((s, e) => s + e.quantity, 0);
    const totalInputAmount = inputEntries.reduce((s, e) => s + e.amount, 0);
    const totalOutputQuantity = outputEntries.reduce((s, e) => s + e.quantity, 0);
    const totalInputQuantityAbs = Math.abs(totalInputQuantity);
    const totalOutputQuantityAbs = Math.abs(totalOutputQuantity);

    const toLine = (e: { row: RawMovementRow; quantity: number; amount: number }, role: Order302Line["role"]): Order302Line => ({
      material: e.row.material,
      materialDescription: e.row.materialDescription,
      eun: e.row.eun,
      role,
      quantity: e.quantity,
      amount: e.amount,
      pricePerKg: e.quantity !== 0 ? e.amount / e.quantity : null,
      mixRatio: role === "input" && totalInputQuantityAbs > 0 ? Math.abs(e.quantity) / totalInputQuantityAbs : null,
      outputRatio: totalOutputQuantityAbs > 0 ? Math.abs(e.quantity) / totalOutputQuantityAbs : null,
    });

    const lines: Order302Line[] = [
      ...inputEntries.map((e) => toLine(e, "input")),
      ...outputEntries.map((e) => toLine(e, "output")),
      ...neutralEntries.map((e) => toLine(e, "neutral")),
    ];

    const yieldRatio = totalInputQuantityAbs > 0 ? totalOutputQuantityAbs / totalInputQuantityAbs : null;
    const loss = yieldRatio !== null ? 1 - yieldRatio : null;
    const residualQuantity = entries.reduce((s, e) => s + e.quantity, 0);
    const residualAmount = entries.reduce((s, e) => s + e.amount, 0);

    const totalMixRatio = Math.abs(residualQuantity) / Math.abs(totalInputQuantity);
    const totalPricePerKg = Math.abs(residualAmount) / Math.abs(residualQuantity);

    groups.push({
      order,
      totalInputQuantity,
      totalInputAmount,
      totalOutputQuantity,
      totalMixRatio,
      totalPricePerKg,
      lines,
      residualQuantity,
      residualAmount,
      yield: yieldRatio,
      loss,
    });
  }

  groups.sort((a, b) => a.order.localeCompare(b.order));

  return { stage: "302", groups };
}
