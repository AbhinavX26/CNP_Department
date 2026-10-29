import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth, isProfileComplete } from './context/AuthContext';
import { LoadingProvider, usePageLoading } from './context/LoadingContext';
import { AppLayout } from './components/layout/legacy/AppLayout';
import { ProtectedRoute, RoleProtectedRoute } from './components/ProtectedRoute';

// Pages
import Dashboard from './pages/Dashboard/Dashboard';
import Clubs from './pages/Clubs/Clubs';
import ClubDetails from './pages/Clubs/ClubDetails';
import Projects from './pages/Projects/Projects';
import ProjectDetails from './pages/Projects/ProjectDetails';
import About from './pages/About/About';
import Events from './pages/Events/Events';
import Notifications from './pages/Notifications/Notifications';
import Profile from './pages/Profile/Profile';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import MaterialRequests from './pages/MaterialRequests/MaterialRequests';
import Inventory from './pages/Inventory/Inventory';
import Landing from './pages/Landing/Landing';
import ErrorPage from './pages/Error/ErrorPage';
import LoadingScreen from './components/LoadingScreen';
import { HTTP_ERROR_EVENT } from './services/api';

/** Signed-out pages never get the loader; it belongs to the account. */
const PUBLIC_PATH = /^\/($|login|register|error)/;

function HttpErrorRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleHttpError = (event: Event) => {
      const status = (event as CustomEvent<{ status: number }>).detail?.status;
      if (status) navigate(`/error/${status}`, { replace: true });
    };

    window.addEventListener(HTTP_ERROR_EVENT, handleHttpError);
    return () => window.removeEventListener(HTTP_ERROR_EVENT, handleHttpError);
  }, [navigate]);

  return null;
}

/**
 * Shows the laptop loader overlay on every in-app navigation.
 * Streams green matrix code on the laptop screen, turns into a smile
 * when the page is ready, and dismisses snappily.
 */
function RouteProgress() {
  const { pathname } = useLocation();
  const { isPageReady, setPageReady } = usePageLoading();
  const [active, setActive] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const isFirstRender = useRef(true);
  const pageReadyRef = useRef(false);
  const minPassedRef = useRef(false);

  pageReadyRef.current = isPageReady;

  // New navigation: reset and show loader
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Landing, login, register and error pages: no loader.
    if (PUBLIC_PATH.test(pathname)) {
      setActive(false);
      setLeaving(false);
      return;
    }

    setActive(true);
    setLeaving(false);
    setIsReady(false);
    setPageReady(false);
    minPassedRef.current = false;

    // Minimum matrix code time (280ms) so user can see the hack code animation
    const minTimer = window.setTimeout(() => {
      minPassedRef.current = true;
      if (pageReadyRef.current) {
        setIsReady(true);
      }
    }, 280);

    // Safety ceiling: never hang open more than 2.5s regardless
    const safetyTimer = window.setTimeout(() => {
      setIsReady(true);
    }, 2500);

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [pathname, setPageReady]);

  // When page reports ready via LoadingContext
  useEffect(() => {
    if (!active) return;
    if (isPageReady && minPassedRef.current) {
      setIsReady(true);
    }
  }, [active, isPageReady]);

  const handleComplete = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setActive(false);
      setLeaving(false);
    }, 200);
  }, []);

  if (!active) return null;

  return (
    <LoadingScreen
      isReady={isReady}
      leaving={leaving}
      onComplete={handleComplete}
      fullScreen
    />
  );
}

/** New route, new document: the scroll container goes back to the top. */
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    const scroller = document.querySelector('.shell-content, .main-content');
    if (scroller) scroller.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Navigate to={isProfileComplete(user) ? '/dashboard' : '/profile'} replace />;
  }
  return <Login />;
}

function AuthRegisterGuard() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Navigate to={isProfileComplete(user) ? '/dashboard' : '/profile'} replace />;
  }
  return <Register />;
}

/**
 * The boot hold.
 *
 * Authentication usually resolves in a few milliseconds, which would cut the
 * loader away before its cover finished opening. On a cold start the scene is
 * held for a beat, the app is mounted underneath it, and the book then fades.
 * A slow bootstrap is unaffected: the hold only pads, never truncates.
 *
 * The public page is exempt — it needs no identity, so it paints immediately.
 */
const BOOT_HOLD_MS = 700;
const BOOT_LEAVE_MS = 280;

function BootGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const { pathname } = useLocation();
  const isPublic = PUBLIC_PATH.test(pathname);
  const startedAt = useRef(Date.now());
  // Starting on a public page means there is no boot loader to hold or hand off.
  const [phase, setPhase] = useState<'hold' | 'leave' | 'done'>(() =>
    PUBLIC_PATH.test(pathname) ? 'done' : 'hold',
  );

  // Bounced to a public page mid-boot (signed out): the boot loader is over.
  useEffect(() => {
    if (isPublic && phase === 'hold') setPhase('done');
  }, [isPublic, phase]);

  useEffect(() => {
    if (isPublic || loading || phase !== 'hold') return;
    const elapsed = Date.now() - startedAt.current;
    const open = window.setTimeout(
      () => setPhase('leave'),
      Math.max(0, BOOT_HOLD_MS - elapsed),
    );
    return () => window.clearTimeout(open);
  }, [isPublic, loading, phase]);

  useEffect(() => {
    if (phase !== 'leave') return;
    const gone = window.setTimeout(() => setPhase('done'), BOOT_LEAVE_MS);
    return () => window.clearTimeout(gone);
  }, [phase]);

  if (isPublic) return <>{children}</>;

  /* The loader keeps its position in the tree across the hand-off: remounting it
     would start the cover from closed again. */
  return (
    <>
      {phase === 'hold' ? null : children}
      {phase === 'done' ? null : <LoadingScreen isReady={!loading && phase !== 'hold'} leaving={phase === 'leave'} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LoadingProvider>
        <BrowserRouter>
          <BootGate>
            <Routes>
            <Route path="/login" element={<AuthGuard />} />
            <Route path="/register" element={<AuthRegisterGuard />} />
            <Route path="/" element={<Landing />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clubs" element={<Clubs />} />
                <Route path="clubs/:id" element={<ClubDetails />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:id" element={<ProjectDetails />} />
                <Route path="events" element={<Events />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="about" element={<About />} />
                <Route element={<RoleProtectedRoute allowedRoles={['project_admin']} />}>
                  <Route path="material-requests" element={<MaterialRequests />} />
                  <Route path="inventory" element={<Inventory />} />
                </Route>
              </Route>
            </Route>
            <Route path="/error/:statusCode" element={<ErrorPage />} />
            <Route path="*" element={<ErrorPage />} />
            </Routes>
          </BootGate>
          <HttpErrorRedirect />
          <RouteProgress />
          <ScrollReset />
        </BrowserRouter>
      </LoadingProvider>
    </AuthProvider>
  );
}
