import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { LANDING_LINKS } from './landingLinks';

interface LandingNavProps {
  signedIn: boolean;
}

/**
 * Slab: one heavy graphite bar, edge to edge. Wordmark and place at the left, the
 * page's four destinations at the right, one cobalt key for the way in.
 */
export function LandingNav({ signedIn }: LandingNavProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="landing-nav">
      <div className="landing-nav-inner landing-container">
        <a className="landing-brand" href="#top" aria-label="CNP Department home">
          <img
            className="landing-brand-logo"
            src="/branding/cnp-community-emblem.png"
            alt="CNP"
            width={73}
            height={32}
            loading="eager"
            decoding="async"
          />
          <span className="landing-brand-name">Department</span>
          <span className="landing-brand-place">GSFC University</span>
        </a>

        <nav className="landing-nav-links" aria-label="Sections">
          {LANDING_LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-theme-toggle"
            role="switch"
            aria-checked={isDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {isDark ? (
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 14.2A8 8 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" />
              </svg>
            )}
          </button>

          {signedIn ? (
            <Link className="key key--primary key--sm landing-nav-key" to="/dashboard">
              Open dashboard
            </Link>
          ) : (
            <Link className="key key--primary key--sm landing-nav-key" to="/login">
              Log in
            </Link>
          )}
        </div>
      </div>
      <span className="landing-nav-progress" aria-hidden="true" />
    </header>
  );
}
