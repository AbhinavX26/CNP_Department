import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, isProfileComplete } from '../../context/AuthContext';
import { api } from '../../services/api';
import './login-diary.css';

/**
 * The sign-in page is a diary.
 *
 *   smoke    thin white smoke covers the screen
 *   clearing the smoke drifts off
 *   cover    the closed diary, emblem on a dark gradient cover
 *   opening  the cover swings open, pages flip fast and settle on two pages
 *   open     left page: welcome. right page: the sign-in lines
 *
 * Every visual end state is written statically in CSS under data-phase="open", so the
 * animations only have to get there. Reduced motion, `playIntro={false}` and Skip all land
 * straight on "open".
 */
type Phase = 'smoke' | 'clearing' | 'cover' | 'opening' | 'open';

/** When each step begins, in ms from mount. */
const INTRO_STEPS: ReadonlyArray<readonly [Phase, number]> = [
  ['clearing', 500],
  ['cover', 1400],
  ['opening', 2100],
  ['open', 4000],
];

const EMBLEM_SRC = '/branding/cnp-community-emblem.png?v=4';

/* The pages that flip past. Nothing here has to be read: it is the diary of a busy club
   council, written in the same hand as the sign-in lines. */
const FACE_TEXT: string[][] = [
  ['Club council, Fri 4:30', 'Rover: calibrate motors (done)', 'order jumper wires!!', 'ask HOD about budget', 'poster draft v2', 'call sponsor ->'],
  ['Code Wars, room 204', 'bring laptops + chargers', 'judges: Dr. Verma?', 'prize pool = ??', 'sign-up sheet (done)', 'dinner: veg x 12'],
  ['Soil sensor: re-test', 'irrigation demo Mon', 'GUIITAR review 11am', 'ask Riya for the CAD', 'label every bin', 'battery packs low'],
  ['Photo walk, Sat 6am', 'borrow the tripod', 'theme: old campus', 'edit by Wednesday', 'print 20 posters', 'exhibition hall?'],
  ['Inventory count: 42 items', 'servo kit out of stock', 'request forms -> office', 'new members: 9', 'welcome mail draft', 'keys to robotics lab'],
  ['Debate finals, Thu', 'timekeeper needed', 'motion: AI in class?', 'invite alumni panel', 'water + mics', 'certificates -> print'],
  ['Music club jam night', 'amp + 2 mics', 'setlist v3 (done)', 'permission letter', 'who has the drum pads?', 'finish by 9pm'],
  ['Sponsor email, follow up', 'thank-you note', 'logo on banner', 'report due Friday', 'update the notice board', 'coffee run'],
  ['Demo day prep', 'slides: 8 max', 'rehearse twice', 'power strips x 3', 'name tags', 'smile!'],
];

const DOODLES = ['star', 'arrow', 'loop', 'box', 'underline'] as const;
type Doodle = (typeof DOODLES)[number];

