import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './loader.css';

export interface LoadingScreenProps {
  /**
   * If true, signals that the destination's data has arrived: the progress bar can
   * close, the laptop smiles and the scene is released.
   */
  isReady?: boolean;
  /** Callback fired once the loader has finished and may be unmounted. */
  onComplete?: () => void;
  /** Whether to render as fixed full-screen overlay (true by default). */
  fullScreen?: boolean;
  /** Fade the whole scene out (used while the app mounts underneath it). */
  leaving?: boolean;
  /**
   * Kept for call-site compatibility. The loader no longer prints captions or
   * route names; it is purely visual.
   */
  caption?: string;
}

const TOTAL_STEPS = 4;
/** Progress shown at each step; the last stop before ready waits at 88%. */
const PROGRESS_AT_STEP = [6, 34, 62, 88, 100];

const GLYPHS = '01abcdef{}<>/=;$#*+';
const LINE_COUNT = 16;
const LINE_LENGTH = 31;

/** A fixed, believable-looking stream of "code". Seeded so it never reshuffles on render. */
function buildCode(): string[] {
  let seed = 2626;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: LINE_COUNT }, () => {
    const indent = Math.floor(next() * 3) * 2;
    let line = ' '.repeat(indent);
    while (line.length < LINE_LENGTH) {
      line += GLYPHS[Math.floor(next() * GLYPHS.length)];
      if (next() > 0.8) line += ' ';
    }
    return line.slice(0, LINE_LENGTH);
  });
}

function prefersReducedMotionNow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Loader — a small laptop on a frosted backdrop.
 *
 * Green code runs down the screen while a thin bar underneath shows how far the
 * page has got. The last stretch only closes when the caller says the page is
 * ready, never on a timer; at that moment the code stops, the screen becomes a
 * smile, and the scene is released. No route names or captions are printed.
 * Under reduced motion the code is static and the bar simply fills.
 */
export default function LoadingScreen({
  isReady = true,
  onComplete,
  fullScreen = true,
  leaving = false,
}: LoadingScreenProps) {
  const [step, setStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotionNow);
  const [complete, setComplete] = useState(false);

  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const firedRef = useRef(false);

  const code = useMemo(buildCode, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const listener = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  }, []);

  const finish = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setComplete(true);
    onCompleteRef.current?.();
  }, []);

  /* Stops one to three on a fixed cadence: snappy if the data is already there. */
  useEffect(() => {
    if (reducedMotion) return;
    const cadence = isReadyRef.current ? 70 : 200;
    const timers = [1, 2, 3].map((index) =>
      window.setTimeout(() => setStep((current) => Math.max(current, index)), cadence * index),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reducedMotion]);

  /* The last stop is the honest one: it only closes when the page says it is ready. */
  useEffect(() => {
    if (reducedMotion) {
      setStep(TOTAL_STEPS);
      if (!isReady) return;
      const timer = window.setTimeout(finish, 320);
      return () => window.clearTimeout(timer);
    }

    if (step < 3) return;
    if (!isReady) return;

    if (step === 3) {
      setStep(TOTAL_STEPS);
      return;
    }

    /* Smile shown: hold it just long enough to register, then hand over. */
    const timer = window.setTimeout(finish, 380);
    return () => window.clearTimeout(timer);
  }, [step, isReady, reducedMotion, finish]);

  /* Never outstay the route. */
  useEffect(() => {
    if (complete) return;
    const timer = window.setTimeout(finish, 2600);
    return () => window.clearTimeout(timer);
  }, [complete, finish]);

  // The last stop is held open while the page is still working.
  const shownStep = isReady ? step : Math.min(step, TOTAL_STEPS - 1);
  const percent = PROGRESS_AT_STEP[shownStep];
  const done = isReady && step >= TOTAL_STEPS;
  const waiting = !isReady && step >= 3;

  const rows = code.map((line, i) => (
    <span key={i} className="lp-code__line">
      {line}
    </span>
  ));

  return (
    <div
      className={`shell-loader${fullScreen ? '' : ' shell-loader--inline'}${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!isReady}
      aria-label={done ? 'Ready' : 'Loading'}
    >
      <div className={`lp${done ? ' is-done' : ''}${reducedMotion ? ' is-still' : ''}`}>
        <div className="lp__lid">
          <div className="lp__screen">
            <div className="lp-code" aria-hidden="true">
              <div className="lp-code__track">
                <div className="lp-code__col">{rows}</div>
                <div className="lp-code__col">{rows}</div>
              </div>
            </div>
            <svg className="lp__face" viewBox="0 0 64 40" aria-hidden="true">
              <circle className="lp__eye" cx="22" cy="14" r="3" />
              <circle className="lp__eye" cx="42" cy="14" r="3" />
              <path className="lp__mouth" d="M18 25 Q32 38 46 25" pathLength={1} />
            </svg>
          </div>
        </div>
        <div className="lp__base" aria-hidden="true" />

        <div
          className={`lp__bar${waiting ? ' is-waiting' : ''}`}
          role="progressbar"
          aria-label="Loading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span className="lp__fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
