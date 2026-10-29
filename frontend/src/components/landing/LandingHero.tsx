import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const HERO_PHOTOS = [
  { src: '/photos/photo-8.jpg', alt: 'Campus events and outdoor club' },
  { src: '/photos/project-1.png', alt: 'Robotics rover project team' },
  { src: '/photos/photo-2.jpg', alt: 'Chess tournament club' },
  { src: '/photos/project-3.jpg', alt: '3D printing prototyping lab' },
  { src: '/photos/photo-5.jpg', alt: 'Basketball sports club' },
  { src: '/photos/project-2.png', alt: 'Library project collaboration' },
];

const HT = [
  // [left%, top%, width_vw, height_vh, tx, ty, rot, index]
  // Dynamic Floating Collage: 6 photos elegantly distributed around the center card with natural spacing & zero overlap
  [3.5, 9, 14, 22, -0.9, -0.7, -2.5, 0],     // Top-Left outer
  [18.5, 3, 12.5, 20, -0.4, -1, 1.5, 1],     // Top-Left inner (tucked cleanly above-left of core)
  [4.5, 65, 17, 23, -0.85, 0.6, -2, 2],      // Bottom-Left
  [76.5, 8, 17, 22, 0.9, -0.7, 2.5, 3],      // Top-Right outer
  [68.5, 72, 14, 20, 0.4, 1, 1.5, 4],        // Bottom-Right inner (tucked cleanly below-right of core)
  [76.5, 38.5, 17, 22, 0.9, 0, -1.5, 5],     // Mid-Right flank
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
