import { loadStdMaster, loadUnitWeightMaster } from "@/lib/persistence/store";
import { findMovements } from "@/lib/database/mb51Repository";
import { requireCprOneUser } from "@/lib/auth/session";
import type { RawMovementRow } from "@/lib/core/types";
import ReportView from "@/components/ReportView";

// อ่าน MB51 ใหม่ทุก request (RPA ลงข้อมูลรายวัน)
export const dynamic = "force-dynamic";

const LOAD_FAILED_MESSAGE = "ไม่สามารถโหลดข้อมูลจากฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง";

async function loadMovements(): Promise<{ rows: RawMovementRow[]; skipped: number; error: string | null }> {
  try {
    const { rows, skipped } = await findMovements();
    return { rows, skipped, error: null };
  } catch (error) {
    console.error("[page] findMovements", error);
    return { rows: [], skipped: 0, error: LOAD_FAILED_MESSAGE };
  }
}

export default async function Home() {
  await requireCprOneUser();

  const [movements, stdMaster, unitWeightMaster] = await Promise.all([
    loadMovements(),
    loadStdMaster(),
    loadUnitWeightMaster(),
  ]);

  return (
    <ReportView
      rows={movements.rows}
      skippedRows={movements.skipped}
      loadError={movements.error}
      initialStdMaster={stdMaster}
      initialUnitWeightMaster={unitWeightMaster}
    />
  );
}
