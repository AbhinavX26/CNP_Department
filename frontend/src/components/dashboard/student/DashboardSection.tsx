import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface DashboardSectionProps {
  id: string;
  eyebrow?: string;
  title: string;
  count?: number;
  meta?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
}

export function PanelError({ message }: { message: string }) {
  return (
    <div className="ui-empty" role="alert">
      <p>{message}</p>
    </div>
  );
}

export function DashboardSection({
  id,
  eyebrow,
  title,
  count,
  meta,
  actionLabel,
  actionTo,
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
            {meta ? (
              <span className="student-dash-count" aria-label={meta}>
                {meta}
              </span>
            ) : null}
          </div>
        </div>
        {actionLabel && actionTo ? (
          <Link to={actionTo} className="btn btn-ghost btn-sm student-dash-section-action">
            {actionLabel}
          </Link>
        ) : actionLabel && onAction ? (
          <button type="button" className="btn btn-ghost btn-sm student-dash-section-action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}
