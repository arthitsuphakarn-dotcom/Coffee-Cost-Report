import { NextResponse } from "next/server";
import { deleteStdMasterEntry, setStdMasterEntry } from "@/lib/store";

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const material = typeof body?.material === "string" ? body.material : null;
  const from = typeof body?.from === "string" ? body.from : null;
  const value = typeof body?.value === "number" ? body.value : null;

  if (!material || !from || !MONTH_KEY_RE.test(from) || value === null || Number.isNaN(value)) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (value < 0 || value > 100) {
    return NextResponse.json({ error: "STD % ต้องอยู่ระหว่าง 0-100" }, { status: 400 });
  }

  const updated = await setStdMasterEntry(material, from, value);
  return NextResponse.json({ ok: true, stdMaster: updated });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const material = typeof body?.material === "string" ? body.material : null;
  const from = typeof body?.from === "string" ? body.from : null;

  if (!material || !from) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const updated = await deleteStdMasterEntry(material, from);
  return NextResponse.json({ ok: true, stdMaster: updated });
}
