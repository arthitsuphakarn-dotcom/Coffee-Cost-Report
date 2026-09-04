import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { computeOrderReport } from "@/lib/pivotOrderReport";
import { computeOrder302Report } from "@/lib/pivot302";
import { computeOrder303Report } from "@/lib/pivot303";
import { computeOrder305Report } from "@/lib/pivot305";
import { buildReportWorkbook } from "@/lib/exportReport";
import { buildReport302Workbook } from "@/lib/exportReport302";
import { buildReport303Workbook } from "@/lib/exportReport303";
import { buildReport305Workbook } from "@/lib/exportReport305";
import { monthKeyOf } from "@/lib/dates";
import { loadLatestUpload, loadStdMaster, loadUnitWeightMaster } from "@/lib/store";
import { STAGE_PREFIXES, type StagePrefix } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stageParam = searchParams.get("stage") ?? "301";
  if (!STAGE_PREFIXES.includes(stageParam as StagePrefix)) {
    return NextResponse.json({ error: `stage ต้องเป็นหนึ่งใน ${STAGE_PREFIXES.join(", ")}` }, { status: 400 });
  }
  const stage = stageParam as StagePrefix;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [batch, stdMaster, unitWeightMaster] = await Promise.all([
    loadLatestUpload(),
    loadStdMaster(),
    loadUnitWeightMaster(),
  ]);
  if (!batch) {
    return NextResponse.json({ error: "ยังไม่มีข้อมูลที่อัปโหลด" }, { status: 404 });
  }

  const rows =
    from && to
      ? batch.rows.filter((r) => {
          const mk = monthKeyOf(r.postingDate);
          return mk >= from && mk <= to;
        })
      : batch.rows;

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
