import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { STAGE_PREFIXES, type RawMovementRow, type StagePrefix } from "../core/types";
import { getDbPool } from "./connection";

const DEFAULT_TABLE_NAME = "mb51";
const DEFAULT_PLANT = "0328";
const TABLE_NAME_PATTERN = /^[A-Za-z0-9_]+$/;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;
const EMPTY_VALUE = "NULL";

const SELECT_COLUMNS = [
  "MB51_MATERIAL_CODE",
  "MB51_DESCRIPTION",
  "MB51_ORDER",
  "MB51_UNIT",
  "MB51_QUANTITY",
  "MB51_AMOUNT",
  "MB51_POSTING_DATE",
  "MB51_LOCATION",
  "MB51_MVT",
  "MB51_BATCH",
  "MB51_PLANT",
].join(", ");

interface Mb51Record extends RowDataPacket {
  MB51_MATERIAL_CODE: string | null;
  MB51_DESCRIPTION: string | null;
  MB51_ORDER: string | null;
  MB51_UNIT: string | null;
  MB51_QUANTITY: string | number | null;
  MB51_AMOUNT: string | number | null;
  MB51_POSTING_DATE: Date | string | null;
  MB51_LOCATION: string | null;
  MB51_MVT: string | null;
  MB51_BATCH: string | null;
  MB51_PLANT: string | null;
}

export interface MovementQuery {
  /** ไม่ระบุ = ทุก stage */
  stages?: readonly StagePrefix[];
  from?: string;
  to?: string;
}

export interface MovementQueryResult {
  rows: RawMovementRow[];
  /** แถวที่ถูกทิ้งเพราะ field จำเป็นไม่ครบ */
  skipped: number;
}

function getTableName(): string {
  const tableName = process.env.DB_MB51_TABLE ?? DEFAULT_TABLE_NAME;

  if (!TABLE_NAME_PATTERN.test(tableName)) {
    throw new Error("DB_MB51_TABLE must contain only letters, digits and underscores");
  }

  return tableName;
}

function getPlant(): string {
  return process.env.DB_MB51_PLANT ?? DEFAULT_PLANT;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).trim();
  return text === EMPTY_VALUE ? "" : text;
}

function toNumber(value: unknown): number | null {
  const text = toText(value).replace(/,/g, "");

  if (!text) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const matched = /^(\d{4}-\d{2}-\d{2})/.exec(toText(value));
  return matched ? matched[1] : null;
}

function toMovementRow(record: Mb51Record): RawMovementRow | null {
  const order = toText(record.MB51_ORDER);
  const material = toText(record.MB51_MATERIAL_CODE);
  const quantity = toNumber(record.MB51_QUANTITY);
  const amount = toNumber(record.MB51_AMOUNT);
  const postingDate = toIsoDate(record.MB51_POSTING_DATE);

  if (!order || !material || quantity === null || amount === null || !postingDate) {
    return null;
  }

  return {
    material,
    materialDescription: toText(record.MB51_DESCRIPTION),
    order,
    eun: toText(record.MB51_UNIT),
    quantity,
    amount,
    postingDate,
    sLoc: toText(record.MB51_LOCATION),
    mvt: toText(record.MB51_MVT),
    batch: toText(record.MB51_BATCH),
    plant: toText(record.MB51_PLANT),
  };
}

function isMovementRow(row: RawMovementRow | null): row is RawMovementRow {
  return row !== null;
}

function monthStart(monthKey: string): string {
  return `${monthKey}-01`;
}

/** ขอบบนแบบ exclusive เพื่อให้ครอบทั้งเดือน */
function nextMonthStart(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const rolls = month === 12;
  const nextYear = rolls ? year + 1 : year;
  const nextMonth = rolls ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function assertMonthKey(value: string, label: string): void {
  if (!MONTH_KEY_PATTERN.test(value)) {
    throw new Error(`${label} must be a "YYYY-MM" month key`);
  }
}

/** ทางเดียวที่แอปอ่าน MB51 — หน้าเว็บ, API และ Export ทุกตัวใช้ตัวนี้
 *  กรอง plant/stage/เดือน ที่ SQL ส่วนการแยก stage ให้ผู้เรียกทำเอง */
export async function findMovements(query: MovementQuery = {}): Promise<MovementQueryResult> {
  const stages = query.stages ?? STAGE_PREFIXES;

  if (stages.length === 0) {
    return { rows: [], skipped: 0 };
  }

  const conditions = [`MB51_PLANT = ?`];
  const params: string[] = [getPlant()];

  conditions.push(`(${stages.map(() => "MB51_ORDER LIKE ?").join(" OR ")})`);
  params.push(...stages.map((stage) => `${stage}%`));

  if (query.from) {
    assertMonthKey(query.from, "from");
    conditions.push("MB51_POSTING_DATE >= ?");
    params.push(monthStart(query.from));
  }
  if (query.to) {
    assertMonthKey(query.to, "to");
    conditions.push("MB51_POSTING_DATE < ?");
    params.push(nextMonthStart(query.to));
  }

  const sql = `
    SELECT ${SELECT_COLUMNS}
    FROM \`${getTableName()}\`
    WHERE ${conditions.join(" AND ")}
    ORDER BY MB51_ORDER, MB51_MATERIAL_CODE, MB51_POSTING_DATE
  `;

  const [records] = await getDbPool().query<Mb51Record[]>(sql, params);
  const rows = records.map(toMovementRow).filter(isMovementRow);
  const skipped = records.length - rows.length;

  if (skipped > 0) {
    console.warn(`[mb51] skipped ${skipped} of ${records.length} records with missing required fields`);
  }

  return { rows, skipped };
}
