import type { ReactNode } from 'react';
import './insights.css';

/** One hue, dark to light. Series are told apart by lightness, never by a second colour. */
export const DARK = { label: '', dark: '#0c1a47', light: '#0462d3' };
export const MID = { label: '', dark: '#0462d3', light: '#6db2ff' };
export const LIGHT = { label: '', dark: '#7fb6ff', light: '#cfe3ff' };
export const series = (base: typeof DARK, label: string) => ({ ...base, label });
export const REQUEST_SERIES = [series(MID, 'Pending'), series(DARK, 'Approved'), series(LIGHT, 'Declined')];
export const ROLE_SERIES = [series(DARK, 'Core team / Leader'), series(LIGHT, 'Member')];

export type Icon = (props: { className?: string }) => ReactNode;

export const svg = (path: ReactNode): Icon => ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {path}
  </svg>
);
export const ClubIcon = svg(<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />);
export const ProjectIcon = svg(<path d="M9 4h6l1 2h3v14H5V6h3l1-2ZM9 12h6M9 16h4" />);
export const RequestIcon = svg(<path d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />);
export const BellIcon = svg(<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />);
export const StarIcon = svg(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />);
export const PeopleIcon = svg(<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6" />);

interface CardProps {
  title: string;
  sub?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  children: ReactNode;
}

export function Card({ title, sub, action, className = '', children }: CardProps) {
  return (
    <section className={`sdx-card ${className}`.trim()}>
      <header className="sdx-card-head">
        <div>
          <h3 className="sdx-card-title">{title}</h3>
          {sub ? <p className="sdx-card-sub">{sub}</p> : null}
        </div>
        {action ? (
          <button type="button" className="sdx-link" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function CardError({ message }: { message: string }) {
  return (
    <div className="sdx-error" role="alert">
      {message}
    </div>
  );
}

/** Status is read from the label; shade only separates live work from the rest. */
export function statusTone(status?: string): string {
  if (status === 'active') return 'deep';
  if (status === 'completed') return 'info';
  return 'plain';
}
