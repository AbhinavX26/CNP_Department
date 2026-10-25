import { useNavigate } from 'react-router-dom';
import type { User } from '../../types';
import { useStudentDashboardData } from '../../hooks/useStudentDashboardData';
import { DashboardSkeleton } from '../../components/dashboard/student/DashboardSkeleton';
import { StudentDashboardHeader } from '../../components/dashboard/student/StudentDashboardHeader';
import { StudentMemberships } from '../../components/dashboard/student/StudentMemberships';
import { StudentNotificationSummary } from '../../components/dashboard/student/StudentNotificationSummary';
import { StudentOverview, countPendingRequests } from '../../components/dashboard/student/StudentOverview';
import { StudentProjects } from '../../components/dashboard/student/StudentProjects';
import { StudentRequests } from '../../components/dashboard/student/StudentRequests';
import { StudentUpcomingEvents } from '../../components/dashboard/student/StudentUpcomingEvents';

interface StudentDashboardPageProps {
  user: User;
}

export function StudentDashboardPage({ user }: StudentDashboardPageProps) {
  const navigate = useNavigate();
  const data = useStudentDashboardData(user);

  if (data.loading) return <DashboardSkeleton />;

  const pendingRequests = countPendingRequests(data.joinRequests);
  const hasErrors = Object.values(data.errors).some(Boolean);

  return (
    <div className="student-dash">
      <StudentDashboardHeader
        user={user}
        unreadCount={data.unreadCount}
        onExploreClubs={() => navigate('/clubs')}
        onExploreProjects={() => navigate('/projects')}
        onNotifications={() => navigate('/notifications')}
      />

      {!data.errors.clubs && !data.errors.projects && !data.errors.requests && !data.errors.notifications ? (
        <StudentOverview
          clubCount={data.clubs.length}
          projectCount={data.projects.length}
          pendingRequestCount={pendingRequests}
          unreadNotifications={data.unreadCount}
        />
      ) : null}

      {hasErrors ? (
        <div className="student-dash-refresh-note" role="status">
          <span>Some dashboard details couldn’t be refreshed.</span>
          <button type="button" onClick={() => void data.refetch()}>Try again</button>
        </div>
      ) : null}

      <div className="student-dash-layout">
        <div className="student-dash-main">
          <StudentMemberships clubs={data.clubs} error={data.errors.clubs} />
          <StudentProjects
            projects={data.projects}
            currentUserId={user._id}
            error={data.errors.projects}
          />
        </div>

        <aside className="student-dash-aside" aria-label="Campus updates">
          <StudentUpcomingEvents events={data.upcomingEvents} error={data.errors.events} />
          <StudentRequests requests={data.joinRequests} error={data.errors.requests} />
          <StudentNotificationSummary
            unreadCount={data.unreadCount}
            notifications={data.notifications}
            error={data.errors.notifications}
          />
        </aside>
      </div>
    </div>
  );
}