function DoodleMark({ kind }: { kind: Doodle }) {
  return (
    <svg className="dy-doodle" viewBox="0 0 60 40" fill="none" aria-hidden="true" focusable="false">
      {kind === 'star' && <path d="M30 5l5.5 11.5 12.5 1.6-9.2 8.7 2.4 12.4L30 33.2 18.8 39.2l2.4-12.4L12 18.1l12.5-1.6L30 5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />}
      {kind === 'arrow' && <path d="M4 26c10-14 24-16 44-8m0 0-9-5m9 5-7 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {kind === 'loop' && <path d="M4 28c8-14 14-14 14-4s-8 12-8 2 14-22 26-14 8 16 18 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
      {kind === 'box' && <path d="M8 8h40l4 24H12L8 8zm8 14 8 7 16-15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {kind === 'underline' && <path d="M4 22c12-6 24 4 36-2s12 4 16 0M8 32c14-4 26 2 44-2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

/** One side of a flipping page: a handful of notes on the ruled lines and a doodle. */
function Notes({ face }: { face: number }) {
  const lines = FACE_TEXT[face % FACE_TEXT.length];
  return (
    <div className="dy-notes" aria-hidden="true">
      {lines.map((text, i) => (
        <p
          key={text}
          className="dy-notes__line"
          style={
            {
              '--r': [2, 4, 5, 7, 9, 10][i],
              '--x': `${((face * 5 + i * 7) % 14) + 4}%`,
              '--rot': `${(((face + i * 3) % 5) - 2) * 0.55}deg`,
            } as CSSProperties
          }
        >
          {text}
        </p>
      ))}
      <span className="dy-notes__doodle" style={{ '--r': 12 + (face % 3) } as CSSProperties}>
        <DoodleMark kind={DOODLES[face % DOODLES.length]} />
      </span>
    </div>
  );
}

/** A leaf is two sides of paper. `back === null` is the blank page the welcome note lands on. */
const LEAVES: ReadonlyArray<{ front: number; back: number | null }> = [
  { front: 0, back: 1 },
  { front: 2, back: 3 },
  { front: 4, back: 5 },
  { front: 6, back: 7 },
  { front: 8, back: null },
];

function CoverArt() {
  return (
    <div className="dy-cover-art" aria-hidden="true">
      <span className="dy-cover-art__stitch" />
      <img className="dy-cover-art__emblem" src={EMBLEM_SRC} alt="" draggable={false} />
      <p className="dy-cover-art__title">Student managed clubs <span>&amp;</span> GUIITAR projects</p>
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface LoginProps {
  /** Play the smoke-and-diary opening. Off for tests; reduced motion turns it off too. */
  playIntro?: boolean;
}

export default function Login({ playIntro = true }: LoginProps) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const [intro] = useState(() => playIntro && !prefersReducedMotion());
  const [phase, setPhase] = useState<Phase>(intro ? 'smoke' : 'open');
  const [skipped, setSkipped] = useState(false);
  const instant = !intro || skipped;
  const playing = intro && phase !== 'open';

  const [today] = useState(() =>
    new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
  );

  useEffect(() => {
    if (!intro || skipped) return;
    const timers = INTRO_STEPS.map(([step, at]) => window.setTimeout(() => setPhase(step), at));
    return () => timers.forEach(window.clearTimeout);
  }, [intro, skipped]);

  const skip = useCallback(() => {
    setSkipped(true);
    setPhase('open');
  }, []);

  // Anyone who does not want the show can press Enter, Space or Escape.
  useEffect(() => {
    if (!playing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
        event.preventDefault();
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, skip]);

  // The pen is ready the moment the diary has settled.
  useEffect(() => {
    if (intro && phase === 'open') emailRef.current?.focus({ preventScroll: true });
  }, [intro, phase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || isSubmittingRef.current) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter your email address and password to continue.');
      return;
    }

    setError('');
    setLoading(true);
    isSubmittingRef.current = true;

    try {
      const response = await api<any>('POST', '/auth/login', {
        email: trimmedEmail,
        password,
      });

      if (response.success && response.token && response.user) {
        login(response.token, response.user);

        const from = (location.state as any)?.from?.pathname;
        const target =
          from && from !== '/login'
            ? from
            : isProfileComplete(response.user)
              ? '/dashboard'
              : '/profile';

        navigate(target, { replace: true });
      } else {
        setError(response.message || 'Login failed. Check your details and try again.');
        setLoading(false);
        isSubmittingRef.current = false;
      }
    } catch (requestError: any) {
      setError(requestError.message || 'We couldn’t sign you in. Please try again.');
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const smokeVisible = phase === 'smoke' || phase === 'clearing';

  return (
    <main
      className="dy-stage"
      data-phase={phase}
      data-instant={instant || undefined}
      aria-label="CNP Department sign in"
      onClick={playing ? skip : undefined}
    >
      {playing && (
        <button type="button" className="dy-skip" onClick={skip}>
          Skip intro
        </button>
      )}

      {/* The closed diary on small screens, where two pages will not sit side by side. */}
      <div className="dy-cover-m" aria-hidden="true">
        <div className="dy-cover-m__book">
          <CoverArt />
        </div>
      </div>

      <div className="dy-scene">
        <div className="dy-book">
          <span className="dy-shadow" aria-hidden="true" />
          <span className="dy-board" aria-hidden="true" />

          {/* Left page: printed, no lines. Fades in once the last leaf has landed. */}
          <section className="dy-page dy-page--left" aria-labelledby="dy-welcome">
            <div className="dy-plate">
              <img src={EMBLEM_SRC} alt="CNP Department emblem" draggable={false} />
            </div>
            <h1 className="dy-welcome" id="dy-welcome">Welcome to CNP Department.</h1>
            <p className="dy-brief">
              The home of GSFC University’s student-managed clubs and GUIITAR projects, where
              communities, ideas and events come together.
            </p>
            <p className="dy-call">Log in and be ready to fulfill your duties!</p>
          </section>

          {/* Right page: ruled paper, written in pen. Email on line 4, password on line 7,
              the two choices on line 13. */}
          <section className="dy-page dy-page--right" aria-label="Sign in">
            <form className="dy-sheet" onSubmit={handleSubmit} noValidate>
              <p className="dy-date" aria-hidden="true">{today}</p>

              <div className="dy-row dy-row--email">
                <label className="dy-label" htmlFor="login-email">Email:</label>
                <input
                  id="login-email"
                  ref={emailRef}
                  name="email"
                  className="dy-field"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="name@college.edu"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  disabled={loading}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>

              <div className="dy-row dy-row--password">
                <label className="dy-label" htmlFor="login-password">Password:</label>
                <input
                  id="login-password"
                  name="password"
                  className="dy-field"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="secret word"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  disabled={loading}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  className="dy-reveal"
                  type="button"
                  onClick={() => setShowPassword(visible => !visible)}
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                    <path d="M2.6 12S6.2 6.4 12 6.4 21.4 12 21.4 12 17.8 17.6 12 17.6 2.6 12 2.6 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.7" />
                    {showPassword && <path d="m4.5 4.5 15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
                  </svg>
                </button>
              </div>

              {error && <p className="dy-error" id="login-error" role="alert">{error}</p>}

              <div className="dy-actions">
                <button className="dy-btn dy-btn--go" type="submit" disabled={loading} aria-busy={loading || undefined}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
                <Link className="dy-btn dy-btn--home" to="/">Return to Home Page</Link>
              </div>

              <p className="dy-pencil">(authorised college accounts only)</p>
              <p className="dy-print">
                CNP Department <span aria-hidden="true">·</span> Student managed clubs &amp; GUIITAR
              </p>
            </form>
          </section>

          {/* The pages that flip. Index 0 is on top of the pile and goes first. */}
          {LEAVES.map((leaf, i) => (
            <div
              key={leaf.front}
              className="dy-leaf"
              aria-hidden="true"
              style={{ '--i': i } as CSSProperties}
            >
              <div className="dy-face dy-face--front">
                <Notes face={leaf.front} />
              </div>
              <div className="dy-face dy-face--back">
                {leaf.back !== null && <Notes face={leaf.back} />}
              </div>
            </div>
          ))}

          {/* The cover. Its inside is the left board once it has swung open. */}
          <div className="dy-leaf dy-leaf--cover" aria-hidden="true">
            <div className="dy-face dy-face--front dy-cover">
              <CoverArt />
            </div>
            <div className="dy-face dy-face--back dy-inside" />
          </div>
        </div>
      </div>

      {smokeVisible && (
        <div className="dy-smoke" aria-hidden="true">
          <span className="dy-smoke__veil" />
          <span className="dy-smoke__drift dy-smoke__drift--a"><span className="dy-smoke__layer dy-smoke__layer--a" /></span>
          <span className="dy-smoke__drift dy-smoke__drift--b"><span className="dy-smoke__layer dy-smoke__layer--b" /></span>
          <span className="dy-smoke__drift dy-smoke__drift--c"><span className="dy-smoke__layer dy-smoke__layer--c" /></span>
        </div>
      )}
    </main>
  );
}
