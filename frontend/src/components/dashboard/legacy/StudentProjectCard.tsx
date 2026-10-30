import { useState } from 'react';
import { avatarInitials, avatarTone } from './avatarTone';

interface ProjectMentorInfo {
  _id?: string;
  isPrimary?: boolean;
  mentorId?: {
    _id?: string;
    name?: string;
    department?: string;
    profileImage?: string | null;
  } | null;
}

interface StudentProjectCardProps {
  project: {
    _id: string;
    name: string;
    description?: string;
    image?: string | null;
    status?: string;
    teamLeaderId?: string | { _id?: string } | null;
    mentors?: ProjectMentorInfo[];
  };
  currentUserId?: string;
  onClick: () => void;
}

function MentorAvatar({ src, name, size = 34 }: { src?: string | null; name?: string; size?: number }) {
  const [error, setError] = useState(false);
  const initial = avatarInitials(name, 'FC');

  if (src && !error) {
    return (
      <img
        src={src}
        alt={name || 'Mentor'}
        onError={() => setError(true)}
        className="student-card-person-avatar"
        style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px` }}
      />
    );
  }

  return (
    <div
      className="student-card-person-avatar student-card-avatar-fallback"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        fontSize: `${Math.round(size * 0.38)}px`,
        background: avatarTone(name),
        color: '#fff',
        borderColor: 'transparent',
      }}
    >
      {initial}
    </div>
  );
}

export function StudentProjectCard({ project, currentUserId, onClick }: StudentProjectCardProps) {
  const [imageError, setImageError] = useState(false);

  // Determine Team Leader status strictly from current project's teamLeaderId
  const tlId =
    typeof project.teamLeaderId === 'object' && project.teamLeaderId !== null
      ? project.teamLeaderId._id
      : project.teamLeaderId;

  const isTeamLeader = Boolean(currentUserId && tlId && String(tlId) === String(currentUserId));
  const positionText = isTeamLeader ? 'Team Leader' : 'Team Member';

  const mentors = project.mentors || [];
  const hasMentors = mentors.length > 0;
  const isMultipleMentors = mentors.length > 1;

  return (
    <div
      className="student-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Top Header: 84x84 Image on left + Name & Position beneath on right */}
      <div className="student-card-header">
        {project.image && !imageError ? (
          <img
            src={project.image}
            alt={project.name}
            onError={() => setImageError(true)}
            className="student-card-thumb-project"
          />
        ) : (
          <div className="student-card-thumb-project student-card-thumb-fallback">
            🏛
          </div>
        )}

        <div className="student-card-title-group">
          <h3 className="student-card-title" title={project.name}>
            {project.name}
          </h3>
          <div className="student-card-badges">
            <span className="badge badge-core-team">
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'currentColor',
                  display: 'inline-block',
                }}
              />
              {positionText}
            </span>
          </div>
        </div>
      </div>

      {/* Description below heading area */}
      <p className="student-card-desc" title={project.description}>
        {project.description || 'No description provided.'}
      </p>

      {/* Divider */}
      <div className="student-card-divider">
        <div className="student-card-footer-label">
          {isMultipleMentors ? 'Faculty Coordinators' : 'Faculty Coordinator'}
        </div>

        {hasMentors ? (
          <div className="student-card-mentors-list">
            {mentors.map((m, idx) => {
              const mentor = typeof m.mentorId === 'object' && m.mentorId !== null ? m.mentorId : null;
              if (!mentor) return null;

              return (
                <div key={m._id || idx} className="student-card-person-row">
                  <MentorAvatar
                    src={mentor.profileImage}
                    name={mentor.name}
                    size={isMultipleMentors ? 32 : 34}
                  />
                  <div className="student-card-person-info">
                    <div className="student-card-person-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span title={mentor.name}>{mentor.name}</span>
                      {m.isPrimary && isMultipleMentors && (
                        <span className="badge-mentor-primary">Primary</span>
                      )}
                    </div>
                    <div className="student-card-person-dept" title={mentor.department || 'Faculty Coordinator'}>
                      {mentor.department || 'Faculty Coordinator'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="student-card-person-row">
            <div className="student-card-person-avatar student-card-avatar-fallback" style={{ opacity: 0.6 }}>
              —
            </div>
            <div className="student-card-person-info">
              <div className="student-card-person-name" style={{ color: 'var(--text-faint)' }}>
                Not Assigned
              </div>
              <div className="student-card-person-dept">Assigned Mentor</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
