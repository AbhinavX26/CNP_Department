import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

export const NAVIGATION = [
  { id: 'dashboard',     label: 'Dashboard',         icon: '📊', path: '/dashboard',         roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'clubs',         label: 'Clubs',             icon: '🏛', path: '/clubs',             roles: ['student', 'faculty_coordinator', 'club_admin', 'project_admin'] },
  { id: 'projects',      label: 'Projects',          icon: '📋', path: '/projects',          roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'events',        label: 'Events',            icon: '📅', path: '/events',            roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'notifications', label: 'Notifications',     icon: '🔔', path: '/notifications',     roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  { id: 'inventory',     label: 'Inventory',         icon: '📦', path: '/inventory',         roles: ['project_admin'] },
  { id: 'requests',      label: 'Material Requests', icon: '🛒', path: '/material-requests', roles: ['project_admin'] },
  { id: 'profile',       label: 'Profile',           icon: '👤', path: '/profile',           roles: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] }
];

/* Line icons (24px grid) so the navy sidebar stays crisp and on-brand; replaces emoji glyphs. */
const NAV_ICON_PATHS: Record<string, string> = {
  dashboard: 'M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5ZM13 9h7V4h-7v5Z',
  clubs: 'M3 10 12 4l9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18',
  projects: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM6 6h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 6h6m-6 4h4',
  events: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm-1 5h16M8 3v4m8-4v4',
  notifications: 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  inventory: 'm4 8 8-4 8 4-8 4-8-4Zm0 0v8l8 4m8-12v8l-8 4m0-8v8',
  requests: 'M4 5h2l2 10h9l2-7H7M10 20h.01M17 20h.01',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
};

function NavIcon({ id }: { id: string }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={NAV_ICON_PATHS[id]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  // After signing out, go to the public landing page (not the login form).
  const handleSignOut = () => {
    navigate('/', { replace: true });
    logout();
  };

  return (
    <nav className="main-sidebar">
      <div className="brand">
        <div className="dot"></div>
        <span>CNP Portal</span>
      </div>

      <div className="nav-links">
        {NAVIGATION.filter(nav => nav.roles.includes(user.role)).map(nav => (
          <NavLink
            key={nav.id}
            to={nav.path}
            className={({ isActive }) => `main-nav-btn ${isActive ? 'active' : ''}`}
          >
            <NavIcon id={nav.id} /> {nav.label}
          </NavLink>
        ))}
      </div>

      <div className="user-indicator">
        <div className="user-info">
          {user.profileImage ? (
            <img src={user.profileImage} alt="Profile" className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder">{user.name.charAt(0)}</div>
          )}
          <div className="user-meta">
            <span className="user-name" title={user.name}>{user.name}</span>
            <span className="user-role">{user.role.replace('_', ' ')}</span>
          </div>
        </div>
        <button className="btn btn-outline btn-sm sign-out-btn" onClick={handleSignOut}>Sign Out</button>
      </div>
    </nav>
  );
}
