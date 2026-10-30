import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { LandingPoints, type LandingPoint } from './LandingPoints';
import { PhotoTrack, CLUB_PHOTOS, PROJECT_PHOTOS } from './PhotoTrack';
import { useCountUp } from '../ui/useCountUp';

const SMC_POINTS: LandingPoint[] = [
  {
    title: 'Learning beyond the syllabus',
    text: 'Clubs let students practise leadership, teamwork and creativity on things they care about.',
  },
  {
    title: 'Run by students',
    text: 'Members plan, organise and own their events, which builds real responsibility.',
  },
  {
    title: 'A community on campus',
    text: 'Shared interests, from dance and music to puzzles and tech, bring people together.',
  },
];

const GUIITAR_POINTS: LandingPoint[] = [
  { title: 'Shared resources', text: 'Labs, equipment and infrastructure for teams.' },
  { title: 'Mentorship and networking', text: 'Tailored mentorship and an extended network.' },
  { title: 'Business support', text: 'Co-working space, business support and IP protection.' },
];

const HELP_ITEMS = [
  {
    title: 'Bring everything together',
    text: 'Clubs, projects, members and events live in one platform instead of scattered chats and sheets.',
  },
  {
    title: 'Coordinate people',
    text: 'Faculty coordinators, team leaders and members each see what they need to act on.',
  },
  {
    title: 'Handle requests and resources',
    text: 'Material requests and inventory are tracked so project teams are not left waiting.',
  },
  {
    title: 'Keep everyone informed',
    text: 'Events and notifications keep every club and project on the same page.',
  },
];

/**
 * Who signs in. A glyph and a word each; the duty lives in the accessible name and
 * the hover title, because five sentences in a row is a paragraph, not a signpost.
 */
