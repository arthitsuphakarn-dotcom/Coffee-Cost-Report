import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { computeSettlementRuleReport } from "@/lib/settlementRuleReport";
import { buildSettlementRuleWorkbook } from "@/lib/exportSettlementRuleReport";
import { loadLatestUpload, loadStdMaster } from "@/lib/store";

/**
 * Settlement Rule Report export (opened from the 301 tab's "Settlement Rule"
 * column header). Deliberately covers the whole uploaded dataset, not a
 * month range — it's a yearly cross-tab (see lib/settlementRuleReport.ts).
 */
export async function GET() {
  const [batch, stdMaster] = await Promise.all([loadLatestUpload(), loadStdMaster()]);
  if (!batch) {
    return NextResponse.json({ error: "ยังไม่มีข้อมูลที่อัปโหลด" }, { status: 404 });
  }

  const report = computeSettlementRuleReport(batch.rows, stdMaster);
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
