import { monthKeyOf } from "../core/dates";
import { FG_UNIT_WEIGHT_GRAMS } from "../core/fgUnitWeights";
import { stdPercentAsOf } from "../core/stdMaster";
import type {
  MaterialLine,
  Order302Group,
  Order302Line,
  Order302Report,
  Order303Group,
  Order303Line,
  Order303Report,
  Order305Group,
  Order305Line,
  Order305Report,
  OrderGroup,
  OrderStageReport,
  RawMovementRow,
  StagePrefix,
  StdMaster,
  UnitWeightMaster,
} from "../core/types";

type AggregatedEntry = { row: RawMovementRow; quantity: number; amount: number };

function aggregateByOrderMaterial(rows: RawMovementRow[], prefix: string): Map<string, AggregatedEntry[]> {
  const byOrderMaterial = new Map<string, AggregatedEntry>();
  for (const row of rows) {
    if (!row.order || !row.order.startsWith(prefix)) continue;
    const key = `${row.order}::${row.material}`;
    const existing = byOrderMaterial.get(key);
    if (existing) {
      existing.quantity += row.quantity;
      existing.amount += row.amount;
    } else {
      byOrderMaterial.set(key, { row, quantity: row.quantity, amount: row.amount });
    }
  }

  const byOrder = new Map<string, AggregatedEntry[]>();
  for (const entry of byOrderMaterial.values()) {
    const entries = byOrder.get(entry.row.order) ?? [];
    entries.push(entry);
    byOrder.set(entry.row.order, entries);
  }
  return byOrder;
}

function splitEntries(entries: AggregatedEntry[]) {
  const byMaterialCode = (a: AggregatedEntry, b: AggregatedEntry) => a.row.material.localeCompare(b.row.material);
  return {
    inputEntries: entries.filter((entry) => entry.quantity < 0).sort(byMaterialCode),
    outputEntries: entries.filter((entry) => entry.quantity > 0).sort(byMaterialCode),
    neutralEntries: entries.filter((entry) => entry.quantity === 0).sort(byMaterialCode),
  };
}

