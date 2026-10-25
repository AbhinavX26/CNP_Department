import { Link } from 'react-router-dom';
import { WelcomeOrbit } from './WelcomeOrbit';

interface LandingHeroProps {
  signedIn: boolean;
}

export function LandingHero({ signedIn }: LandingHeroProps) {
  return (
    <section className="landing-hero" id="top">
      <div className="landing-stars" aria-hidden="true" />
      <div className="landing-stage">
        <WelcomeOrbit />
        <div className="landing-welcome">
          <h1>
            Welcome to the <span>CNP Department</span>
          </h1>
          <p>
            One place where Student Managed Clubs and GUIITAR Projects get organised, resourced and seen.
          </p>
          <Link className="landing-cta" to={signedIn ? '/dashboard' : '/login'}>
            {signedIn ? 'Go to your dashboard' : 'Log in to get started'}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
      <a className="landing-scroll" href="#about" aria-label="Scroll to learn more">
        <span />
      </a>
    </section>
  );
}
