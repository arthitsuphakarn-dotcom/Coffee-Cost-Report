import * as XLSX from "xlsx";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const sourcePath = path.resolve(projectRoot, "..", "Reference-File", "mb51_plant0328.csv");
const outputPath = path.join(projectRoot, "data", "latest-upload.json");

const workbook = XLSX.read(await readFile(sourcePath, "utf8"), { type: "string", raw: true, cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const records = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

function text(value) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  return normalized === "NULL" ? "" : normalized;
}

function number(value) {
  const normalized = text(value).replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const rows = [];
let skippedNoOrder = 0;
let skippedInvalid = 0;

for (const record of records) {
  const order = text(record.MB51_ORDER);
  const material = text(record.MB51_MATERIAL_CODE);
  const quantity = number(record.MB51_QUANTITY);
  const amount = number(record.MB51_AMOUNT);
  const postingDate = text(record.MB51_POSTING_DATE);

  if (!material || quantity === null || amount === null || !/^\d{4}-\d{2}-\d{2}$/.test(postingDate)) {
    skippedInvalid += 1;
    continue;
  }
  if (!order) skippedNoOrder += 1;

  rows.push({
    material,
    materialDescription: text(record.MB51_DESCRIPTION),
    order,
    eun: text(record.MB51_UNIT),
    quantity,
    amount,
    postingDate,
    sLoc: text(record.MB51_LOCATION),
    mvt: text(record.MB51_MVT),
    batch: text(record.MB51_BATCH),
  });
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      fileName: "mb51_plant0328.csv",
      uploadedAt: new Date().toISOString(),
      rows,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`[MOCK] Source records: ${records.length}`);
console.log(`[MOCK] Imported rows: ${rows.length}`);
console.log(`[MOCK] Skipped without order: ${skippedNoOrder}`);
console.log(`[MOCK] Skipped invalid required data: ${skippedInvalid}`);
console.log(`[MOCK] Output: ${path.relative(projectRoot, outputPath)}`);