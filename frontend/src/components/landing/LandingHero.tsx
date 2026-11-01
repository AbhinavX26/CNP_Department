import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const HERO_PHOTOS = [
  // ── Inner Ring: Placed directly behind the main CNP card, peeking out ──
  { src: '/photos/photo-4.jpg', alt: 'Live musical performance at Ramzat festival' },
  { src: '/photos/project-1.png', alt: 'Autonomous robotics rover prototyping team' },
  { src: '/photos/photo-10.jpg', alt: 'Origami lanterns and campus cultural celebration' },
  { src: '/photos/project-3.jpg', alt: '3D printing rapid prototyping laboratory' },
  { src: '/photos/photo-14.png', alt: 'Fine arts student canvas oil painting' },
  { src: '/photos/photo-2.jpg', alt: 'Competitive chess tournament club match' },
  { src: '/photos/project-8.png', alt: 'Applied science research laboratory experiment' },
  { src: '/photos/photo-5.jpg', alt: 'Basketball team practice on the university court' },

  // ── Outer Ring: Framing the full viewport breadth and corners ──
  { src: '/photos/X1.jpeg', alt: 'NCC cadets parade and ceremony on campus' },
  { src: '/photos/X4.jpeg', alt: 'Volleyball sports match on university court' },
  { src: '/photos/photo-11.png', alt: 'Target archery sports club student practice' },
  { src: '/photos/project-5.png', alt: 'Software engineering students coding in computer lab' },
  { src: '/photos/photo-8.jpg', alt: 'Students participating in campus club outdoor event' },
  { src: '/photos/photo-13.png', alt: 'University football match on open campus grounds' },
];

const HT = [
  // [left%, top%, width_vw, height_vh, tx, ty, rot]
  // ── Inner Ring (physically layered behind & around center card edges) ──
  [41.5, 12, 17, 24, 0, -1.0, -1],
  [23.5, 13, 17, 23, -0.65, -0.8, 2.5],
  [59.5, 13, 17, 23, 0.65, -0.8, -2.5],
  [20.5, 36.5, 17.5, 23.5, -0.95, -0.05, -2],
  [62, 35.5, 17.5, 23.5, 0.95, -0.05, 2],
  [23.5, 60, 17, 23, -0.65, 0.8, -2],
  [59.5, 59, 17, 23, 0.65, 0.8, 2],
  [41.5, 62, 17, 24, 0, 1.0, 1.5],

  // ── Outer Ring (framing viewport corners and flanks) ──
  [3, 7, 15.5, 24, -1.0, -0.8, -3.5],
  [81.5, 7, 15.5, 24, 1.0, -0.8, 3.5],
  [1.5, 37, 14.5, 23, -1.1, 0, 1.5],
  [84, 36, 14.5, 23, 1.1, 0, -1.5],
  [3, 66, 15.5, 24, -1.0, 0.8, 3],
  [81.5, 65, 15.5, 24, 1.0, 0.8, -3],
];

interface LandingHeroProps {
  signedIn?: boolean;
}

export function LandingHero({ signedIn: _signedIn }: LandingHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rm) return;

    const hero = heroRef.current;
    const core = coreRef.current;
    const tilesEl = tilesRef.current;
    if (!hero || !core || !tilesEl) return;

    const tl = tilesEl.children as HTMLCollectionOf<HTMLElement>;
    let busy = false;

    function upd() {
      busy = false;
      if (!hero || !core || !tl) return;
      const vh = window.innerHeight;
      const heroRect = hero.getBoundingClientRect();
      const p = Math.min(Math.max((64 - heroRect.top) / (vh * 0.75), 0), 1);

      for (let i = 0; i < tl.length; i++) {
        const t = HT[i];
        if (!t || !tl[i]) continue;
        tl[i].style.transform = `translate(${t[4] * p * 25}vw, ${t[5] * p * 25}vh) rotate(${t[6] * (1 + p * 0.8)}deg) scale(${1 + p * 0.15})`;
        tl[i].style.opacity = String(Math.max(1 - p * 0.9, 0.1));
      }
      core.style.transform = `translateY(${-p * 35}px) scale(${1 - p * 0.05})`;
      core.style.opacity = String(Math.max(1 - p * 1.1, 0));
    }

    function sc() {
      if (!busy) {
        busy = true;
        requestAnimationFrame(upd);
      }
    }

    window.addEventListener('scroll', sc, { passive: true });
    window.addEventListener('resize', sc);
    upd();

    return () => {
      window.removeEventListener('scroll', sc);
      window.removeEventListener('resize', sc);
    };
  }, []);

  return (
    <section className="hero" id="hero" ref={heroRef}>
      <div>
        <div id="tiles" ref={tilesRef}>
          {HT.map((t, idx) => {
            const photo = HERO_PHOTOS[idx % HERO_PHOTOS.length];
            return (
              <div
                key={idx}
                className="ph"
                style={{
                  left: `${t[0]}%`,
                  top: `${t[1]}%`,
                  width: `${t[2]}vw`,
                  height: `${t[3]}vh`,
                  transform: `rotate(${t[6]}deg)`,
                }}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  loading="eager"
                  decoding="async"
                />
              </div>
            );
          })}
        </div>
        <div className="core" id="core" ref={coreRef}>
          <div className="hero-logo-badge">
            <img
              className="hero-logo"
              src="/branding/cnp-community-emblem.png"
              alt="CNP Department logo"
              width={140}
              height={62}
              loading="eager"
              decoding="async"
            />
          </div>
          <h1>Welcome to the CNP Department</h1>
          <p>Clubs and projects, organised, resourced and seen.</p>
          <Link className="btn" to="/login">
            Login
          </Link>
          <a className="btn ghost" href="#clubs">
            See what’s inside
          </a>
        </div>
      </div>
    </section>
  );
}
