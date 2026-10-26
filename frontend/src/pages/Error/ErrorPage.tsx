import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth, isProfileComplete } from '../../context/AuthContext';
import { usePageLoading } from '../../context/LoadingContext';
import './ErrorPage.css';

type ErrorStatus = 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503 | 504;

const ERROR_DETAILS: Record<ErrorStatus, { title: string; description: string }> = {
  400: { title: 'Bad Request', description: 'Neither our application nor the browser could understand what you were trying to say. Are you sure you have the right request?' },
  401: { title: 'Sign In Required', description: 'Your session reached its time limit. Log back in to continue again.' },
  403: { title: 'Access Denied', description: 'You\'re not authorized to open this file. How did you even come here?' },
  404: { title: 'Page Not Found', description: 'We appreciate manual searching, but the thing is that you wrote the wrong address.' },
  429: { title: 'Too Many Requests', description: 'Slow down. Trying to brute force will only waste your time. You have asked for too many requests. Come back later.' },
  500: { title: 'Server Error', description: 'Our servers bugged again. Sorry about that. We\'re a small group of devs. Things happen. By the way, can you donate some money to us (If you have some to spare?)?' },
  502: { title: 'Bad Gateway', description: 'Our servers received some invalid response. What exactly are you trying to do?' },
  503: { title: 'Service Unavailable', description: 'This service is not available for some time. Use the other facilities for now. We\'ll try to bring this one back up.' },
  504: { title: 'Gateway Timeout', description: 'Server is too slow. It took too much time. Why don\'t you try again?' },
};

function isErrorStatus(status: number): status is ErrorStatus {
  return status in ERROR_DETAILS;
}

function ArrowLeftIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export default function ErrorPage() {
  const { user } = useAuth();
  const location = useLocation();
  const { statusCode } = useParams();
  const { setPageReady } = usePageLoading();
  const requestedStatus = Number(statusCode);
  const status = isErrorStatus(requestedStatus) ? requestedStatus : 404;
  const error = ERROR_DETAILS[status];

  useEffect(() => {
    setPageReady(true);
    const prevTitle = document.title;
    document.title = `${status} — ${error.title} | CNP Department`;
    return () => {
      document.title = prevTitle;
    };
  }, [error.title, setPageReady, status]);

  const homePath = status === 401
    ? '/login'
    : user
      ? isProfileComplete(user)
        ? '/dashboard'
        : '/profile'
      : '/';

  return (
    <div className="err-screen" role="main">
      <div className="err-container">
        <div className="err-masthead">
          <span>CNP Department</span>
          <span className="err-masthead__accent">//</span>
          <span>Telemetry Link</span>
          <span className="err-masthead__accent">//</span>
          <span>Status {status}</span>
        </div>

        <div className="err-glitch" aria-label={`${status} ${error.title}`}>
          {/* Base outline text */}
          <span className="err-glitch__base" aria-hidden="true">
            {status}
          </span>

          {/* Top glitched slice */}
          <span className="err-glitch__slice err-glitch__slice--top" aria-hidden="true">
            {status}
          </span>

          {/* Bottom glitched slice */}
          <span className="err-glitch__slice err-glitch__slice--bottom" aria-hidden="true">
            {status}
          </span>

          {/* Main solid text */}
          <h1 className="err-glitch__main">{status}</h1>
        </div>

        <div className="err-panel">
          <div className="err-beacon">
            <span className="err-beacon__dot" aria-hidden="true" />
            <h2 className="err-panel__title">{error.title}</h2>
          </div>

          <p className="err-panel__desc">
            {error.description}
          </p>

          <div className="err-telemetry" title={location.pathname}>
            <span className="err-telemetry__label">TARGET:</span>
            <span className="err-telemetry__path">{location.pathname}</span>
          </div>

          <div className="err-actions">
            <Link to={homePath} className="err-btn err-btn--primary">
              <span className="err-btn__shimmer" aria-hidden="true" />
              <ArrowLeftIcon className="err-btn__icon err-btn__icon--back" />
              <span>Return to CNP</span>
            </Link>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="err-btn err-btn--ghost"
            >
              <RefreshIcon className="err-btn__icon err-btn__icon--retry" />
              <span>Try again</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
