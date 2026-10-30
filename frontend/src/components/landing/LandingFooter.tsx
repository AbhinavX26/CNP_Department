import { Link } from 'react-router-dom';
import { LANDING_LINKS } from './landingLinks';
import type { NavItem } from './LandingNav';

interface LandingFooterProps {
  links?: NavItem[];
}

/** Colophon: who the page belongs to, its sections, and the way back to the top. */
export function LandingFooter({ links = LANDING_LINKS }: LandingFooterProps = {}) {
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <p className="landing-colophon">
          <span className="landing-colophon-name">CNP Department</span> · GSFC University, Vadodara.
          Student Managed Clubs and GUIITAR Projects, run in one place.
        </p>

        <div className="landing-footer-rail">
          <nav className="landing-footer-links" aria-label="Sections">
            {links.map((l) =>
              l.to ? (
                <Link key={l.label} to={l.to}>{l.label}</Link>
              ) : (
                <a key={l.label} href={l.href}>{l.label}</a>
              )
            )}
          </nav>
          <a className="landing-top" href="#top">
            Back to top<span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
