import { NextResponse } from "next/server";
import { STAGE_PREFIXES, type MovementsResponse, type StagePrefix } from "@/lib/core/types";
import { findMovements } from "@/lib/database/mb51Repository";
import { rejectWithoutSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const LOAD_FAILED_MESSAGE = "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง";

/** ?stage=301 | ?stage=301,302 | ไม่ใส่ = ทุก stage | ?from=&to=YYYY-MM
 *  หน้าเว็บอ่าน DB ตรงใน Server Component ตัวนี้ไว้ให้ระบบอื่นเรียก */
export async function GET(request: Request) {
  const unauthorized = await rejectWithoutSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);

  const stageParam = searchParams.get("stage");
  let stages: StagePrefix[] | undefined;

  if (stageParam) {
    stages = stageParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as StagePrefix[];

    const invalid = stages.filter((s) => !STAGE_PREFIXES.includes(s));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `stage ต้องเป็นหนึ่งใน ${STAGE_PREFIXES.join(", ")} (ได้รับ: ${invalid.join(", ")})` },
        { status: 400 }
      );
    }
  }

  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  try {
    const { rows, skipped } = await findMovements({ stages, from, to });

    return NextResponse.json<MovementsResponse>({ count: rows.length, skipped, data: rows });
  } catch (error) {
    console.error("[GET /api/reports]", error);

    // from/to ผิดรูปแบบ = ความผิดฝั่งผู้เรียก
    const message = error instanceof Error ? error.message : "";
    if (message.includes("month key")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: LOAD_FAILED_MESSAGE }, { status: 500 });
  }
}
