import type { MaterialLine, OrderGroup, RawMovementRow, StagePrefix, StdMaster, OrderStageReport } from "./types";
import { monthKeyOf } from "./dates";
import { stdPercentAsOf } from "./stdMaster";

/**
 * Reproduces sheet "301" (ห้อง Preclean) from the reference workbook, and is
 * reused as-is (same math) for order prefixes 302/303/305 as a stand-in
 * until their real, stage-specific formulas and manual defect-entry columns
 * are confirmed on-site — see docs/source-analysis.md for what each real
 * sheet actually looks like.
 *
 * Pivots MB51 rows whose Order starts with the given prefix, grouped by
 * Order, then by Material within each Order. Materials with negative net
 * quantity in a group are "input" (issued to the order); positive are
 * "output" (received/graded out). An order can have more than one input
 * material (302/303 commonly do — e.g. 303's packaging orders consume the
 * box, film, and valve materials alongside the roasted blend) — every
 * material is kept as its own line, never merged away, so nothing silently
 * disappears from the report.
 *
 * Sign convention differs from the source workbook on purpose: the sheet
 * computed proportions as negative fractions (output / negative input).
 * Here ratios are expressed as positive 0..1 fractions, which is what the
 * numbers mean in practice — easier to read, same formulas otherwise. Raw
 * Quantity/Amount columns keep their real SAP sign (negative = issued),
 * matching what the source sheet actually shows.
 */
export function computeOrderReport(stage: StagePrefix, rows: RawMovementRow[], stdMaster: StdMaster): OrderStageReport {
  const inScope = rows.filter((r) => r.order && r.order.startsWith(stage));

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

  const groups: OrderGroup[] = [];
  const materialsMissingStdSet = new Set<string>();
  const byMaterialCode = (a: { row: RawMovementRow }, b: { row: RawMovementRow }) => a.row.material.localeCompare(b.row.material);

  for (const [order, entries] of byOrder) {
    const inputEntries = entries.filter((e) => e.quantity < 0).sort(byMaterialCode);
    const outputEntries = entries.filter((e) => e.quantity > 0).sort(byMaterialCode);
    const neutralEntries = entries.filter((e) => e.quantity === 0).sort(byMaterialCode);
    if (inputEntries.length === 0 || outputEntries.length === 0) {
      // Not a complete group (e.g. only an issue, no receipt yet) — skip for now.
      continue;
    }

    const totalInputQuantity = inputEntries.reduce((s, e) => s + e.quantity, 0);
    const totalInputAmount = inputEntries.reduce((s, e) => s + e.amount, 0);
    const totalInputQuantityAbs = Math.abs(totalInputQuantity);
    const totalInputAmountAbs = Math.abs(totalInputAmount);

    // Orders crossing a month boundary (rare) resolve %STD against their
    // earliest posting month, per the plan's decision.
    const orderMonth = entries.reduce(
      (min, e) => (min === null || monthKeyOf(e.row.postingDate) < min ? monthKeyOf(e.row.postingDate) : min),
      null as string | null,
    )!;

    const sumStd = outputEntries.reduce((s, e) => s + (stdPercentAsOf(stdMaster, e.row.material, orderMonth) ?? 0), 0);

    const inputLines: MaterialLine[] = inputEntries.map((e) => ({
      material: e.row.material,
      materialDescription: e.row.materialDescription,
      eun: e.row.eun,
      role: "input",
      quantity: e.quantity,
      amount: e.amount,
      pricePerKg: e.quantity !== 0 ? e.amount / e.quantity : null,
      proportion: totalInputQuantityAbs > 0 ? Math.abs(e.quantity) / totalInputQuantityAbs : null,
      stdPercent: null,
      reallocatedCost: null,
      reallocatedPricePerKg: null,
      settlementRule: null,
    }));

    const outputLines: MaterialLine[] = outputEntries.map((e) => {
      const stdPercent = stdPercentAsOf(stdMaster, e.row.material, orderMonth);
      if (stdPercent === null) materialsMissingStdSet.add(e.row.material);

      const proportion = totalInputQuantityAbs > 0 ? e.quantity / totalInputQuantityAbs : null;
      const pricePerKg = e.quantity !== 0 ? e.amount / e.quantity : null;
      const reallocatedCost = stdPercent !== null && sumStd > 0 ? (totalInputAmountAbs * stdPercent) / sumStd : null;
      const reallocatedPricePerKg = reallocatedCost !== null && e.quantity !== 0 ? reallocatedCost / e.quantity : null;
      const settlementRule = proportion !== null ? Math.round(proportion * 100) / 100 : null;

      return {
        material: e.row.material,
        materialDescription: e.row.materialDescription,
        eun: e.row.eun,
        role: "output",
        quantity: e.quantity,
        amount: e.amount,
        pricePerKg,
        proportion,
        stdPercent,
        reallocatedCost,
        reallocatedPricePerKg,
        settlementRule,
      };
    });

    const neutralLines: MaterialLine[] = neutralEntries.map((e) => ({
      material: e.row.material,
      materialDescription: e.row.materialDescription,
      eun: e.row.eun,
      role: "neutral",
      quantity: e.quantity,
      amount: e.amount,
      pricePerKg: null,
      proportion: null,
      stdPercent: null,
      reallocatedCost: null,
      reallocatedPricePerKg: null,
      settlementRule: null,
    }));

    const semiQuantity = outputEntries.reduce((s, e) => s + e.quantity, 0);
    const totalYield = outputLines.reduce((s, o) => s + (o.proportion ?? 0), 0);
    const totalLoss = 1 - totalYield;
    const totalSettlement = outputLines.reduce((s, o) => s + (o.settlementRule ?? 0), 0);
    const missingStd = outputLines.some((o) => o.stdPercent === null);
    const residualQuantity = entries.reduce((s, e) => s + e.quantity, 0);
    const residualAmount = entries.reduce((s, e) => s + e.amount, 0);


    const totalReallocatedCost = outputLines.reduce((s, o) => s + (o.reallocatedCost ?? 0), 0);
    const inputSemiQuantity = inputEntries.reduce((s, e) => s + Math.abs(e.quantity), 0);

    groups.push({
      order,
      totalInputQuantity,
      totalInputAmount,
      semiQuantity,
      materials: [...inputLines, ...outputLines, ...neutralLines],
      inputSemiQuantity,
      totalReallocatedCost,
      residualQuantity,
      residualAmount,
      totalYield,
      totalLoss,
      totalSettlement,
      totalStdPercent: sumStd,
      missingStd,
    });
  }

  groups.sort((a, b) => a.order.localeCompare(b.order));

  return {
    stage,
    groups,
    materialsMissingStd: Array.from(materialsMissingStdSet).sort(),
  };
}
