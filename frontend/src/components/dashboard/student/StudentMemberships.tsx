import { useNavigate } from 'react-router-dom';
import { StudentClubCard } from '../legacy/StudentClubCard';
import { DashboardSection } from './DashboardSection';
import type { StudentClubMembership } from '../../../types/studentDashboard';

interface StudentMembershipsProps {
  clubs: StudentClubMembership[];
  error?: string;
}

export function StudentMemberships({ clubs, error }: StudentMembershipsProps) {
  const navigate = useNavigate();

  return (
    <DashboardSection
      id="student-clubs"
      eyebrow="Communities"
      title="Your clubs"
      count={clubs.length}
      actionLabel="Browse all clubs →"
      onAction={() => navigate('/clubs')}
    >
      {error ? (
        <div className="student-dash-inline-error" role="alert">
          {error}
        </div>
      ) : null}

      {clubs.length > 0 ? (
        <div className="student-cards-grid">
          {clubs.map(({ club, membership }) => (
            <StudentClubCard
              key={club._id}
              club={club}
              membership={membership}
              onClick={() => navigate(`/clubs/${club._id}`)}
            />
          ))}
        </div>
      ) : (
        !error && (
          <div className="student-dash-empty">
            <p className="student-dash-empty-title">No club memberships yet</p>
            <p className="student-dash-empty-body">
              Discover student-managed clubs, meet members, and join communities that match your interests.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/clubs')}>
              Find a club
            </button>
          </div>
        )
      )}
    </DashboardSection>
  );
}