const ROLES = [
  { label: 'Students', duty: 'Their clubs, projects, events and inbox.', path: 'M12 3 3 7l9 4 9-4-9-4Zm-9 8v4l9 4 9-4v-4' },
  { label: 'Coordinators', duty: 'The clubs they guide and the requests waiting.', path: 'M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z' },
  { label: 'Mentors', duty: 'The projects they mentor and the feedback they leave.', path: 'M9 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8.6 8.6l6.8 6.8M6 14v1a4 4 0 0 0 4 4h1' },
  { label: 'Club admins', duty: 'Coverage across the club programme.', path: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5' },
  { label: 'Project admins', duty: 'The portfolio, materials and inventory.', path: 'M4 4h7v7H4V4Zm9 0h7v4h-7V4ZM4 13h7v7H4v-7Zm9-3h7v10h-7V10Z' },
];

interface StatCardProps {
  value: number;
  suffix?: string;
  label: string;
  delayMs?: number;
}

function StatCard({ value, suffix = '', label, delayMs = 0 }: StatCardProps) {
  const [inView, setInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const count = useCountUp(inView ? value : 0, 750);

  return (
    <div
      ref={cardRef}
      className={`landing-stat-card scroll-reveal ${inView ? 'is-in' : ''}`}
      style={{ '--reveal-delay': `${delayMs}ms` } as CSSProperties}
    >
      <div className="landing-stat-num">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="landing-stat-label">{label}</div>
    </div>
  );
}

export function LandingSections() {
  return (
    <>
      {/* ── About · the statement & animated transition after 1st slide ──── */}
      <section className="landing-about" id="about">
        <div className="landing-container">
          <div className="landing-transition-cue scroll-reveal">
            <span className="landing-cue-dot" aria-hidden="true" />
            <span className="landing-cue-text">Campus Hub · GSFC University</span>
            <span className="landing-cue-line" aria-hidden="true" />
          </div>

          <h2 className="landing-statement scroll-reveal">
            The CNP Department website is the working home of two student communities at GSFC University
            <span className="landing-stop" aria-hidden="true">.</span>
          </h2>

          {/* Animated counter strip revealed immediately following the 1st hero slide */}
          <div className="landing-stats-grid">
            <StatCard value={16} suffix="+" label="Active Student Clubs" delayMs={60} />
            <StatCard value={25} suffix="+" label="Funded Innovation Projects" delayMs={140} />
            <StatCard value={1200} suffix="+" label="Student Members & Leaders" delayMs={220} />
            <StatCard value={100} suffix="%" label="Student & Faculty Driven" delayMs={300} />
          </div>

          <div className="landing-about-foot scroll-reveal scroll-reveal--delay-1">
            <p className="landing-about-line">
              One platform for the people who run the clubs and the projects.
            </p>
            <ul className="landing-roles" aria-label="Who signs in">
              {ROLES.map((role, idx) => (
                <li
                  key={role.label}
                  title={role.duty}
                  className="scroll-reveal"
                  style={{ '--reveal-delay': `${idx * 60}ms` } as CSSProperties}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d={role.path} />
                  </svg>
                  <span className="landing-roles__label">{role.label}</span>
                  <span className="ui-visually-hidden">{role.duty}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Student Managed Clubs · head over the directory, full width ────── */}
      <section className="landing-clubs" id="clubs">
        <div className="landing-container landing-clubs-grid">
          <div className="landing-clubs-copy scroll-reveal">
            <h2>Clubs that students run themselves</h2>
            <p className="landing-lead">
              Interest-based groups planned and led by students, with a faculty coordinator guiding
              them. Campus life becomes practice: students lead, organise and collaborate outside the
              classroom.
            </p>

            <LandingPoints points={SMC_POINTS} />
          </div>

          <figure className="landing-shot landing-shot--clubs scroll-reveal scroll-reveal--scale scroll-reveal--delay-2">
            <div className="landing-shot-frame">
              <img
                src="/screens/ClubsBoard.png"
                alt="The clubs board: club directory, member stats, coordinators, and active memberships."
                width={1917}
                height={862}
                loading="lazy"
                decoding="async"
              />
            </div>
            <figcaption>
              The club board: your own membership and core-team split above every club and its faculty
              coordinator.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── 1st Photo Slide after Clubs · Club Gallery with 18 Photos ──────── */}
      <PhotoTrack id="h1" title="Campus Life & Club Snapshots" photos={CLUB_PHOTOS} />

      {/* ── GUIITAR Projects · head, screen, supports, the vision panel ────── */}
      <section className="landing-projects" id="projects">
        <div className="landing-container">
          <div className="landing-projects-head scroll-reveal">
            <div>
              <h2>Ideas with the backing to become real</h2>
            </div>
            <div className="landing-projects-prose">
              <p>
                GU Incubation Innovation Technology and Applied Research (GUIITAR) Council has been
                established by GSFC University (GSFCU) at Vadodara, dedicated to promoting and supporting
                creativity, innovation and the spirit of enterprise among young minds and innovators.
                GUIITAR Council is registered under section 8 of the Companies Act, 2013.
              </p>
            </div>
          </div>

          <div className="landing-projects-body">
            <figure className="landing-shot landing-shot--projects scroll-reveal scroll-reveal--scale">
              <div className="landing-shot-frame">
                <img
                  src="/screens/ProjectsBoard.png"
                  alt="The projects ledger: Campus Energy Monitor, Autonomous Rover and Smart Irrigation System, each with its status, team and leader."
                  width={784}
                  height={352}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption>Active projects, their status and the student leading each team.</figcaption>
            </figure>

            <ul className="landing-supports">
              {GUIITAR_POINTS.map((point, idx) => (
                <li
                  key={point.title}
                  className="scroll-reveal"
                  style={{ '--reveal-delay': `${idx * 100}ms` } as CSSProperties}
                >
                  <span className="landing-supports-mark" aria-hidden="true" />
                  <h3>{point.title}</h3>
                  <p>{point.text}</p>
                </li>
              ))}
            </ul>
          </div>

          <figure className="landing-vision scroll-reveal scroll-reveal--scale scroll-reveal--delay-1">
            <blockquote>
              <p>
                To nurture young minds by providing a platform to explore and showcase their potential,
                along with the generation of high added value, with a focus on innovation as well as
                marketing of technologies for the betterment of the Scientific, Engineering, Science &amp;
                Management Communities and the Society.
              </p>
            </blockquote>
            <figcaption>
              <span>GUIITAR Council vision</span>
              <span>Section 8, Companies Act, 2013</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── 2nd Photo Slide after Projects · Innovation & Prototyping Gallery ─ */}
      <PhotoTrack id="h2" title="Innovation & Prototyping Snapshots" photos={PROJECT_PHOTOS} />

      {/* ── How we help · the calendar, then four ruled answers ────────────── */}
      <section className="landing-how" id="how">
        <div className="landing-container">
          <div className="landing-how-top">
            <figure className="landing-shot landing-shot--events scroll-reveal scroll-reveal--scale">
              <div className="landing-shot-frame">
                <img
                  src="/screens/EventsBoard.png"
                  alt="The club events calendar for October 2026, with upcoming and past events marked and the next three events listed beside it."
                  width={725}
                  height={530}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption>One calendar for every club, with upcoming and past events marked.</figcaption>
            </figure>

            <div className="landing-how-copy scroll-reveal scroll-reveal--delay-1">
              <h2>Managing clubs and projects, together</h2><br />
              <p className="landing-lead">
                Clubs, projects, events, notifications and material requests, handled in one place.
              </p>
              <div className="landing-how-actions">
                <Link to="/about" className="landing-how-btn">
                  <span>About Us</span>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
                    <path d="M4 10h12M11 5l5 5-5 5" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          <ul className="landing-helps">
            {HELP_ITEMS.map((item, idx) => (
              <li
                key={item.title}
                className="scroll-reveal"
                style={{ '--reveal-delay': `${idx * 80}ms` } as CSSProperties}
              >
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span className="landing-helps-tick" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
