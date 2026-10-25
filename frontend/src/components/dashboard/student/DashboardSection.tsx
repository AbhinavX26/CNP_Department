import type { ReactNode } from 'react';

interface DashboardSectionProps {
  id: string;
  eyebrow?: string;
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({
  id,
  eyebrow,
  title,
  count,
  actionLabel,
  onAction,
  children,
  className = '',
}: DashboardSectionProps) {
  return (
    <section
      className={`student-dash-section ${className}`.trim()}
      aria-labelledby={`${id}-heading`}
    >
      <header className="student-dash-section-head">
        <div className="student-dash-section-titles">
          {eyebrow ? <p className="student-dash-eyebrow">{eyebrow}</p> : null}
          <div className="student-dash-section-title-row">
            <h2 id={`${id}-heading`} className="student-dash-section-title">
              {title}
            </h2>
            {typeof count === 'number' ? (
              <span className="student-dash-count" aria-label={`${count} items`}>
                {count}
              </span>
            ) : null}
          </div>
        </div>
        {actionLabel && onAction ? (
          <button type="button" className="btn btn-ghost btn-sm student-dash-section-action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}
