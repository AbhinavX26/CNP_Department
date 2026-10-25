import { useNavigate } from 'react-router-dom';
import { DashboardSection } from './DashboardSection';
import type { StudentJoinRequest } from '../../../types/studentDashboard';

interface StudentRequestsProps {
  requests: StudentJoinRequest[];
  error?: string;
}

function requestTargetName(req: StudentJoinRequest): string {
  if (req.clubId && typeof req.clubId === 'object' && req.clubId.name) return req.clubId.name;
  if (req.projectId && typeof req.projectId === 'object' && req.projectId.name) return req.projectId.name;
  return 'Unknown';
}

function requestKind(req: StudentJoinRequest): 'Club' | 'Project' {
  return req.clubId ? 'Club' : 'Project';
}

function statusClass(status: string): string {
  if (status === 'pending') return 'student-dash-status student-dash-status--pending';
  if (status === 'approved') return 'student-dash-status student-dash-status--approved';
  if (status === 'rejected') return 'student-dash-status student-dash-status--rejected';
  return 'student-dash-status';
}

export function StudentRequests({ requests, error }: StudentRequestsProps) {
  const navigate = useNavigate();
  const pending = requests.filter((r) => r.status === 'pending');
  const recent = requests.filter((r) => r.status !== 'pending').slice(0, 3);
  const display = [...pending, ...recent].slice(0, 5);

  return (
    <DashboardSection
      id="student-requests"
      eyebrow="Pipeline"
      title="Join requests"
      count={requests.length > 0 ? requests.length : undefined}
      actionLabel={requests.length > 0 ? 'View all →' : undefined}
      onAction={() => navigate('/notifications')}
    >
      {error ? (
        <div className="student-dash-inline-error" role="alert">
          {error}
        </div>
      ) : display.length === 0 ? (
        !error && (
          <p className="student-dash-aside-empty">
            No join requests on file. Apply from a club or project page when you find a fit.
          </p>
        )
      ) : (
        <ul className="student-dash-request-list">
          {display.map((req) => {
            const kind = requestKind(req);
            const targetId =
              kind === 'Club'
                ? typeof req.clubId === 'object'
                  ? req.clubId?._id
                  : req.clubId
                : typeof req.projectId === 'object'
                  ? req.projectId?._id
                  : req.projectId;

            return (
              <li key={req._id}>
                <button
                  type="button"
                  className="student-dash-request-row"
                  onClick={() => {
                    if (targetId) navigate(kind === 'Club' ? `/clubs/${targetId}` : `/projects/${targetId}`);
                  }}
                  disabled={!targetId}
                >
                  <span className="student-dash-request-kind">{kind}</span>
                  <span className="student-dash-request-name">{requestTargetName(req)}</span>
                  <span className={statusClass(req.status)}>{req.status}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}
