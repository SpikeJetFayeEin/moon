type InsightPanelItem = {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "bad" | "accent";
};

type InsightPanelProps = {
  title: string;
  description?: string;
  items: InsightPanelItem[];
  footnote?: string;
};

export function InsightPanel({ title, description, items, footnote }: InsightPanelProps) {
  return (
    <aside className="insight-panel">
      <div className="panel-heading compact">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="insight-list">
        {items.map((item) => (
          <div className={`insight-row ${item.tone ?? "neutral"}`} key={`${item.label}-${item.value}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail ? <small>{item.detail}</small> : null}
          </div>
        ))}
      </div>
      {footnote ? <p className="source-note">{footnote}</p> : null}
    </aside>
  );
}