/** Calculates the 301 Preclean report, including STD-based cost allocation. */
export function computeOrderReport(stage: StagePrefix, rows: RawMovementRow[], stdMaster: StdMaster): OrderStageReport {
  const groups: OrderGroup[] = [];
  const materialsMissingStd = new Set<string>();

  for (const [order, entries] of aggregateByOrderMaterial(rows, stage)) {
    const { inputEntries, outputEntries, neutralEntries } = splitEntries(entries);
    if (inputEntries.length === 0 || outputEntries.length === 0) continue;

    const totalInputQuantity = inputEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const totalInputAmount = inputEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const inputQuantityAbs = Math.abs(totalInputQuantity);
    const inputAmountAbs = Math.abs(totalInputAmount);
    const orderMonth = entries.reduce(
      (min, entry) => {
        const month = monthKeyOf(entry.row.postingDate);
        return min === null || month < min ? month : min;
      },
      null as string | null,
    )!;
    // Resolve each output's %STD once, so the completeness check below and
    // the reallocation further down can never disagree about what is known.
    const stdByMaterial = new Map<string, number | null>();
    for (const entry of outputEntries) {
      stdByMaterial.set(entry.row.material, stdPercentAsOf(stdMaster, entry.row.material, orderMonth));
    }
    const missingStd = outputEntries.some((entry) => stdByMaterial.get(entry.row.material) === null);
    const totalStdPercent = outputEntries.reduce(
      (sum, entry) => sum + (stdByMaterial.get(entry.row.material) ?? 0),
      0,
    );
    /**
     * Reallocating while any output still lacks a %STD would divide by a
     * partial denominator, so the whole order's cost lands on whichever
     * outputs happen to have a value — one 10% output would absorb 100% of it
     * and show a price/kg an order of magnitude above the real one. A blank is
     * the honest answer until the %STD master is complete for this order.
     */
    const canReallocate = !missingStd && totalStdPercent > 0;

    const inputLines: MaterialLine[] = inputEntries.map((entry) => ({
      material: entry.row.material,
      materialDescription: entry.row.materialDescription,
      eun: entry.row.eun,
      role: "input",
      quantity: entry.quantity,
      amount: entry.amount,
      pricePerKg: entry.quantity !== 0 ? entry.amount / entry.quantity : null,
      proportion: inputQuantityAbs > 0 ? Math.abs(entry.quantity) / inputQuantityAbs : null,
      stdPercent: null,
      reallocatedCost: null,
      reallocatedPricePerKg: null,
      settlementRule: null,
    }));

    const outputLines: MaterialLine[] = outputEntries.map((entry) => {
      const stdPercent = stdByMaterial.get(entry.row.material) ?? null;
      if (stdPercent === null) materialsMissingStd.add(entry.row.material);
      const proportion = inputQuantityAbs > 0 ? entry.quantity / inputQuantityAbs : null;
      const pricePerKg = entry.quantity !== 0 ? entry.amount / entry.quantity : null;
      const reallocatedCost = canReallocate && stdPercent !== null ? (inputAmountAbs * stdPercent) / totalStdPercent : null;
      return {
        material: entry.row.material,
        materialDescription: entry.row.materialDescription,
        eun: entry.row.eun,
        role: "output",
        quantity: entry.quantity,
        amount: entry.amount,
        pricePerKg,
        proportion,
        stdPercent,
        reallocatedCost,
        reallocatedPricePerKg: reallocatedCost !== null && entry.quantity !== 0 ? reallocatedCost / entry.quantity : null,
        settlementRule: proportion !== null ? Math.round(proportion * 100) / 100 : null,
      };
    });

    const neutralLines: MaterialLine[] = neutralEntries.map((entry) => ({
      material: entry.row.material,
      materialDescription: entry.row.materialDescription,
      eun: entry.row.eun,
      role: "neutral",
      quantity: entry.quantity,
      amount: entry.amount,
      pricePerKg: null,
      proportion: null,
      stdPercent: null,
      reallocatedCost: null,
      reallocatedPricePerKg: null,
      settlementRule: null,
    }));

    const totalYield = outputLines.reduce((sum, line) => sum + (line.proportion ?? 0), 0);
    groups.push({
      order,
      totalInputQuantity,
      totalInputAmount,
      semiQuantity: outputEntries.reduce((sum, entry) => sum + entry.quantity, 0),
      materials: [...inputLines, ...outputLines, ...neutralLines],
      inputSemiQuantity: inputEntries.reduce((sum, entry) => sum + Math.abs(entry.quantity), 0),
      totalReallocatedCost: canReallocate ? outputLines.reduce((sum, line) => sum + (line.reallocatedCost ?? 0), 0) : null,
      residualQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      residualAmount: entries.reduce((sum, entry) => sum + entry.amount, 0),
      totalYield,
      totalLoss: 1 - totalYield,
      totalSettlement: outputLines.reduce((sum, line) => sum + (line.settlementRule ?? 0), 0),
      totalStdPercent,
      missingStd,
    });
  }

  groups.sort((a, b) => a.order.localeCompare(b.order));
  return { stage, groups, materialsMissingStd: Array.from(materialsMissingStd).sort() };
}

