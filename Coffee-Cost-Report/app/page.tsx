import { loadLatestUpload, loadStdMaster, loadUnitWeightMaster } from "@/lib/store";
import ReportView from "@/components/ReportView";

export default async function Home() {
  const [batch, stdMaster, unitWeightMaster] = await Promise.all([
    loadLatestUpload(),
    loadStdMaster(),
    loadUnitWeightMaster(),
  ]);

  return <ReportView initialBatch={batch} initialStdMaster={stdMaster} initialUnitWeightMaster={unitWeightMaster} />;
}
