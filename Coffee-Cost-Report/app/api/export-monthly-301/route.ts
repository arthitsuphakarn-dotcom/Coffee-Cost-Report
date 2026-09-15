import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { computeMonthly301Summary } from "@/lib/reports/monthly301Summary";
import { buildMonthly301Workbook } from "@/lib/exports/exportMonthly301Summary";
import { monthKeyOf } from "@/lib/core/dates";
import { loadStdMaster } from "@/lib/persistence/store";
import { findMovements } from "@/lib/database/mb51Repository";
import { rejectWithoutSession } from "@/lib/auth/session";

/** Export "สรุปรายเดือน 301" — ?from=&to=YYYY-MM ไม่ใส่ = ทุกเดือน */
export async function GET(request: Request) {
  const unauthorized = await rejectWithoutSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  let allRows, stdMaster;
  try {
    // อ่านทั้ง stage รอบเดียว เพราะต้องใช้ทั้งช่วงที่เลือกและ set เต็ม (หาชื่อ material)
    [{ rows: allRows }, stdMaster] = await Promise.all([findMovements({ stages: ["301"] }), loadStdMaster()]);
  } catch (error) {
    console.error("[GET /api/export-monthly-301]", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }

  if (allRows.length === 0) {
    return NextResponse.json({ error: "ไม่พบข้อมูล 301 ในฐานข้อมูล" }, { status: 404 });
  }

  const rangeRows =
    from && to
      ? allRows.filter((r) => {
          const mk = monthKeyOf(r.postingDate);
          return mk >= from && mk <= to;
        })
      : allRows;

  const summary = computeMonthly301Summary(rangeRows, stdMaster, allRows);
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
