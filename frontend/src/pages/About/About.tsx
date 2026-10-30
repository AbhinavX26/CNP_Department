import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LandingNav, type NavItem } from '../../components/landing/LandingNav';
import { LandingFooter } from '../../components/landing/LandingFooter';
import { DEVELOPERS, type Developer } from '../About/developers';
import './aboutus.css';

const NAV: NavItem[] = [
  { label: 'Home', to: '/' },
  { label: 'About CNP', href: '#about' },
  { label: 'Our Objective', href: '#objective' },
  { label: 'Our Team', href: '#team' },
  { label: 'Academic Project', href: '#academic' },
];

const OBJECTIVES = [
  { title: 'Clubs', text: 'Run Student Managed Clubs, their members and their join requests from one place.' },
  { title: 'Projects', text: 'Keep GUIITAR projects, mentors, updates and materials organised and visible.' },
  { title: 'Tasks', text: 'Know who is doing what, so teams stay coordinated and on schedule.' },
  { title: 'Events', text: 'Plan, announce and follow events without chasing messages across chats.' },
  { title: 'Achievements', text: 'Give the work students do a record that can be seen and recognised.' },
];

const STACK = ['React', 'TypeScript', 'Node.js', 'Express', 'MongoDB'];

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fades each `.au-reveal` in once, as it first enters the viewport. */
function useReveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.au-reveal'));
    if (reducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/**
 * Scroll-driven spread: writes --p (0 → 1) on the grid. At 0 the two rows sit stacked on
 * each other; as the grid scrolls into view the top two cards move up and the bottom two
 * move down into their places. Scrolling back up closes them again.
 */
function useSpread(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) { el.style.setProperty('--p', '1'); return; }
    let queued = false;
    const update = () => {
      queued = false;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      const raw = Math.min(Math.max((vh * 0.92 - top) / (vh * 0.5), 0), 1);
      el.style.setProperty('--p', (raw * raw * (3 - 2 * raw)).toFixed(4));
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref]);
}

function Portrait({ dev }: { dev: Developer }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="au-initials" aria-hidden="true">{initialsOf(dev.name)}</span>
  ) : (
    <img className="au-photo" src={dev.photo} alt={`Portrait of ${dev.name}`} loading="lazy" decoding="async" onError={() => setFailed(true)} />
  );
}

function TeamCard({ dev, index }: { dev: Developer; index: number }) {
  const { github, linkedin } = dev.links ?? {};
  return (
    <li className={`au-card au-card--${index < 2 ? 'top' : 'bottom'} au-card--col${index % 2}`}>
      <article className="au-face" tabIndex={0} aria-label={`${dev.name}, ${dev.designation}`}>
        <Portrait dev={dev} />
        <div className="au-info">
          <h3>{dev.name}</h3>
          <p className="au-role">{dev.designation}</p>
          <div className="au-extra">
            <div>
              <p className="au-bio">{dev.bio}</p>
              {(github || linkedin) && (
                <div className="au-links">
                  {github && <a href={github} target="_blank" rel="noreferrer">GitHub</a>}
                  {linkedin && <a href={linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

export default function AboutUs() {
  const { user } = useAuth();
  const gridRef = useRef<HTMLUListElement>(null);
  useReveal();
  useSpread(gridRef);

  useEffect(() => {
    const prev = document.title;
    document.title = 'About us · CNP Department';
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="landing au" id="top">
      <LandingNav signedIn={!!user} links={NAV} brandTo="/" showBackHome={true} />

      <main id="content">
        <section className="au-hero">
          <div className="landing-container">
            <p className="au-eyebrow au-reveal">About us</p>
            <h1 className="au-reveal au-d1">Built by Students, Designed for Better Collaboration.</h1>
            <p className="au-lead au-reveal au-d2">
              CNP is a student-developed academic project. It brings the clubs, projects and events of the
              department into one place, and it was built by the people who use it.
            </p>
            <div className="au-actions au-reveal au-d3">
              <a className="btn" href="#team">Meet the team</a>
              <Link className="btn ghost" to="/">Back to Homepage</Link>
              <Link className="btn" to="/login">Login</Link>
            </div>
          </div>
        </section>

        <section className="au-section" id="about">
          <div className="landing-container au-split">
            <div className="au-reveal">
              <p className="au-eyebrow">About CNP</p>
              <h2>One platform for the department’s student life.</h2>
            </div>
            <div className="au-copy au-reveal au-d1">
              <p>
                CNP is a web platform for Student Managed Clubs and GUIITAR Projects. Students, faculty
                coordinators, mentors and administrators sign in to the same place, and each sees the tools
                that fit their role.
              </p>
              <p>
                Students can discover clubs and projects and ask to join. Club and project admins manage
                members, events and updates, and project admins also handle inventory and material requests.
                Notifications keep everyone informed as things change.
              </p>
            </div>
          </div>
        </section>

        <section className="au-section au-section--tint" id="objective">
          <div className="landing-container">
            <div className="au-head au-reveal">
              <p className="au-eyebrow">Our Objective</p>
              <h2>Everything in one place, instead of scattered across chats and sheets.</h2>
            </div>
            <ul className="au-rows">
              {OBJECTIVES.map((o, i) => (
                <li key={o.title} className="au-row au-reveal" style={{ '--d': `${i * 60}ms` } as CSSProperties}>
                  <span className="au-row-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{o.title}</h3>
                  <p>{o.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="au-section" id="team">
          <div className="landing-container au-team">
            <div className="au-team-copy au-reveal">
              <p className="au-eyebrow">Our Team</p>
              <h2>Four students, one idea made real.</h2>
              <p className="au-lead">
                We planned, designed, built and tested CNP together. Hover over a card to see what each of us
                worked on.
              </p>
            </div>
            <ul className="au-grid" ref={gridRef}>
              {DEVELOPERS.map((dev, i) => <TeamCard key={dev.id} dev={dev} index={i} />)}
            </ul>
          </div>
        </section>

        <section className="au-section au-section--tint" id="academic">
          <div className="landing-container au-split">
            <div className="au-reveal">
              <p className="au-eyebrow">Academic Project</p>
              <h2>Developed as part of our B.Tech CSE coursework.</h2>
            </div>
            <div className="au-copy au-reveal au-d1">
              <p>
                CNP was created by students of the B.Tech Computer Science and Engineering programme as an
                academic project. It is where we put what we learned in class to work on a real problem from
                our own department.
              </p>
              <ul className="au-chips" aria-label="Built with">
                {STACK.map((t) => <li key={t}>{t}</li>)}
              </ul>
              <p className="au-note">
                CNP is a student-developed project. It is not an official GSFC University platform.
              </p>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter links={[{ label: 'Home', to: '/' }, ...NAV.slice(1)]} />
    </div>
  );
}
