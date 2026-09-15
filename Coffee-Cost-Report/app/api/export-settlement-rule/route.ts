import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { computeSettlementRuleReport } from "@/lib/reports/settlementRuleReport";
import { buildSettlementRuleWorkbook } from "@/lib/exports/exportSettlementRuleReport";
import { loadStdMaster } from "@/lib/persistence/store";
import { findMovements } from "@/lib/database/mb51Repository";
import { rejectWithoutSession } from "@/lib/auth/session";

/** Export Settlement Rule — ใช้ 301 ทั้งหมด ไม่กรองเดือน (เป็น cross-tab รายปี) */
export async function GET() {
  const unauthorized = await rejectWithoutSession();
  if (unauthorized) return unauthorized;

  let rows, stdMaster;
  try {
    [{ rows }, stdMaster] = await Promise.all([findMovements({ stages: ["301"] }), loadStdMaster()]);
  } catch (error) {
    console.error("[GET /api/export-settlement-rule]", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "ไม่พบข้อมูล 301 ในฐานข้อมูล" }, { status: 404 });
  }

  const report = computeSettlementRuleReport(rows, stdMaster);
  const workbook = buildSettlementRuleWorkbook(report);

  const arrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([arrayBuffer]);

  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="settlement-rule-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
