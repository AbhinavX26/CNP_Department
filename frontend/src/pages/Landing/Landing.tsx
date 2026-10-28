import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LandingNav } from '../../components/landing/LandingNav';
import { LandingHero } from '../../components/landing/LandingHero';
import { LandingSections } from '../../components/landing/LandingSections';
import { LandingClose } from '../../components/landing/LandingClose';
import { LandingFooter } from '../../components/landing/LandingFooter';

/**
 * Public front page at "/".
 * Includes interactive canvas grid square effect (on touch & on hover)
 */
export default function Landing() {
  const { user } = useAuth();
  const signedIn = !!user;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Interactive canvas grid squares (touch burst + hover box)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext('2d');
    if (!cx) return;

    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    interface Square {
      x: number;
      y: number;
      s: number;
      t: number;
      d: number;
    }

    let S: Square[] = [];
    let animActive = false;
    let animId = 0;
    let lastCellKey = '';
    let lastMoveTime = 0;

    function rs() {
      if (!cv) return;
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    }
    rs();
    window.addEventListener('resize', rs);

    function isDark() {
      return (
        document.documentElement.dataset.theme === 'dark' ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    }

    function tick() {
      if (!cx || !cv) return;
      const n = performance.now();
      const dark = isDark();
      const c = dark ? '111,147,255' : '59,95,224';
      cx.clearRect(0, 0, cv.width, cv.height);

      // Render touch / hover squares with subtle, non-intrusive opacity
      const fillAlpha = dark ? 0.06 : 0.035;
      const strokeAlpha = dark ? 0.35 : 0.22;

      S = S.filter((q) => {
        const a = (n - q.t) / q.d;
        if (a >= 1) return false;
        if (a < 0) return true;
        const o = a < 0.15 ? a / 0.15 : 1 - (a - 0.15) / 0.85;
        cx.fillStyle = `rgba(${c}, ${o * fillAlpha})`;
        cx.fillRect(q.x, q.y, q.s, q.s);
        cx.strokeStyle = `rgba(${c}, ${o * strokeAlpha})`;
        cx.lineWidth = 1;
        cx.strokeRect(q.x + 0.5, q.y + 0.5, q.s - 1, q.s - 1);
        return true;
      });

      if (S.length) {
        animId = requestAnimationFrame(tick);
      } else {
        animActive = false;
      }
    }

    function ensureLoop() {
      if (!animActive) {
        animActive = true;
        animId = requestAnimationFrame(tick);
      }
    }

    const EXCLUDED_SELECTOR = [
      'a',
      'button',
      'input',
      'textarea',
      'select',
      '.ph',
      '#tiles',
      'img',
      'picture',
      '.core',
      '#core',
      '.landing-nav',
      'header',
      '.track',
      '.landing-close',
      '.landing-stage',
      '.key',
      '.btn',
      '#how',
      '.landing-how',
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'li',
      'blockquote',
      'figure',
    ].join(', ');

    function onPointerDown(e: PointerEvent) {
      if (rm) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(EXCLUDED_SELECTOR)) return;

      const g = 48;
      const bx = Math.floor(e.clientX / g);
      const by = Math.floor(e.clientY / g);
      const n = performance.now();

      S.push({ x: bx * g, y: by * g, s: g, t: n, d: 800 });
      for (let i = 0; i < 7; i++) {
        S.push({
          x: (bx + Math.round((Math.random() - 0.5) * 5)) * g,
          y: (by + Math.round((Math.random() - 0.5) * 5)) * g,
          s: g,
          t: n + i * 35,
          d: 600 + Math.random() * 400,
        });
      }
      ensureLoop();
    }

    // Spawn subtle box effect on mouse hover only on empty background (never over photos, cards, text, navbar)
    function onPointerMove(e: PointerEvent) {
      if (rm) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(EXCLUDED_SELECTOR)) {
        return;
      }
      const g = 48;
      const bx = Math.floor(e.clientX / g);
      const by = Math.floor(e.clientY / g);
      const key = `${bx},${by}`;
      const n = performance.now();

      if (key !== lastCellKey && n - lastMoveTime > 35) {
        lastCellKey = key;
        lastMoveTime = n;

        // Primary hover cell
        S.push({
          x: bx * g,
          y: by * g,
          s: g,
          t: n,
          d: 800,
        });

        // Soft companion grid pulse
        if (Math.random() > 0.4) {
          const dx = Math.random() > 0.5 ? 1 : -1;
          S.push({
            x: (bx + dx) * g,
            y: by * g,
            s: g,
            t: n + 40,
            d: 650,
          });
        }

        ensureLoop();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);

    return () => {
      window.removeEventListener('resize', rs);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  // 2. Scroll reveal animations
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = Array.from(document.querySelectorAll<HTMLElement>('.scroll-reveal'));
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            el.classList.add('is-in');
            el.classList.remove('is-out', 'is-past');
          } else {
            el.classList.remove('is-in');
            if (entry.boundingClientRect.top < 0) {
              el.classList.add('is-past');
              el.classList.remove('is-out');
            } else {
              el.classList.add('is-out');
              el.classList.remove('is-past');
            }
          }
        });
      },
      {
        threshold: [0, 0.08],
        rootMargin: '20px 0px -20px 0px',
      }
    );

    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight - 20 && rect.bottom > 20;
      if (inView) {
        el.classList.add('is-in');
      } else if (rect.top < 0) {
        el.classList.add('is-past');
      } else {
        el.classList.add('is-out');
      }
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing">
      <canvas id="sq" ref={canvasRef} aria-hidden="true" />
      <LandingNav signedIn={signedIn} />
      <main id="content">
        <LandingHero signedIn={signedIn} />
        <LandingSections />
        <LandingClose signedIn={signedIn} />
      </main>
      <LandingFooter />
    </div>
  );
}
