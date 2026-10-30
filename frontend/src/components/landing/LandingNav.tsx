import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { LANDING_LINKS } from './landingLinks';

export type NavItem = { label: string; href?: string; to?: string };

interface LandingNavProps {
  signedIn?: boolean;
  links?: NavItem[];
  brandTo?: string;
  showBackHome?: boolean;
}

/**
 * Top Navigation Bar matching the Dashboard shell theme and typography.
 */
export function LandingNav({ signedIn, links = LANDING_LINKS, brandTo, showBackHome }: LandingNavProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const brandContent = (
    <>
      <img
        className="landing-brand-logo"
        src="/branding/cnp-community-emblem.png"
        alt="CNP"
        width={73}
        height={32}
        loading="eager"
        decoding="async"
      />
      <span className="landing-brand-name">CNP Department</span>
      <span className="landing-brand-place">GSFC University</span>
    </>
  );

  return (
    <header className="landing-nav">
      <div className="landing-nav-inner landing-container">
        {brandTo ? (
          <Link className="landing-brand" to={brandTo} aria-label="CNP Department home">
            {brandContent}
          </Link>
        ) : (
          <a className="landing-brand" href="#top" aria-label="CNP Department home">
            {brandContent}
          </a>
        )}

        <nav className="landing-nav-links" aria-label="Sections">
          {links.map((l) =>
            l.to ? (
              <Link key={l.label} to={l.to}>{l.label}</Link>
            ) : (
              <a key={l.label} href={l.href}>{l.label}</a>
            )
          )}
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-theme-pill"
            role="switch"
            aria-checked={isDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {isDark ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
                </svg>
                <span>Light mode</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 14.2A8 8 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" />
                </svg>
                <span>Dark mode</span>
              </>
            )}
          </button>

          {showBackHome ? (
            <>
              <Link className="landing-back-pill" to="/" aria-label="Back to Homepage">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                  <path d="M15 10H5M10 15l-5-5 5-5" />
                </svg>
                <span>Back to Homepage</span>
              </Link>
              <Link className="landing-login-pill" to="/login">
                Login
              </Link>
            </>
          ) : (
            <Link className="landing-login-pill" to={signedIn ? "/dashboard" : "/login"}>
              Login
            </Link>
          )}
        </div>
      </div>
      <span className="landing-nav-progress" aria-hidden="true" />
    </header>
  );
}
