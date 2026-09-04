import { FG_UNIT_WEIGHT_GRAMS } from "./fgUnitWeights";
import type { Order303Group, Order303Line, Order303Report, RawMovementRow, UnitWeightMaster } from "./types";

/**
 * Sheet 303 (ห้อง Packaging) — verified against the source workbook's own
 * formulas (see docs/source-analysis.md). Each order consumes: one
 * KG-denominated input (the roasted blend — this is what yield is measured
 * against) plus several PC/EA-denominated packaging consumables (box,
 * film, valve), and produces bagged output(s).
 *
 * Yield in the source (`=(E{output}*500/1000)/E{blendInput}`) hardcodes
 * "500" — grams per bag — per row, because every output material in this
 * reference file happens to be a 500g bag. Not safe to hardcode
 * generically, so per-material weight comes from `FG_UNIT_WEIGHT_GRAMS`
 * (lib/fgUnitWeights.ts) — a confirmed table the user gave directly
 * 2026-08-21, covering 8 of the 15 FG codes (7 at 500g, 1 at 250g). Any
 * FG material not in that table falls back to the editable
 * `UnitWeightMaster` (same UX as STD%) so an order with an unconfirmed
 * material is still usable once accounting fills it in, rather than
 * blocked. Note: the Summary Dashboard's own FG total uses the confirmed
 * table only, with no such fallback — the two calcs can diverge slightly
 * for orders touching a material outside the confirmed table.
 *
 * Deliberately NOT implemented: the source sheet's ~20 hand-entered daily
 * defect-reason columns (QA เบิก, ห้องคั่ว(g)/ห้องแพ็ค(g), โรบอทตีแตก,
 * วาล์วเสีย, ฟิล์มยับ, นน.ขาด, ดับเบิ้ล, ...) and its "check"/Diff columns
 * that reference them. Those need the on-site conversation with
 * production/QA the project docs already flag as still open — this
 * function only reproduces the parts of 303 that are genuinely
 * MB51-derivable, same discipline as 301/302.
 */
export function computeOrder303Report(rows: RawMovementRow[], unitWeightMaster: UnitWeightMaster): Order303Report {
  const inScope = rows.filter((r) => r.order && r.order.startsWith("303"));

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

  const groups: Order303Group[] = [];
  const materialsMissingUnitWeightSet = new Set<string>();
  const byMaterialCode = (a: { row: RawMovementRow }, b: { row: RawMovementRow }) => a.row.material.localeCompare(b.row.material);

  for (const [order, entries] of byOrder) {
    const inputEntries = entries.filter((e) => e.quantity < 0).sort(byMaterialCode);
    const outputEntries = entries.filter((e) => e.quantity > 0).sort(byMaterialCode);
    const neutralEntries = entries.filter((e) => e.quantity === 0).sort(byMaterialCode);
    if (inputEntries.length === 0 || outputEntries.length === 0) continue;

    const kgInputs = inputEntries.filter((e) => e.row.eun === "KG");
    const blendInput = kgInputs.length === 1 ? kgInputs[0] : null;

    const lines: Order303Line[] = [];
    for (const e of inputEntries) {
      lines.push({
        material: e.row.material,
        materialDescription: e.row.materialDescription,
        eun: e.row.eun,
        role: "input",
        quantity: e.quantity,
        amount: e.amount,
        pricePerKg: e.quantity !== 0 ? e.amount / e.quantity : null,
        unitWeightGrams: null,
      });
    }
    let outputWeightKg: number | null = 0;
    for (const e of outputEntries) {
      const unitWeight = FG_UNIT_WEIGHT_GRAMS[e.row.material] ?? unitWeightMaster[e.row.material] ?? null;
      if (unitWeight === null) {
        materialsMissingUnitWeightSet.add(e.row.material);
        outputWeightKg = null;
      } else if (outputWeightKg !== null) {
        outputWeightKg += (Math.abs(e.quantity) * unitWeight) / 1000;
      }
      lines.push({
        material: e.row.material,
        materialDescription: e.row.materialDescription,
        eun: e.row.eun,
        role: "output",
        quantity: e.quantity,
        amount: e.amount,
        pricePerKg: e.quantity !== 0 ? e.amount / e.quantity : null,
        unitWeightGrams: unitWeight,
      });
    }
    for (const e of neutralEntries) {
      lines.push({
        material: e.row.material,
        materialDescription: e.row.materialDescription,
        eun: e.row.eun,
        role: "neutral",
        quantity: e.quantity,
        amount: e.amount,
        pricePerKg: null,
        unitWeightGrams: null,
      });
    }

    const yieldRatio =
      blendInput && outputWeightKg !== null && blendInput.quantity !== 0 ? outputWeightKg / Math.abs(blendInput.quantity) : null;
    const loss = yieldRatio !== null ? 1 - yieldRatio : null;
    const residualQuantity = entries.reduce((s, e) => s + e.quantity, 0);
    const residualAmount = entries.reduce((s, e) => s + e.amount, 0);

    groups.push({
      order,
      blendInputMaterial: blendInput?.row.material ?? null,
      blendInputQuantity: blendInput?.quantity ?? null,
      lines,
      residualQuantity,
      residualAmount,
      outputWeightKg,
      yield: yieldRatio,
      loss,
      missingUnitWeight: outputEntries.some((e) => (FG_UNIT_WEIGHT_GRAMS[e.row.material] ?? unitWeightMaster[e.row.material] ?? null) === null),
    });
  }

  groups.sort((a, b) => a.order.localeCompare(b.order));

  return { stage: "303", groups, materialsMissingUnitWeight: Array.from(materialsMissingUnitWeightSet).sort() };
}
