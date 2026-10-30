import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const HERO_PHOTOS = [
  { src: '/photos/X1.jpeg', alt: 'NCC cadets ceremony and parade' },
  { src: '/photos/X2.jpeg', alt: 'Students celebrating at campus cultural fest' },
  { src: '/photos/photo-2.jpg', alt: 'Chess tournament club' },
  { src: '/photos/X3.jpeg', alt: 'GSFC University event celebration on stage' },
  { src: '/photos/X4.jpeg', alt: 'Volleyball sports match on campus court' },
  { src: '/photos/X5.jpeg', alt: 'Student and faculty collaboration meeting' },
];

const HT = [
  // [left%, top%, width_vw, height_vh, tx, ty, rot]
  // ── Inner Ring: physically tucked behind the edges & corners of the main CNP card ──
  // 1. Tucked behind top-center of CNP (peeking over the top rim)
  [41.5, 12, 17, 24, 0, -1.0, -1],
  // 2. Tucked behind top-left shoulder of CNP
  [24, 13, 17, 23, -0.65, -0.8, 2.5],
  // 3. Tucked behind top-right shoulder of CNP
  [59, 13, 17, 23, 0.65, -0.8, -2.5],
  // 4. Tucked behind mid-left of CNP (peeking out from the left edge)
  [20.5, 36.5, 17.5, 23.5, -0.95, -0.05, -2],
  // 5. Tucked behind mid-right of CNP (peeking out from the right edge)
  [62, 35.5, 17.5, 23.5, 0.95, -0.05, 2],
  // 6. Tucked behind bottom-left of CNP
  [24, 60, 17, 23, -0.65, 0.8, -2],
  // 7. Tucked behind bottom-right of CNP
  [59, 59, 17, 23, 0.65, 0.8, 2],
  // 8. Tucked behind bottom-center of CNP (peeking under the bottom rim)
  [41.5, 62, 17, 24, 0, 1.0, 1.5],

  // ── Outer Ring: framing outer corners and flanks for full screen coverage ──
  // 9. Far Top-Left corner
  [3, 7, 15.5, 24, -1.0, -0.8, -3.5],
  // 10. Far Top-Right corner
  [81.5, 7, 15.5, 24, 1.0, -0.8, 3.5],
  // 11. Far Mid-Left flank
  [1.5, 37, 14.5, 23, -1.1, 0, 1.5],
  // 12. Far Mid-Right flank
  [84, 36, 14.5, 23, 1.1, 0, -1.5],
  // 13. Far Bottom-Left corner
  [3, 66, 15.5, 24, -1.0, 0.8, 3],
  // 14. Far Bottom-Right corner
  [81.5, 65, 15.5, 24, 1.0, 0.8, -3],
];

interface LandingHeroProps {
  signedIn?: boolean;
}

export function LandingHero({ signedIn }: LandingHeroProps) {
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
      const p = Math.min(Math.max((76 - heroRect.top) / (hero.offsetHeight - vh || 1), 0), 1);

      for (let i = 0; i < tl.length; i++) {
        const t = HT[i];
        if (!t || !tl[i]) continue;
        tl[i].style.transform = `translate(${t[4] * p * 50}vw, ${t[5] * p * 50}vh) rotate(${t[6] * (1 + p * 1.2)}deg) scale(${1 + p * 0.3})`;
        tl[i].style.opacity = String(Math.max(1 - p * 1.05, 0));
      }
      // Smooth Hermite S-curve fade for hero core text card
      const fadeProgress = Math.min(Math.max((p - 0.15) / 0.85, 0), 1);
      const coreOpacity = 1 - (fadeProgress * fadeProgress * (3 - 2 * fadeProgress));
      core.style.transform = `scale(${1 + p * 0.12})`;
      core.style.opacity = String(Number(coreOpacity.toFixed(3)));
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
          {signedIn ? (
            <Link className="btn" to="/dashboard">
              Open dashboard
            </Link>
          ) : (
            <Link className="btn" to="/login">
              Log in
            </Link>
          )}
          <a className="btn ghost" href="#clubs">
            See what’s inside
          </a>
        </div>
      </div>
    </section>
  );
}
