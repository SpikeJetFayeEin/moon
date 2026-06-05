export type MetricStripItem = {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "bad" | "accent";
};

type MetricStripProps = {
  items: MetricStripItem[];
  className?: string;
};

export function MetricStrip({ items, className = "" }: MetricStripProps) {
  return (
    <section className={`metric-strip ${className}`.trim()}>
      {items.map((item) => (
        <div className={`metric-tile ${item.tone ?? "neutral"}`} key={`${item.label}-${item.value}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </div>
      ))}
    </section>
  );
}
