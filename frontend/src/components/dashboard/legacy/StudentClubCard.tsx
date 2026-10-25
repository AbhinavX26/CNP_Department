import { useState } from 'react';
import { avatarInitials, avatarTone } from './avatarTone';

interface StudentClubCardProps {
  club: {
    _id: string;
    name: string;
    description?: string;
    logo?: string | null;
    coverImage?: string | null;
    images?: string[];
    facultyCoordinatorId?: {
      _id?: string;
      name?: string;
      department?: string;
      profileImage?: string | null;
    } | null;
  };
  membership: {
    membershipType: string;
    position?: string | null;
  };
  onClick: () => void;
}

export function StudentClubCard({ club, membership, onClick }: StudentClubCardProps) {
  const [logoError, setLogoError] = useState(false);
  const [coordImgError, setCoordImgError] = useState(false);

  const isCoreTeam = membership.membershipType === 'core_team';
  const positionText = isCoreTeam
    ? (membership.position && membership.position.toLowerCase() !== 'member'
        ? `Core Team • ${membership.position}`
        : 'Core Team')
    : 'Member';

  const coordinator =
    typeof club.facultyCoordinatorId === 'object' && club.facultyCoordinatorId !== null
      ? club.facultyCoordinatorId
      : null;

  const coordInitial = avatarInitials(coordinator?.name, 'FC');

  // Use the club's actual image URL from the database
  const clubImage = club.logo || club.coverImage || (club.images && club.images.length > 0 ? club.images[0] : null);

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
      {/* Top Header: 84x84 Logo on upper-left + Name & Membership status beneath on right */}
      <div className="student-card-header">
        {clubImage && !logoError ? (
          <img
            src={clubImage}
            alt={club.name}
            onError={() => setLogoError(true)}
            className="student-card-thumb"
          />
        ) : (
          <div className="student-card-thumb student-card-thumb-fallback">
            🏛
          </div>
        )}

        <div className="student-card-title-group">
          <h3 className="student-card-title" title={club.name}>
            {club.name}
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
      <p className="student-card-desc" title={club.description}>
        {club.description || 'No description provided.'}
      </p>

      {/* Divider */}
      <div className="student-card-divider">
        <div className="student-card-footer-label">Faculty Coordinator</div>

        {coordinator?.name ? (
          <div className="student-card-person-row">
            {coordinator.profileImage && !coordImgError ? (
              <img
                src={coordinator.profileImage}
                alt={coordinator.name}
                onError={() => setCoordImgError(true)}
                className="student-card-person-avatar"
              />
            ) : (
              <div
                className="student-card-person-avatar student-card-avatar-fallback"
                style={{ background: avatarTone(coordinator.name), color: '#fff', borderColor: 'transparent' }}
              >
                {coordInitial}
              </div>
            )}
            <div className="student-card-person-info">
              <div className="student-card-person-name" title={coordinator.name}>
                {coordinator.name}
              </div>
              <div className="student-card-person-dept" title={coordinator.department || 'Faculty Coordinator'}>
                {coordinator.department || 'Faculty Coordinator'}
              </div>
            </div>
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
              <div className="student-card-person-dept">Department Coordinator</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
