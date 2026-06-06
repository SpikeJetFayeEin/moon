import type { ReactNode } from "react";

type QueryStatePanelProps = {
  title: string;
  description?: string;
  tone?: "loading" | "empty" | "error";
  action?: ReactNode;
  className?: string;
};

export function QueryStatePanel({
  title,
  description,
  tone = "empty",
  action,
  className = "",
}: QueryStatePanelProps) {
  return (
    <section className={`state-panel ${tone} ${className}`.trim()}>
      <div className="state-panel-mark" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="state-panel-action">{action}</div> : null}
    </section>
  );
}
