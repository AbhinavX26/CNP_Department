import type { User } from '../../../types';

interface StudentDashboardHeaderProps {
  user: User;
  unreadCount: number;
  onExploreClubs: () => void;
  onExploreProjects: () => void;
  onNotifications: () => void;
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function contextLine(user: User): string {
  const parts: string[] = [];
  if (user.department?.trim()) parts.push(user.department.trim());
  if (user.semester) parts.push(`Semester ${user.semester}`);
  if (user.enrollmentNumber?.trim()) parts.push(user.enrollmentNumber.trim());
  return parts.length ? parts.join(' · ') : 'Student Managed Clubs & GUIITAR';
}

export function StudentDashboardHeader({
  user,
  unreadCount,
  onExploreClubs,
  onExploreProjects,
  onNotifications,
}: StudentDashboardHeaderProps) {
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  return (
    <header className="student-dash-header">
      <div className="student-dash-header-copy">
        <p className="student-dash-eyebrow">{formatToday()}</p>
        <h2 className="student-dash-title">
          Welcome back, <span className="student-dash-title-accent">{firstName}</span>
        </h2>
        <p className="student-dash-lede">{contextLine(user)}</p>
      </div>
      <div className="student-dash-header-actions">
        <button
          type="button"
          className="student-dash-notification-link"
          onClick={onNotifications}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Notifications</span>
          {unreadCount > 0 ? <span className="student-dash-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onExploreClubs}>
          Explore clubs
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onExploreProjects}>
          Explore projects
        </button>
      </div>
    </header>
  );
}
