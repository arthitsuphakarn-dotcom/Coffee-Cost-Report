import { NextResponse } from "next/server";
import { setUnitWeightMasterEntry } from "@/lib/store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const material = typeof body?.material === "string" ? body.material : null;
  const grams = typeof body?.grams === "number" ? body.grams : null;

  if (!material || grams === null || Number.isNaN(grams)) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (grams <= 0) {
    return NextResponse.json({ error: "น้ำหนักต่อหน่วยต้องมากกว่า 0" }, { status: 400 });
  }

  const updated = await setUnitWeightMasterEntry(material, grams);
  return NextResponse.json({ ok: true, unitWeightMaster: updated });
}
