import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageLoading } from '../context/LoadingContext';
import LoadingScreen from './LoadingScreen';

/** Pages outside the signed-in app keep their own entrance and never get the book. */
const EXEMPT = /^\/($|login|register|error)/;

const LEAVE_MS = 280;

/**
 * The page-to-page loader.
 *
 * Every in-app navigation opens the register over the incoming page: the route
 * mounts underneath, the book reports honest progress, and the scene fades once
 * the destination says it is ready (LoadingScreen caps the wait, so a page that
 * forgets to report can never hold the app).
 *
 * The previous path is compared rather than "is this the first effect run", so
 * React StrictMode's double-invoked effects cannot play the loader on first paint.
 */
export default function RouteTransition() {
  const { pathname } = useLocation();
  const { isPageReady } = usePageLoading();
  const previous = useRef(pathname);
  const [phase, setPhase] = useState<'idle' | 'show' | 'leave'>('idle');
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (EXEMPT.test(pathname)) {
      setPhase('idle');
      return;
    }
    // A new key restarts the cover from closed, even when a previous run is still leaving.
    setRun((count) => count + 1);
    setPhase('show');
  }, [pathname]);

  useEffect(() => {
    if (phase !== 'leave') return;
    const timer = window.setTimeout(() => setPhase('idle'), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'idle') return null;

  return (
    <LoadingScreen
      key={run}
      isReady={isPageReady}
      leaving={phase === 'leave'}
      onComplete={() => setPhase((current) => (current === 'show' ? 'leave' : current))}
    />
  );
}
