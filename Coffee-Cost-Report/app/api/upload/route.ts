import { NextResponse } from "next/server";
import { Mb51ParseError, parseMb51Workbook } from "@/lib/parse";
import { saveLatestUpload } from "@/lib/store";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์ที่อัปโหลด" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  try {
    const rows = parseMb51Workbook(buffer);
    await saveLatestUpload({
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      rows,
    });
    return NextResponse.json({ ok: true, rowCount: rows.length });
  } catch (err) {
    if (err instanceof Mb51ParseError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "อ่านไฟล์ไม่สำเร็จ กรุณาตรวจสอบรูปแบบไฟล์" }, { status: 500 });
  }
}
