import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LandingNav } from '../../components/landing/LandingNav';
import { LandingHero } from '../../components/landing/LandingHero';
import { LandingSections } from '../../components/landing/LandingSections';
import { LandingClose } from '../../components/landing/LandingClose';
import { LandingFooter } from '../../components/landing/LandingFooter';

/**
 * Public front page at "/". Everyone, signed in or not, reads the same page; only
 * the action changes (Log in vs Open dashboard).
 */
export default function Landing() {
  const { user } = useAuth();
  const signedIn = !!user;

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
        threshold: [0, 0.12],
        rootMargin: '0px 0px -30px 0px',
      }
    );

    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight - 30 && rect.bottom > 30;
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
