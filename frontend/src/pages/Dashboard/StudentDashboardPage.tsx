import { useNavigate } from 'react-router-dom';
import type { User } from '../../types';
import { useStudentDashboardData } from '../../hooks/useStudentDashboardData';
import { DashboardSkeleton } from '../../components/dashboard/student/DashboardSkeleton';
import { StudentDashboardHeader } from '../../components/dashboard/student/StudentDashboardHeader';
import { StudentUpcomingEvents } from '../../components/dashboard/student/StudentUpcomingEvents';
import { StudentRequests } from '../../components/dashboard/student/StudentRequests';
import { OverviewPanel, ClubsPanel, ProjectsPanel } from '../../components/dashboard/student/insights/panels';

interface StudentDashboardPageProps {
  user: User;
}

export function StudentDashboardPage({ user }: StudentDashboardPageProps) {
  const navigate = useNavigate();
  const data = useStudentDashboardData(user);

  if (data.loading) return <DashboardSkeleton />;

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

      {hasErrors ? (
        <div className="student-dash-refresh-note" role="status">
          <span>Some dashboard details couldn’t be refreshed.</span>
          <button type="button" onClick={() => void data.refetch()}>Try again</button>
        </div>
      ) : null}

      <div className="student-dash-layout">
        <div className="student-dash-main">
          <OverviewPanel data={data} />
          <ClubsPanel data={data} />
          <ProjectsPanel data={data} />
        </div>
        <aside className="student-dash-aside" aria-label="Campus updates">
          <StudentUpcomingEvents events={data.upcomingEvents} error={data.errors.events} />
          <StudentRequests requests={data.joinRequests} error={data.errors.requests} />
        </aside>
      </div>
    </div>
  );
}