/** Calculates the 302 Roasting blend ratios, yield and loss. */
export function computeOrder302Report(rows: RawMovementRow[]): Order302Report {
  const groups: Order302Group[] = [];
  for (const [order, entries] of aggregateByOrderMaterial(rows, "302")) {
    const { inputEntries, outputEntries, neutralEntries } = splitEntries(entries);
    if (inputEntries.length === 0 || outputEntries.length === 0) continue;

    const totalInputQuantity = inputEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const totalInputAmount = inputEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const totalOutputQuantity = outputEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const inputQuantityAbs = Math.abs(totalInputQuantity);
    const outputQuantityAbs = Math.abs(totalOutputQuantity);
    const toLine = (entry: AggregatedEntry, role: Order302Line["role"]): Order302Line => ({
      material: entry.row.material,
      materialDescription: entry.row.materialDescription,
      eun: entry.row.eun,
      role,
      quantity: entry.quantity,
      amount: entry.amount,
      pricePerKg: entry.quantity !== 0 ? entry.amount / entry.quantity : null,
      mixRatio: role === "input" && inputQuantityAbs > 0 ? Math.abs(entry.quantity) / inputQuantityAbs : null,
      outputRatio: outputQuantityAbs > 0 ? Math.abs(entry.quantity) / outputQuantityAbs : null,
    });
    const lines = [
      ...inputEntries.map((entry) => toLine(entry, "input")),
      ...outputEntries.map((entry) => toLine(entry, "output")),
      ...neutralEntries.map((entry) => toLine(entry, "neutral")),
    ];
    const yieldRatio = inputQuantityAbs > 0 ? outputQuantityAbs / inputQuantityAbs : null;
    const residualQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const residualAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
    groups.push({
      order,
      totalInputQuantity,
      totalInputAmount,
      totalOutputQuantity,
      totalMixRatio: Math.abs(residualQuantity) / Math.abs(totalInputQuantity),
      totalPricePerKg: Math.abs(residualAmount) / Math.abs(residualQuantity),
      lines,
      residualQuantity,
      residualAmount,
      yield: yieldRatio,
      loss: yieldRatio !== null ? 1 - yieldRatio : null,
    });
  }
  groups.sort((a, b) => a.order.localeCompare(b.order));
  return { stage: "302", groups };
}

/** Calculates the 303 Packaging weight-based yield. */
export function computeOrder303Report(rows: RawMovementRow[], unitWeightMaster: UnitWeightMaster): Order303Report {
  const groups: Order303Group[] = [];
  const materialsMissingUnitWeight = new Set<string>();
  for (const [order, entries] of aggregateByOrderMaterial(rows, "303")) {
    const { inputEntries, outputEntries, neutralEntries } = splitEntries(entries);
    if (inputEntries.length === 0 || outputEntries.length === 0) continue;
    const kgInputs = inputEntries.filter((entry) => entry.row.eun === "KG");
    const blendInput = kgInputs.length === 1 ? kgInputs[0] : null;
    const lines: Order303Line[] = inputEntries.map((entry) => ({
      material: entry.row.material,
      materialDescription: entry.row.materialDescription,
      eun: entry.row.eun,
      role: "input",
      quantity: entry.quantity,
      amount: entry.amount,
      pricePerKg: entry.quantity !== 0 ? entry.amount / entry.quantity : null,
      unitWeightGrams: null,
    }));
    let outputWeightKg: number | null = 0;
    for (const entry of outputEntries) {
      const unitWeight = FG_UNIT_WEIGHT_GRAMS[entry.row.material] ?? unitWeightMaster[entry.row.material] ?? null;
      if (unitWeight === null) {
        materialsMissingUnitWeight.add(entry.row.material);
        outputWeightKg = null;
      } else if (outputWeightKg !== null) {
        outputWeightKg += (Math.abs(entry.quantity) * unitWeight) / 1000;
      }
      lines.push({
        material: entry.row.material,
        materialDescription: entry.row.materialDescription,
        eun: entry.row.eun,
        role: "output",
        quantity: entry.quantity,
        amount: entry.amount,
        pricePerKg: entry.quantity !== 0 ? entry.amount / entry.quantity : null,
        unitWeightGrams: unitWeight,
      });
    }
    lines.push(...neutralEntries.map((entry) => ({
      material: entry.row.material,
      materialDescription: entry.row.materialDescription,
      eun: entry.row.eun,
      role: "neutral" as const,
      quantity: entry.quantity,
      amount: entry.amount,
      pricePerKg: null,
      unitWeightGrams: null,
    })));
    const yieldRatio = blendInput && outputWeightKg !== null && blendInput.quantity !== 0
      ? outputWeightKg / Math.abs(blendInput.quantity)
      : null;
    groups.push({
      order,
      blendInputMaterial: blendInput?.row.material ?? null,
      blendInputQuantity: blendInput?.quantity ?? null,
      lines,
      residualQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      residualAmount: entries.reduce((sum, entry) => sum + entry.amount, 0),
      outputWeightKg,
      yield: yieldRatio,
      loss: yieldRatio !== null ? 1 - yieldRatio : null,
      missingUnitWeight: outputEntries.some((entry) => (FG_UNIT_WEIGHT_GRAMS[entry.row.material] ?? unitWeightMaster[entry.row.material] ?? null) === null),
    });
  }
  groups.sort((a, b) => a.order.localeCompare(b.order));
  return { stage: "303", groups, materialsMissingUnitWeight: Array.from(materialsMissingUnitWeight).sort() };
}

