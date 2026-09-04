import { FG_UNIT_WEIGHT_GRAMS } from "./fgUnitWeights";
import type { Order305Group, Order305Line, Order305Report, RawMovementRow, UnitWeightMaster } from "./types";

/**
 * Sheet 305 (ห้อง Repacking, "CPR"/retail-repack line) — verified against
 * both reference files 2026-08-26 (see docs/source-analysis.md). Each order
 * consumes one BAG-denominated "blend" input (a finished bag product being
 * repacked/relabeled, e.g. "GOLD BLEND ALL CAFE' 500G") plus several PC/EA
 * packaging consumables (valve, film, box, sticker), and produces one or
 * more BAG output(s) — identified generically as "the input material whose
 * unit is BAG" (excludes the PC/EA consumables), same discipline as 303's
 * "the input material whose unit is KG" (holds for 29 of 31 orders checked
 * in the live reference data; the other 2 net to zero across every material
 * — fully-reversed orders with nothing to report — and are skipped by the
 * same empty-input/output-group check used everywhere else).
 *
 * Yield is weight-based, not a raw bag-count ratio: input and output bag
 * sizes aren't always equal (some orders repack one 500g bag into two 250g
 * bags), which would show as 200% "yield" under a naive count ratio — only
 * converting both sides to kg via grams-per-bag gives the right answer
 * (~100%). Reuses the same confirmed-table + editable-fallback pattern as
 * 303 (FG_UNIT_WEIGHT_GRAMS, falling back to the shared editable
 * UnitWeightMaster) for both the blend input's weight and each output's
 * weight — grams-per-bag is a property of the material code itself, so the
 * same table applies whether that code shows up as 303's output or 305's
 * input.
 *
 * Not implemented: the source sheet's ~10 hand-entered daily defect-reason
 * columns (QA เบิก, ห้องคั่ว(g)/ห้องแพ็ค(g), โรบอทตีแตก, วาล์วเสีย, ซองยับ,
 * นน.ขาด, ดับเบิ้ล, ซองวาล์วแตก, Repack) and its "check"/Diff columns — same
 * as 303, needs the pending on-site conversation with production/QA. Also
 * not implemented: the sheet's "สูตร CPR Coffee Bean" / "สูตร Calibrate"
 * rows below the pivot (rows 40-57 in the reference file) — a fixed-row
 * BOM/recipe reference table, not part of the per-order report and not
 * derivable per-order from MB51.
 */
export function computeOrder305Report(rows: RawMovementRow[], unitWeightMaster: UnitWeightMaster): Order305Report {
  const inScope = rows.filter((r) => r.order && r.order.startsWith("305"));

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

  const groups: Order305Group[] = [];
  const materialsMissingUnitWeightSet = new Set<string>();
  const byMaterialCode = (a: { row: RawMovementRow }, b: { row: RawMovementRow }) => a.row.material.localeCompare(b.row.material);
  const weightOf = (material: string) => FG_UNIT_WEIGHT_GRAMS[material] ?? unitWeightMaster[material] ?? null;

  for (const [order, entries] of byOrder) {
    const inputEntries = entries.filter((e) => e.quantity < 0).sort(byMaterialCode);
    const outputEntries = entries.filter((e) => e.quantity > 0).sort(byMaterialCode);
    const neutralEntries = entries.filter((e) => e.quantity === 0).sort(byMaterialCode);
    if (inputEntries.length === 0 || outputEntries.length === 0) continue;

    const bagInputs = inputEntries.filter((e) => e.row.eun === "BAG");
    const blendInput = bagInputs.length === 1 ? bagInputs[0] : null;

    const totalInputQuantity = inputEntries.reduce((s, e) => s + e.quantity, 0);
    const totalInputAmount = inputEntries.reduce((s, e) => s + e.amount, 0);
    const totalOutputQuantity = outputEntries.reduce((s, e) => s + e.quantity, 0);

    const outputG = totalOutputQuantity * 500;
    const outputKg = outputG / 1000;

    let missingUnitWeight = false;

    const inputUnitWeight = blendInput ? weightOf(blendInput.row.material) : null;
    if (blendInput && inputUnitWeight === null) {
      materialsMissingUnitWeightSet.add(blendInput.row.material);
      missingUnitWeight = true;
    }
    const inputWeightKg = blendInput && inputUnitWeight !== null ? (Math.abs(blendInput.quantity) * inputUnitWeight) / 1000 : null;

    const toLine = (
      e: { row: RawMovementRow; quantity: number; amount: number },
      role: Order305Line["role"],
      unitWeight: number | null,
      outputG: number | null = null,
      outputKg: number | null = null
    ): Order305Line => ({
      material: e.row.material,
      materialDescription: e.row.materialDescription,
      eun: e.row.eun,
      mvt: e.row.mvt,
      role,
      quantity: e.quantity,
      amount: e.amount,
      pricePerKg: e.quantity !== 0 ? e.amount / e.quantity : null,
      unitWeightGrams: unitWeight,
      outputG,
      outputKg,
    });

    let outputWeightKg: number | null = 0;
    const outputLines: Order305Line[] = [];
    for (const e of outputEntries) {
      const isBag = e.row.eun === "BAG";
      const unitWeight = isBag ? weightOf(e.row.material) : null;
      if (isBag && unitWeight === null) {
        materialsMissingUnitWeightSet.add(e.row.material);
        missingUnitWeight = true;
        outputWeightKg = null;
      } else if (isBag && outputWeightKg !== null) {
        outputWeightKg += (Math.abs(e.quantity) * unitWeight!) / 1000;
      }
      outputLines.push(toLine(e, "output", unitWeight, outputG, outputKg));
    }

    const lines: Order305Line[] = [
      ...inputEntries.map((e) => toLine(e, "input", e === blendInput ? inputUnitWeight : null)),
      ...outputLines,
      ...neutralEntries.map((e) => toLine(e, "neutral", null)),
    ];

    const yieldRatio =
      inputWeightKg !== null && inputWeightKg > 0 && outputWeightKg !== null ? outputWeightKg / inputWeightKg : null;
    const loss = yieldRatio !== null ? 1 - yieldRatio : null;
    const residualQuantity = entries.reduce((s, e) => s + e.quantity, 0);
    const residualAmount = entries.reduce((s, e) => s + e.amount, 0);

    groups.push({
      order,
      blendInputMaterial: blendInput?.row.material ?? null,
      blendInputQuantity: blendInput?.quantity ?? null,
      totalInputQuantity,
      totalInputAmount,
      totalOutputQuantity,
      lines,
      residualQuantity,
      residualAmount,
      inputWeightKg,
      // flat 500 g/bag mass — matches the table's per-row "G"/"KG" columns
      // (m.outputG / m.outputKg); distinct from the confirmed-weight
      // outputWeightKg used for yield.
      outputWeightG: outputG,
      outputWeightKg,
      yield: yieldRatio,
      loss,
      missingUnitWeight,
    });
  }

  groups.sort((a, b) => a.order.localeCompare(b.order));

  return { stage: "305", groups, materialsMissingUnitWeight: Array.from(materialsMissingUnitWeightSet).sort() };
}
