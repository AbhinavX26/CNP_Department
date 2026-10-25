import { useNavigate } from 'react-router-dom';
import { StudentProjectCard } from '../legacy/StudentProjectCard';
import { DashboardSection } from './DashboardSection';
import type { StudentProjectWithMentors } from '../../../types/studentDashboard';

interface StudentProjectsProps {
  projects: StudentProjectWithMentors[];
  currentUserId: string;
  error?: string;
}

export function StudentProjects({ projects, currentUserId, error }: StudentProjectsProps) {
  const navigate = useNavigate();

  return (
    <DashboardSection
      id="student-projects"
      eyebrow="GUIITAR"
      title="Your projects"
      count={projects.length}
      actionLabel="Browse all projects →"
      onAction={() => navigate('/projects')}
    >
      {error ? (
        <div className="student-dash-inline-error" role="alert">
          {error}
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div className="student-cards-grid">
          {projects.map((project) => (
            <StudentProjectCard
              key={project._id}
              project={project}
              currentUserId={currentUserId}
              onClick={() => navigate(`/projects/${project._id}`)}
            />
          ))}
        </div>
      ) : (
        !error && (
          <div className="student-dash-empty">
            <p className="student-dash-empty-title">No project assignments yet</p>
            <p className="student-dash-empty-body">
              GUIITAR projects connect you with faculty mentors and teammates on real campus innovation work.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/projects')}>
              View open projects
            </button>
          </div>
        )
      )}
    </DashboardSection>
  );
}
