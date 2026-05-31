export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}
