import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { StdEntry, StdMaster, UnitWeightMaster, UploadBatch } from "./types";

/**
 * File-backed persistence for phase 1. The accounting team currently gets
 * MB51 data as a one-off Excel export; a future phase will feed this from
 * the RPA job that already lands MB51 into a database daily (Day-1 data).
 * Every read/write goes through the functions below so that swap is a
 * matter of reimplementing this module, not touching callers.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOAD_FILE = path.join(DATA_DIR, "latest-upload.json");
const STD_FILE = path.join(DATA_DIR, "std-master.json");
const UNIT_WEIGHT_FILE = path.join(DATA_DIR, "unit-weight-master.json");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function saveLatestUpload(batch: UploadBatch): Promise<void> {
  await ensureDataDir();
  await writeFile(UPLOAD_FILE, JSON.stringify(batch, null, 2), "utf-8");
}

export async function loadLatestUpload(): Promise<UploadBatch | null> {
  try {
    const raw = await readFile(UPLOAD_FILE, "utf-8");
    return JSON.parse(raw) as UploadBatch;
  } catch {
    return null;
  }
}

/** Pre-effective-dating files stored `{ material: number }`. Migrated on read
 * to a single entry effective "from the beginning of time" — a sentinel `from`
 * that string-sorts before any real "YYYY-MM" — so every past month keeps
 * resolving to the same value it always did, with no need to know the actual
 * first month of data at migration time. */
const LEGACY_SENTINEL_FROM = "0000-01";

export async function loadStdMaster(): Promise<StdMaster> {
  try {
    const raw = await readFile(STD_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, number | StdEntry[]>;
    const migrated: StdMaster = {};
    for (const [material, value] of Object.entries(parsed)) {
      migrated[material] = typeof value === "number" ? [{ from: LEGACY_SENTINEL_FROM, value }] : value;
    }
    return migrated;
  } catch {
    return {};
  }
}

export async function setStdMasterEntry(material: string, from: string, value: number): Promise<StdMaster> {
  await ensureDataDir();
  const current = await loadStdMaster();
  const existing = current[material] ?? [];
  const withoutSameMonth = existing.filter((e) => e.from !== from);
  const updated: StdMaster = {
    ...current,
    [material]: [...withoutSameMonth, { from, value }].sort((a, b) => a.from.localeCompare(b.from)),
  };
  await writeFile(STD_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function deleteStdMasterEntry(material: string, from: string): Promise<StdMaster> {
  await ensureDataDir();
  const current = await loadStdMaster();
  const existing = current[material] ?? [];
  const updated: StdMaster = { ...current, [material]: existing.filter((e) => e.from !== from) };
  await writeFile(STD_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function loadUnitWeightMaster(): Promise<UnitWeightMaster> {
  try {
    const raw = await readFile(UNIT_WEIGHT_FILE, "utf-8");
    return JSON.parse(raw) as UnitWeightMaster;
  } catch {
    return {};
  }
}

export async function setUnitWeightMasterEntry(material: string, grams: number): Promise<UnitWeightMaster> {
  await ensureDataDir();
  const current = await loadUnitWeightMaster();
  const updated = { ...current, [material]: grams };
  await writeFile(UNIT_WEIGHT_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
