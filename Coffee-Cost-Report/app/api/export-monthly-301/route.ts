import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { computeMonthly301Summary } from "@/lib/monthly301Summary";
import { buildMonthly301Workbook } from "@/lib/exportMonthly301Summary";
import { monthKeyOf } from "@/lib/dates";
import { loadLatestUpload, loadStdMaster } from "@/lib/store";

/**
 * "สรุปรายเดือน 301" export. `?from=YYYY-MM&to=YYYY-MM` narrows to that
 * month range (mirrors the report page's top filter, which is what drives
 * the on-screen summary); omit both to export every month in the upload.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [batch, stdMaster] = await Promise.all([loadLatestUpload(), loadStdMaster()]);
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

  // 3rd arg = full upload for description lookup (rows may be a narrowed
  // month range that omits a grade entirely — it still gets a row).
  const summary = computeMonthly301Summary(rows, stdMaster, batch.rows);
  const workbook = buildMonthly301Workbook(summary);

  const arrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([arrayBuffer]);

  const suffix = from && to ? (from === to ? `-${from}` : `-${from}_to_${to}`) : "";
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="monthly-301-summary${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
