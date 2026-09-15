import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { computeOrderReport, computeOrder302Report, computeOrder303Report, computeOrder305Report } from "@/lib/reports/pivot";
import { buildReportWorkbook } from "@/lib/exports/exportReport";
import { buildReport302Workbook } from "@/lib/exports/exportReport302";
import { buildReport303Workbook } from "@/lib/exports/exportReport303";
import { buildReport305Workbook } from "@/lib/exports/exportReport305";
import { loadStdMaster, loadUnitWeightMaster } from "@/lib/persistence/store";
import { findMovements } from "@/lib/database/mb51Repository";
import { STAGE_PREFIXES, type StagePrefix } from "@/lib/core/types";
import { rejectWithoutSession } from "@/lib/auth/session";

/** Export รายสเตจ — ใช้ findMovements() ตัวเดียวกับหน้าเว็บ */
export async function GET(request: Request) {
  const unauthorized = await rejectWithoutSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const stageParam = searchParams.get("stage") ?? "301";
  if (!STAGE_PREFIXES.includes(stageParam as StagePrefix)) {
    return NextResponse.json({ error: `stage ต้องเป็นหนึ่งใน ${STAGE_PREFIXES.join(", ")}` }, { status: 400 });
  }
  const stage = stageParam as StagePrefix;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  let rows, stdMaster, unitWeightMaster;
  try {
    [{ rows }, stdMaster, unitWeightMaster] = await Promise.all([
      findMovements({ stages: [stage], from, to }),
      loadStdMaster(),
      loadUnitWeightMaster(),
    ]);
  } catch (error) {
    console.error(`[GET /api/export?stage=${stage}]`, error);
    return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: `ไม่พบข้อมูล ${stage} ในฐานข้อมูล` }, { status: 404 });
  }

  const workbook =
    stage === "302"
      ? buildReport302Workbook(computeOrder302Report(rows))
      : stage === "303"
        ? buildReport303Workbook(computeOrder303Report(rows, unitWeightMaster))
        : stage === "305"
          ? buildReport305Workbook(computeOrder305Report(rows, unitWeightMaster))
          : buildReportWorkbook(computeOrderReport(stage, rows, stdMaster));

  const arrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([arrayBuffer]);

  const monthSuffix = from && to ? (from === to ? `-${from}` : `-${from}_to_${to}`) : "";
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="coffee-cost-report-${stage}${monthSuffix}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