/** Calculates the 305 Repacking weight-based yield. */
export function computeOrder305Report(rows: RawMovementRow[], unitWeightMaster: UnitWeightMaster): Order305Report {
  const groups: Order305Group[] = [];
  const materialsMissingUnitWeight = new Set<string>();
  const weightOf = (material: string) => FG_UNIT_WEIGHT_GRAMS[material] ?? unitWeightMaster[material] ?? null;
  for (const [order, entries] of aggregateByOrderMaterial(rows, "305")) {
    const { inputEntries, outputEntries, neutralEntries } = splitEntries(entries);
    if (inputEntries.length === 0 || outputEntries.length === 0) continue;
    const bagInputs = inputEntries.filter((entry) => entry.row.eun === "BAG");
    const blendInput = bagInputs.length === 1 ? bagInputs[0] : null;
    const totalInputQuantity = inputEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const totalInputAmount = inputEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const totalOutputQuantity = outputEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    const outputWeightG = totalOutputQuantity * 500;
    const outputWeightFlatKg = outputWeightG / 1000;
    const inputUnitWeight = blendInput ? weightOf(blendInput.row.material) : null;
    let missingUnitWeight = false;
    if (blendInput && inputUnitWeight === null) {
      materialsMissingUnitWeight.add(blendInput.row.material);
      missingUnitWeight = true;
    }
    const inputWeightKg = blendInput && inputUnitWeight !== null ? (Math.abs(blendInput.quantity) * inputUnitWeight) / 1000 : null;
    const toLine = (entry: AggregatedEntry, role: Order305Line["role"], unitWeight: number | null, outputG: number | null = null, outputKg: number | null = null): Order305Line => ({
      material: entry.row.material,
      materialDescription: entry.row.materialDescription,
      eun: entry.row.eun,
      mvt: entry.row.mvt,
      role,
      quantity: entry.quantity,
      amount: entry.amount,
      pricePerKg: entry.quantity !== 0 ? entry.amount / entry.quantity : null,
      unitWeightGrams: unitWeight,
      outputG,
      outputKg,
    });
    let outputWeightKg: number | null = 0;
    const outputLines = outputEntries.map((entry) => {
      const isBag = entry.row.eun === "BAG";
      const unitWeight = isBag ? weightOf(entry.row.material) : null;
      if (isBag && unitWeight === null) {
        materialsMissingUnitWeight.add(entry.row.material);
        missingUnitWeight = true;
        outputWeightKg = null;
      } else if (isBag && outputWeightKg !== null) {
        outputWeightKg += (Math.abs(entry.quantity) * unitWeight!) / 1000;
      }
      return toLine(entry, "output", unitWeight, outputWeightG, outputWeightFlatKg);
    });
    const lines = [
      ...inputEntries.map((entry) => toLine(entry, "input", entry === blendInput ? inputUnitWeight : null)),
      ...outputLines,
      ...neutralEntries.map((entry) => toLine(entry, "neutral", null)),
    ];
    const yieldRatio = inputWeightKg !== null && inputWeightKg > 0 && outputWeightKg !== null ? outputWeightKg / inputWeightKg : null;
    groups.push({
      order,
      blendInputMaterial: blendInput?.row.material ?? null,
      blendInputQuantity: blendInput?.quantity ?? null,
      totalInputQuantity,
      totalInputAmount,
      totalOutputQuantity,
      lines,
      residualQuantity: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      residualAmount: entries.reduce((sum, entry) => sum + entry.amount, 0),
      inputWeightKg,
      outputWeightG,
      outputWeightKg,
      yield: yieldRatio,
      loss: yieldRatio !== null ? 1 - yieldRatio : null,
      missingUnitWeight,
    });
  }
  groups.sort((a, b) => a.order.localeCompare(b.order));
  return { stage: "305", groups, materialsMissingUnitWeight: Array.from(materialsMissingUnitWeight).sort() };
}
