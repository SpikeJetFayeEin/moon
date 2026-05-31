type MetricCardProps = {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
};

export function MetricCard({ label, value, tone = "neutral" }: MetricCardProps) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
