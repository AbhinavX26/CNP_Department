import { useNavigate } from 'react-router-dom';
import type { StudentNotificationItem } from '../../../types/studentDashboard';

interface StudentNotificationSummaryProps {
  unreadCount: number;
  notifications: StudentNotificationItem[];
  error?: string;
}

export function StudentNotificationSummary({
  unreadCount,
  notifications,
  error,
}: StudentNotificationSummaryProps) {
  const navigate = useNavigate();
  const latest = notifications[0];

  return (
    <section className="student-dash-notifications" aria-labelledby="student-notifications-heading">
      <div className="student-dash-notifications-topline">
        <div>
          <p className="student-dash-eyebrow">Inbox</p>
          <h2 id="student-notifications-heading">Notifications</h2>
        </div>
        {unreadCount > 0 ? (
          <span className="student-dash-count" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="student-dash-inline-error" role="alert">{error}</p>
      ) : latest ? (
        <button
          type="button"
          className="student-dash-latest-notification"
          onClick={() => navigate(latest.link || '/notifications')}
        >
          <span className={`student-dash-notification-dot${latest.isRead ? ' is-read' : ''}`} aria-hidden="true" />
          <span className="student-dash-latest-copy">
            <strong>{latest.title}</strong>
            {latest.message ? <span>{latest.message}</span> : null}
          </span>
          <span className="student-dash-arrow" aria-hidden="true">→</span>
        </button>
      ) : (
        <p className="student-dash-aside-empty">You’re all caught up. New updates will appear here.</p>
      )}

      <button type="button" className="student-dash-inbox-link" onClick={() => navigate('/notifications')}>
        Open inbox <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
