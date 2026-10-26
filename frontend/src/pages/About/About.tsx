import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEVELOPERS, type Developer } from './developers';
import './about.css';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The portrait, or the person's initials on the brand gradient when there is no file yet. */
function Portrait({ dev, className }: { dev: Developer; className?: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className={`ab-initials ${className ?? ''}`} aria-hidden="true">{initialsOf(dev.name)}</span>
  ) : (
    <img className={className} src={dev.photo} alt="" onError={() => setFailed(true)} />
  );
}

function Profile({ dev, from, onClose }: { dev: Developer; from: DOMRect; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const originRef = useRef<() => DOMRect>(() => from);
  const closing = useRef(false);

  // The panel grows out of the card it was opened from, and returns to it on close.
  const glide = useCallback((toCard: boolean, done?: () => void) => {
    const panel = panelRef.current;
    if (!panel || reducedMotion()) { done?.(); return; }
    const end = panel.getBoundingClientRect();
    const start = originRef.current();
    const dx = start.left + start.width / 2 - (end.left + end.width / 2);
    const dy = start.top + start.height / 2 - (end.top + end.height / 2);
    const small = `translate(${dx}px, ${dy}px) scale(${start.width / end.width}, ${start.height / end.height})`;
    const frames = toCard
      ? [{ transform: 'none', opacity: 1 }, { transform: small, opacity: 0 }]
      : [{ transform: small, opacity: 0.2 }, { transform: 'none', opacity: 1 }];
    const anim = panel.animate(frames, { duration: toCard ? 260 : 380, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' });
    anim.onfinish = () => { if (!toCard) anim.cancel(); done?.(); };
  }, []);

  useLayoutEffect(() => { glide(false); }, [glide]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    panelRef.current?.parentElement?.classList.add('is-leaving');
    glide(true, onClose);
  }, [glide, onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const nodes = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [close]);

  const links = dev.links ?? {};
  return createPortal(
    <div className="ab ab-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div
        className="ab-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`ab-name-${dev.id}`}
      >
        <figure className="ab-panel-photo">
          <Portrait dev={dev} />
        </figure>
        <div className="ab-panel-body">
          <button type="button" className="ab-close" ref={closeRef} onClick={close} aria-label="Close profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
          <p className="ab-eyebrow">Developer</p>
          <h2 className="ab-panel-name" id={`ab-name-${dev.id}`}>{dev.name}</h2>
          <p className="ab-panel-role">{dev.designation}</p>
          <p className="ab-panel-bio">{dev.bio}</p>
          {(links.github || links.linkedin || links.email) && (
            <div className="ab-links">
              {links.github && <a href={links.github} target="_blank" rel="noreferrer">GitHub</a>}
              {links.linkedin && <a href={links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
              {links.email && <a href={`mailto:${links.email}`}>Email</a>}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function About() {
  const [open, setOpen] = useState<{ dev: Developer; from: DOMRect } | null>(null);
  const openedFrom = useRef<HTMLElement | null>(null);

  const show = (dev: Developer, el: HTMLElement) => {
    openedFrom.current = el;
    setOpen({ dev, from: el.getBoundingClientRect() });
  };
  const hide = () => {
    setOpen(null);
    openedFrom.current?.focus();
  };

  return (
    <div className="ab ab-page">
      <header className="ab-head">
        <div>
          <p className="ab-eyebrow">About us</p>
          <h1 className="ab-title"><em>Meet Our</em><br />Developers</h1>
        </div>
        <p className="ab-brief">
          CNP Portal brings the department&rsquo;s Student Managed Clubs and GUIITAR projects onto one platform.
          Students join clubs and projects, coordinators and mentors review requests, and everyone follows events and
          notices in one place. It was designed and built end to end by the four students below.
        </p>
      </header>

      <ul className="ab-grid">
        {DEVELOPERS.map((dev) => (
          <li key={dev.id}>
            <button
              type="button"
              className="ab-card"
              onClick={(e) => show(dev, e.currentTarget)}
              aria-haspopup="dialog"
              aria-label={`${dev.name}, ${dev.designation}. Open profile`}
            >
              <Portrait dev={dev} className="ab-card-img" />
              <span className="ab-card-veil" aria-hidden="true" />
              <span className="ab-card-tag">
                <strong>{dev.name}</strong>
                <span>{dev.designation}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && <Profile dev={open.dev} from={open.from} onClose={hide} />}
    </div>
  );
}
