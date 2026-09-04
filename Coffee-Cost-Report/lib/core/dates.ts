// const THAI_MONTHS = [
//   "มกราคม",
//   "กุมภาพันธ์",
//   "มีนาคม",
//   "เมษายน",
//   "พฤษภาคม",
//   "มิถุนายน",
//   "กรกฎาคม",
//   "สิงหาคม",
//   "กันยายน",
//   "ตุลาคม",
//   "พฤศจิกายน",
//   "ธันวาคม",
// ];

const ENG_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-07-15" -> "2026-07" */
export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** "2026-07" -> "Jul 2026" */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const name = ENG_MONTHS[month - 1] ?? monthKey;
  return `${name} ${year}`;
}
