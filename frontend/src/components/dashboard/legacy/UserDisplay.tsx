import type { User } from '../../../types';

interface UserDisplayProps {
  user: User | any; // To accept populated mongoose objects which might not perfectly match User
  showRole?: boolean;
  showEmail?: boolean;
  showDepartment?: boolean;
  showSemester?: boolean;
  showEnrollmentNumber?: boolean;
}

export function UserDisplay({
  user,
  showRole = false,
  showEmail = true,
  showDepartment = true,
  showSemester = true,
  showEnrollmentNumber = true,
}: UserDisplayProps) {
  if (!user || !user.name) return <span>Unknown User</span>;

  const isStudent = user.role === 'student';
  const shouldShowDept = showDepartment && user.department;
  const shouldShowSem = showSemester && isStudent && user.semester;
  const shouldShowEnr = showEnrollmentNumber && isStudent && user.enrollmentNumber;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{user.name}</span>
        {showRole && user.role && (
          <span className={`badge badge-${user.role.replace('_', '-')}`} style={{ fontSize: '11px', padding: '2px 6px' }}>
            {user.role.replace('_', ' ')}
          </span>
        )}
      </div>
      
      {showEmail && user.email && (
        <a href={`mailto:${user.email}`} style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}>
          {user.email}
        </a>
      )}
      
      {(shouldShowEnr || shouldShowDept || shouldShowSem) && (
        <div style={{ fontSize: '13px', color: 'var(--text-faint)', marginTop: '2px' }}>
          {shouldShowEnr && <span>Enrollment: {user.enrollmentNumber}</span>}
          {shouldShowEnr && (shouldShowDept || shouldShowSem) && <span> &middot; </span>}
          {shouldShowDept && <span>{user.department}</span>}
          {shouldShowDept && shouldShowSem && <span> &middot; </span>}
          {shouldShowSem && <span>Semester {user.semester}</span>}
        </div>
      )}
    </div>
  );
}
