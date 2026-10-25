import type { StudentJoinRequest } from '../../../types/studentDashboard';

interface StudentOverviewProps {
  clubCount: number;
  projectCount: number;
  pendingRequestCount: number;
  unreadNotifications: number;
}

export function StudentOverview({
  clubCount,
  projectCount,
  pendingRequestCount,
  unreadNotifications,
}: StudentOverviewProps) {
  const involvement =
    clubCount === 0 && projectCount === 0
      ? 'You are not in any clubs or projects yet—explore campus communities and GUIITAR teams when you are ready.'
      : `You are active in ${clubCount} ${clubCount === 1 ? 'club' : 'clubs'} and ${projectCount} ${projectCount === 1 ? 'project' : 'projects'}.`;

  const attention: string[] = [];
  if (pendingRequestCount > 0) {
    attention.push(
      `${pendingRequestCount} join ${pendingRequestCount === 1 ? 'request awaits' : 'requests await'} a decision`
    );
  }
  if (unreadNotifications > 0) {
    attention.push(`${unreadNotifications} unread ${unreadNotifications === 1 ? 'notification' : 'notifications'}`);
  }
  return (
    <div className="student-dash-overview" role="region" aria-label="Your overview">
      <p className="student-dash-overview-summary">{involvement}</p>
      {attention.length > 0 ? (
        <ul className="student-dash-overview-attention">
          {attention.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="student-dash-overview-quiet">No pending requests or unread alerts right now.</p>
      )}
    </div>
  );
}

export function countPendingRequests(requests: StudentJoinRequest[]): number {
  return requests.filter((r) => r.status === 'pending').length;
}
