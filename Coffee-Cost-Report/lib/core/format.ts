export function formatNumber(n: number | null, digits = 2): string {
  if (n === null || Number.isNaN(n)) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(n: number | null, digits = 2): string {
  if (n === null || Number.isNaN(n)) return "-";
  return `${(n * 100).toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}
