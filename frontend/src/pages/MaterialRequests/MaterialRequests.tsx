import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { usePageLoading } from '../../context/LoadingContext';
import { Counter } from '../../components/ui/vis';
import { Tooltip } from '../../components/ui/Tooltip';
import { OpsOverlay } from '../Inventory/OpsOverlay';
import '../Inventory/ops.css';
import { Select } from '../../components/common/Select';

interface RequestUser {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  semester?: number | null;
}

interface MaterialRequest {
  _id: string;
  materialName?: string;
  specifications?: string;
  quantity: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: RequestUser | null;
  createdAt?: string;
  updatedAt?: string;
  imageUrl?: string | null;
  documentUrl?: string | null;
  documentOriginalName?: string | null;
  projectId?: { _id?: string; name?: string; status?: string } | null;
  requestedBy?: RequestUser | null;
  inventoryItemId?: {
    _id?: string;
    name?: string;
    category?: string;
    availableQuantity?: number;
    totalQuantity?: number;
    location?: string;
  } | null;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_LABEL: Record<MaterialRequest['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const itemNameOf = (request: MaterialRequest) =>
  request.materialName || request.inventoryItemId?.name || 'Unlisted item';

const formatDay = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    : 'Unknown';

const formatStamp = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Unknown';

const initialsOf = (name?: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const waitMs = (value?: string) => (value ? Math.max(0, Date.now() - new Date(value).getTime()) : 0);

const waitingLabel = (value?: string) => {
  if (!value) return 'None';
  const elapsed = waitMs(value);
  if (elapsed < 60 * 60 * 1000) return `${Math.max(1, Math.round(elapsed / (60 * 1000)))}m`;
  if (elapsed < 24 * 60 * 60 * 1000) return `${Math.floor(elapsed / (60 * 60 * 1000))}h`;
  return `${Math.floor(elapsed / (24 * 60 * 60 * 1000))}d`;
};

const rise = (index: number): CSSProperties => ({ '--i': Math.min(index, 7) } as CSSProperties);

const isPending = (request: MaterialRequest) => request.status === 'pending';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 11a8 8 0 1 0-2.3 6.3" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 13h4l1.5 2.5h5L16 13h4" />
      <path d="M5 5h14l1 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5l1-8Z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" />
      <path d="M14 3v4h4M9 12h6M9 16h4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3 1.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m5 12.6 4.4 4.4L19 7.2" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   The two marks this area repeats: requested against stock, and a status square.
   ───────────────────────────────────────────────────────────────────────────── */

interface StockBarProps {
  requested: number;
  available?: number | null;
  size?: 'sm' | 'md';
}

/**
 * Requested quantity measured against the stock on hand. The fill is the request;
 * the vertical mark is what the shelf holds. A request past the mark is short.
 * With no stock number the bar draws the bare request and says so.
 */
function StockBar({ requested, available, size = 'sm' }: StockBarProps) {
  const known = typeof available === 'number' && Number.isFinite(available);
  const stock = known ? (available as number) : 0;
  const ceiling = Math.max(requested, stock, 1);
  const requestFrac = Math.max(0, Math.min(requested / ceiling, 1));
  const stockFrac = known ? Math.max(0, Math.min(stock / ceiling, 1)) : 1;
  const short = known && requested > stock;

  return (
    <span
      className={`ops-stockbar ops-stockbar--${size}${short ? ' is-short' : ''}`}
      role="img"
      aria-label={
        known
          ? `${requested} requested, ${stock} in stock${short ? ', short by ' + (requested - stock) : ''}`
          : `${requested} requested, stock not listed`
      }
    >
      <span className="ops-stockbar__track" aria-hidden="true">
        <span className="ops-stockbar__fill" style={{ '--w': requestFrac } as CSSProperties} />
        {known && <span className="ops-stockbar__stock" style={{ '--x': stockFrac } as CSSProperties} />}
      </span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Queue marks: how long a request has waited, and requested against shelf stock.
   ───────────────────────────────────────────────────────────────────────────── */

const DAY = 24 * 60 * 60 * 1000;

const waitTone = (value?: string): 'fresh' | 'slow' | 'late' => {
  const days = waitMs(value) / DAY;
  return days >= 7 ? 'late' : days >= 3 ? 'slow' : 'fresh';
};

const stockOf = (request: MaterialRequest): number | null => {
  const value = request.inventoryItemId?.availableQuantity;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

/** The fill is the request; the vertical mark is what the shelf holds. Past the mark is short. */
function Meter({ requested, available }: { requested: number; available: number | null }) {
  const stock = available ?? 0;
  const ceiling = Math.max(requested, stock, 1);
  const fill = Math.max(0, Math.min(requested / ceiling, 1));
  const mark = available === null ? null : Math.max(0, Math.min(stock / ceiling, 1));
  const short = available !== null && requested > stock;
  return (
    <span
      className={`mr-meter${short ? ' is-short' : ''}`}
      role="img"
      aria-label={
        available === null
          ? `${requested} requested, stock not listed`
          : `${requested} requested, ${stock} in stock${short ? `, short by ${requested - stock}` : ''}`
      }
    >
      <i style={{ width: `${fill * 100}%` }} />
      {mark !== null && <b style={{ left: `${mark * 100}%` }} />}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   One row in the review queue.
   ───────────────────────────────────────────────────────────────────────────── */

interface TicketProps {
  request: MaterialRequest;
  onOpen: (request: MaterialRequest) => void;
  onApprove: (request: MaterialRequest) => void;
  onReject: (request: MaterialRequest) => void;
  busy: boolean;
}

function Ticket({ request, onOpen, onApprove, onReject, busy }: TicketProps) {
  const item = itemNameOf(request);
  const project = request.projectId?.name || 'Unknown project';
  const requester = request.requestedBy;
  const available = stockOf(request);
  const short = available !== null && request.quantity > available;
  const note = request.reason?.trim() || request.specifications?.trim() || '';

  return (
    <li className="mr-row">
      <button
        type="button"
        className="mr-open"
        aria-label={`Open request for ${request.quantity} of ${item} from ${requester?.name || 'unknown requester'}, waiting ${waitingLabel(request.createdAt)}`}
        onClick={() => onOpen(request)}
      />
      <span className="mr-cell mr-who">
        <span
          className="mr-face"
          title={[requester?.name, requester?.email, requester?.department, requester?.semester ? `Sem ${requester.semester}` : null]
            .filter(Boolean)
            .join(' · ')}
          aria-hidden="true"
        >
          {initialsOf(requester?.name)}
        </span>
        <span className="mr-who-text">
          <span className="mr-item" title={note || item}>{item}</span>
          <span className="mr-sub">
            {project}
            {requester?.name ? ` · ${requester.name}` : ''}
          </span>
        </span>
      </span>
      <span className="mr-cell mr-stock">
        <Meter requested={request.quantity} available={available} />
        <span className={`mr-nums${short ? ' is-short' : ''}`}>
          <strong>{request.quantity}</strong>
          <em>/</em>
          {available ?? '—'}
        </span>
      </span>
      <span className="mr-cell">
        <span className={`mr-wait mr-wait--${waitTone(request.createdAt)}`} title={`Waiting ${waitingLabel(request.createdAt)}`}>
          {waitingLabel(request.createdAt)}
        </span>
      </span>
      <span className="mr-cell mr-actions">
        <button type="button" className="mr-btn mr-btn--quiet mr-btn--sm" onClick={() => onReject(request)} disabled={busy}>
          Reject
        </button>
        <button type="button" className="mr-btn mr-btn--sm" onClick={() => onApprove(request)} disabled={busy}>
          {busy ? 'Approving…' : 'Approve'}
        </button>
      </span>
    </li>
  );
}

export default function MaterialRequests() {
  const { setPageLoading } = usePageLoading();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [showResolved, setShowResolved] = useState(false);

  const [detail, setDetail] = useState<MaterialRequest | null>(null);
  const [approveTarget, setApproveTarget] = useState<MaterialRequest | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MaterialRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const focusReturn = useRef<HTMLElement | null>(null);

  const loadRequests = async () => {
    try {
      setPageLoading(true);
      setLoadError(null);
      const res = await api<any>('GET', '/material-requests');
      setRequests(res.data || []);
    } catch (e: any) {
      console.error(e);
      setLoadError(e.message || 'Failed to load material requests');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const rememberFocus = () => {
    focusReturn.current = document.activeElement as HTMLElement | null;
  };
  const restoreFocus = () => {
    window.requestAnimationFrame(() => focusReturn.current?.focus());
  };

  const openDetail = (request: MaterialRequest) => {
    rememberFocus();
    setDetail(request);
  };

  const closeDetail = () => {
    setDetail(null);
    restoreFocus();
  };

  const openApprove = (request: MaterialRequest) => {
    rememberFocus();
    setApproveTarget(request);
    setApproveError(null);
  };

  const closeApprove = () => {
    setApproveTarget(null);
    setApproveError(null);
    restoreFocus();
  };

  const openReject = (request: MaterialRequest) => {
    rememberFocus();
    setRejectTarget(request);
    setRejectReason('');
    setRejectError(null);
  };

  const closeReject = () => {
    setRejectTarget(null);
    setRejectReason('');
    setRejectError(null);
    restoreFocus();
  };

  const handleApprove = async (req: MaterialRequest): Promise<boolean> => {
    const itemName = req.materialName || req.inventoryItemId?.name || 'Item';

    try {
      setActionLoading(req._id);
      setAlertMsg(null);
      setApproveError(null);
      await api('PATCH', `/material-requests/${req._id}/approve`);
      setDetail(null);
      setAlertMsg({ type: 'success', message: `Successfully approved request for ${req.quantity}x "${itemName}".` });
      await loadRequests();
      return true;
    } catch (e: any) {
      const message = e.message || 'Failed to approve request';
      setApproveError(message);
      setAlertMsg({ type: 'error', message });
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget || !rejectReason.trim()) return;

    try {
      setActionLoading(rejectTarget._id);
      setAlertMsg(null);
      setRejectError(null);
      await api('PATCH', `/material-requests/${rejectTarget._id}/reject`, { rejectionReason: rejectReason.trim() });
      setRejectTarget(null);
      setRejectReason('');
      setDetail(null);
      setAlertMsg({ type: 'success', message: 'Material request rejected.' });
      await loadRequests();
      restoreFocus();
    } catch (e: any) {
      const message = e.message || 'Failed to reject request';
      setRejectError(message);
      setAlertMsg({ type: 'error', message });
    } finally {
      setActionLoading(null);
    }
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    const target = approveTarget;
    const ok = await handleApprove(target);
    if (ok) {
      setApproveTarget(null);
      setApproveError(null);
      restoreFocus();
    }
  };

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter(isPending).length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    }),
    [requests],
  );

  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    requests.forEach((request) => {
      if (request.projectId?._id && request.projectId.name) {
        seen.set(request.projectId._id, request.projectId.name);
      }
    });
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [requests]);

  const visible = useMemo(() => {
    // MOCK: status, project and text filters run client-side; GET /material-requests returns every request.
    const needle = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (projectFilter !== 'all' && request.projectId?._id !== projectFilter) return false;
      if (!needle) return true;
      return [
        itemNameOf(request),
        request.projectId?.name,
        request.requestedBy?.name,
        request.requestedBy?.email,
        request.reason,
        request.specifications,
        request.rejectionReason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [requests, query, projectFilter]);

  const pendingRequests = useMemo(
    () =>
      visible
        .filter(isPending)
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [visible],
  );

  const pendingAll = useMemo(
    () =>
      requests
        .filter(isPending)
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [requests],
  );

  const oldestWait = useMemo(
    () => pendingAll.reduce((max, request) => Math.max(max, waitMs(request.createdAt)), 0),
    [pendingAll],
  );

  const resolvedRequests = useMemo(
    () =>
      visible
        .filter((request) => !isPending(request))
        .sort((a, b) => new Date(b.reviewedAt || b.createdAt || 0).getTime() - new Date(a.reviewedAt || a.createdAt || 0).getTime()),
    [visible],
  );

  const resolvedForFilter = useMemo(() => {
    if (filter === 'approved') return resolvedRequests.filter((r) => r.status === 'approved');
    if (filter === 'rejected') return resolvedRequests.filter((r) => r.status === 'rejected');
    return resolvedRequests;
  }, [resolvedRequests, filter]);

  const showPending = filter === 'all' || filter === 'pending';
  const showResolvedSection = filter === 'all' || filter === 'approved' || filter === 'rejected';
  const isCollapsible = filter === 'all';
  const renderResolvedSection =
    filter === 'approved' || filter === 'rejected' || resolvedRequests.length > 0;

  const filterLabel =
    filter === 'approved' ? 'Approved' : filter === 'rejected' ? 'Rejected' : 'Resolved';

  const hasSearch = query.trim().length > 0 || projectFilter !== 'all';

  const resetFilters = () => {
    setQuery('');
    setProjectFilter('all');
  };

  const toggleStage = (stage: Exclude<StatusFilter, 'all'>) => {
    setFilter((current) => (current === stage ? 'all' : stage));
    setShowResolved(false);
  };

  useEffect(() => {
    const overlayOpen = !!detail || !!approveTarget || !!rejectTarget;
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (rejectTarget) closeReject();
      else if (approveTarget) closeApprove();
      else closeDetail();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [detail, approveTarget, rejectTarget]);

  const oldestPending = pendingAll[0] ?? null;

  const byProject = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    pendingAll.forEach((request) => {
      const id = request.projectId?._id || 'unknown';
      const entry = map.get(id) ?? { id, name: request.projectId?.name || 'Unknown project', count: 0 };
      entry.count += 1;
      map.set(id, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [pendingAll]);
  const maxByProject = byProject[0]?.count ?? 0;

  const shortOnStock = useMemo(
    () =>
      pendingAll.filter((request) => {
        const stock = stockOf(request);
        return stock !== null && request.quantity > stock;
      }),
    [pendingAll],
  );

  const sharePct = (n: number) => (counts.all > 0 ? Math.round((n / counts.all) * 100) : 0);
  const tiles = [
    {
      key: 'pending' as const,
      label: 'Pending',
      value: counts.pending,
      note: oldestPending ? `Oldest waiting ${waitingLabel(oldestPending.createdAt)}` : 'Nothing waiting',
      tone: 'deep',
      Icon: ClockIcon,
    },
    { key: 'approved' as const, label: 'Approved', value: counts.approved, note: `${sharePct(counts.approved)}% of requests`, tone: 'blue', Icon: CheckIcon },
    { key: 'rejected' as const, label: 'Rejected', value: counts.rejected, note: `${sharePct(counts.rejected)}% of requests`, tone: 'sky', Icon: CloseIcon },
    {
      key: 'all' as const,
      label: 'All requests',
      value: counts.all,
      note: `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`,
      tone: 'mist',
      Icon: InboxIcon,
    },
  ];

  const approveStock = approveTarget?.inventoryItemId?.availableQuantity ?? 0;
  const approveShort = !!approveTarget && approveTarget.quantity > approveStock;
  const detailStock = detail?.inventoryItemId?.availableQuantity;
  const detailShort = detail != null && detailStock != null && detail.quantity > detailStock;

  return (
    <div className="ops-page mr">
      <header className="mr-head">
        <div>
          <h1 className="mr-title">Material requests</h1>
          <p className="mr-sub-head">What teams are drawing from the store room, checked against what the shelf holds.</p>
        </div>
        <div className="mr-tools">
          <label className="mr-search">
            <SearchIcon />
            <input
              type="search"
              placeholder="Search requests"
              aria-label="Search requests by item, project or requester"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
          </label>
          {projects.length > 1 && (
            <div className="mr-select">
              <label className="ui-visually-hidden" htmlFor="ops-request-project">Filter by project</label>
              <Select
                id="ops-request-project"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                disabled={loading}
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </Select>
            </div>
          )}
          <button type="button" className="mr-btn mr-btn--quiet" onClick={refresh} disabled={refreshing || loading}>
            <RefreshIcon />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {alertMsg && (
        <div
          className={`ui-notice ${alertMsg.type === 'success' ? 'ops-notice--success' : 'ui-notice--error'}`}
          role="status"
        >
          <div className="ui-grow">{alertMsg.message}</div>
          <button type="button" className="ui-icon-btn" aria-label="Dismiss message" onClick={() => setAlertMsg(null)}>
            <CloseIcon />
          </button>
        </div>
      )}

      {loadError && (
        <div className="mr-state" role="alert">
          <p className="mr-state-title">Material requests could not be loaded</p>
          <p className="mr-state-text">{loadError}</p>
          <button type="button" className="mr-btn mr-btn--quiet" onClick={loadRequests}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="mr-loading" aria-busy="true">
          <div className="mr-tiles">
            {[0, 1, 2, 3].map((n) => (
              <span key={n} className="mr-skel mr-skel--tile" />
            ))}
          </div>
          <span className="mr-skel mr-skel--table" />
          <span className="ui-visually-hidden" role="status">Loading material requests</span>
        </div>
      ) : requests.length === 0 && !loadError ? (
        <div className="mr-state">
          <span className="mr-state-mark"><InboxIcon /></span>
          <p className="mr-state-title">No material requests</p>
          <p className="mr-state-text">Requests arrive here when a team leader draws from the store room.</p>
          <Link className="mr-btn mr-btn--quiet" to="/inventory">
            Open inventory
          </Link>
        </div>
      ) : requests.length > 0 ? (
        <>
          <section className="mr-tiles" aria-label="Requests by status">
            {tiles.map(({ key, label, value, note, tone, Icon }) => (
              <button
                key={key}
                type="button"
                className={`mr-tile mr-tile--${tone}`}
                aria-pressed={key === 'all' ? undefined : filter === key}
                onClick={() => {
                  if (key === 'all') {
                    setFilter('all');
                    setShowResolved(false);
                  } else {
                    toggleStage(key);
                  }
                }}
              >
                <span className="mr-tile-icon"><Icon /></span>
                <span className="mr-tile-value"><Counter value={value} /></span>
                <span className="mr-tile-label">{label}</span>
                <span className="mr-tile-note">{note}</span>
              </button>
            ))}
          </section>

          <div className="mr-layout">
            <div className="mr-main">
              {showPending && (
                <section className="mr-card ops-rise" style={rise(1)} aria-labelledby="ops-review-title">
                  <header className="mr-card-head">
                    <div>
                      <h2 className="mr-card-title" id="ops-review-title">Needs review</h2>
                      <p className="mr-card-sub">
                        {hasSearch ? `${pendingRequests.length} of ${counts.pending} match` : 'Oldest first'}
                      </p>
                    </div>
                    <div className="mr-card-tools">
                      {hasSearch && (
                        <button type="button" className="mr-link" onClick={resetFilters}>Clear filters</button>
                      )}
                      <span className="mr-count">{pendingRequests.length}</span>
                    </div>
                  </header>

                  {pendingRequests.length > 0 ? (
                    <ul className="mr-rows">
                      <li className="mr-row mr-row--head" aria-hidden="true">
                        <span>Request</span><span>Requested / in stock</span><span>Waiting</span><span />
                      </li>
                      {pendingRequests.map((request) => (
                        <Ticket
                          key={request._id}
                          request={request}
                          onOpen={openDetail}
                          onApprove={openApprove}
                          onReject={openReject}
                          busy={actionLoading === request._id}
                        />
                      ))}
                    </ul>
                  ) : (
                    <div className="mr-empty">
                      <span className="mr-state-mark"><CheckIcon /></span>
                      <p className="mr-state-title">Nothing waiting</p>
                      <p className="mr-state-text">
                        {counts.pending > 0 && hasSearch
                          ? 'No pending request matches the current filter.'
                          : 'Every request has been reviewed.'}
                      </p>
                      {counts.pending > 0 && hasSearch ? (
                        <button type="button" className="mr-btn mr-btn--quiet mr-btn--sm" onClick={resetFilters}>
                          Clear filters
                        </button>
                      ) : resolvedRequests.length > 0 ? (
                        <button type="button" className="mr-btn mr-btn--quiet mr-btn--sm" onClick={() => setShowResolved(true)}>
                          Review resolved
                        </button>
                      ) : null}
                    </div>
                  )}
                </section>
              )}

              {showResolvedSection && renderResolvedSection && (
                <section className="mr-card ops-rise" style={rise(2)} aria-labelledby="ops-resolved-title">
                  {isCollapsible ? (
                    <button
                      type="button"
                      className="mr-disclosure"
                      aria-expanded={showResolved}
                      aria-controls="ops-resolved-body"
                      onClick={() => setShowResolved((open) => !open)}
                    >
                      <span className="mr-card-title" id="ops-resolved-title">{filterLabel}</span>
                      <span className="mr-count">{resolvedRequests.length}</span>
                      <span className="mr-disclosure-mark"><ChevronIcon /></span>
                    </button>
                  ) : (
                    <header className="mr-card-head">
                      <div>
                        <h2 className="mr-card-title" id="ops-resolved-title">{filterLabel}</h2>
                        <p className="mr-card-sub">Most recently reviewed first</p>
                      </div>
                      <div className="mr-card-tools">
                        {hasSearch && (
                          <button type="button" className="mr-link" onClick={resetFilters}>Clear filters</button>
                        )}
                        <span className="mr-count">{resolvedForFilter.length}</span>
                      </div>
                    </header>
                  )}

                  {(!isCollapsible || showResolved) && (
                    <div id="ops-resolved-body">
                      {resolvedForFilter.length > 0 ? (
                        <ul className="mr-rows mr-rows--done">
                          <li className="mr-row mr-row--done mr-row--head" aria-hidden="true">
                            <span>Request</span><span>Requested by</span><span>Status</span><span>Reviewed</span>
                          </li>
                          {resolvedForFilter.map((request) => (
                            <li className="mr-row mr-row--done" key={request._id}>
                              <button
                                type="button"
                                className="mr-open"
                                aria-label={`Open ${request.status} request for ${request.quantity} of ${itemNameOf(request)}`}
                                onClick={() => openDetail(request)}
                              />
                              <span className="mr-cell mr-who">
                                <span className={`mr-face mr-face--${request.status}`} aria-hidden="true">
                                  {request.status === 'approved' ? <CheckIcon /> : <CloseIcon />}
                                </span>
                                <span className="mr-who-text">
                                  <span className="mr-item">{request.quantity} × {itemNameOf(request)}</span>
                                  <span className="mr-sub">{request.projectId?.name || 'Unknown project'}</span>
                                </span>
                              </span>
                              <span className="mr-cell mr-by">{request.requestedBy?.name || '—'}</span>
                              <span className="mr-cell">
                                <span className={`mr-pill mr-pill--${request.status}`}>{STATUS_LABEL[request.status]}</span>
                              </span>
                              <span className="mr-cell mr-date">{formatDay(request.reviewedAt || request.createdAt)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mr-empty">
                          <span className="mr-state-mark"><InboxIcon /></span>
                          <p className="mr-state-title">
                            No {filter === 'approved' ? 'approved' : filter === 'rejected' ? 'rejected' : 'resolved'} requests
                          </p>
                          {hasSearch ? (
                            <>
                              <p className="mr-state-text">None matches the current filter.</p>
                              <button type="button" className="mr-btn mr-btn--quiet mr-btn--sm" onClick={resetFilters}>
                                Clear filters
                              </button>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>

            {pendingAll.length > 0 && (
              <aside className="mr-side" aria-label="Queue summary">
                <section className="mr-card ops-rise" style={rise(2)} aria-labelledby="mr-wait-title">
                  <header className="mr-card-head">
                    <div>
                      <h2 className="mr-card-title" id="mr-wait-title">Longest waiting</h2>
                      <p className="mr-card-sub">Pending, oldest first</p>
                    </div>
                    <span className="mr-count">{pendingAll.length}</span>
                  </header>
                  <ul className="mr-list">
                    {pendingAll.slice(0, 5).map((request) => (
                      <li key={request._id}>
                        <button type="button" className="mr-list-row" onClick={() => openDetail(request)}>
                          <span className="mr-list-text">
                            <span className="mr-list-name">{itemNameOf(request)}</span>
                            <span className="mr-list-sub">{request.projectId?.name || 'Unknown project'}</span>
                            <span className="mr-meter mr-meter--thin" aria-hidden="true">
                              <i style={{ width: `${oldestWait > 0 ? Math.max(4, (waitMs(request.createdAt) / oldestWait) * 100) : 4}%` }} />
                            </span>
                          </span>
                          <span className={`mr-wait mr-wait--${waitTone(request.createdAt)}`}>{waitingLabel(request.createdAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="mr-card ops-rise" style={rise(3)} aria-labelledby="mr-project-title">
                  <header className="mr-card-head">
                    <div>
                      <h2 className="mr-card-title" id="mr-project-title">Pending by project</h2>
                      <p className="mr-card-sub">Select a project to filter</p>
                    </div>
                  </header>
                  <ul className="mr-ranks">
                    {byProject.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className="mr-rank"
                          aria-pressed={projectFilter === entry.id}
                          disabled={entry.id === 'unknown'}
                          onClick={() => setProjectFilter(projectFilter === entry.id ? 'all' : entry.id)}
                        >
                          <span className="mr-rank-name">{entry.name}</span>
                          <span className="mr-meter mr-meter--thin" aria-hidden="true">
                            <i style={{ width: `${maxByProject ? Math.round((entry.count / maxByProject) * 100) : 0}%` }} />
                          </span>
                          <b>{entry.count}</b>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="mr-card ops-rise" style={rise(4)} aria-labelledby="mr-short-title">
                  <header className="mr-card-head">
                    <div>
                      <h2 className="mr-card-title" id="mr-short-title">Short on stock</h2>
                      <p className="mr-card-sub">Requested more than the shelf holds</p>
                    </div>
                    <span className="mr-count">{shortOnStock.length}</span>
                  </header>
                  {shortOnStock.length > 0 ? (
                    <ul className="mr-list">
                      {shortOnStock.slice(0, 5).map((request) => (
                        <li key={request._id}>
                          <button type="button" className="mr-list-row" onClick={() => openDetail(request)}>
                            <span className="mr-list-text">
                              <span className="mr-list-name">{itemNameOf(request)}</span>
                              <span className="mr-list-sub">{request.projectId?.name || 'Unknown project'}</span>
                            </span>
                            <span className="mr-pill mr-pill--rejected">
                              {request.quantity} / {stockOf(request)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mr-note">Every pending request fits the stock on hand.</p>
                  )}
                </section>
              </aside>
            )}
          </div>
        </>
      ) : null}

      {detail && (
        <OpsOverlay className="ops-overlay--drawer" onClose={closeDetail}>
          <aside
            className="ops-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-request-title"
          >
            <header className="ui-modal__head">
              <div className="ui-grow">
                <div className="ops-detail__head">
                  <span className={`ops-mark ops-mark--${detail.status}`} aria-hidden="true" />
                  <span className="ops-detail__state">{STATUS_LABEL[detail.status]}</span>
                  <span className="ops-detail__stamp">{formatStamp(detail.createdAt)}</span>
                </div>
                <h2 className="ops-drawer__title" id="ops-request-title">
                  {detail.quantity} × {itemNameOf(detail)}
                </h2>
                <p className="ops-drawer__project">{detail.projectId?.name || 'Unknown project'}</p>
              </div>
              <button type="button" className="ui-icon-btn" aria-label="Close request" onClick={closeDetail} autoFocus>
                <CloseIcon />
              </button>
            </header>

            <div className="ops-drawer__body">
              <section className="ops-drawer__stock" aria-label="Stock">
                <StockBar requested={detail.quantity} available={detail.inventoryItemId?.availableQuantity} size="md" />
                <dl className="ops-stocknums">
                  <div>
                    <dt>Requested</dt>
                    <dd>{detail.quantity}</dd>
                  </div>
                  <div>
                    <dt>In stock</dt>
                    <dd>{detail.inventoryItemId?.availableQuantity ?? '—'}</dd>
                  </div>
                  {detail.status === 'pending' && detailStock != null ? (
                    <div>
                      <Tooltip label="Deducted from the shelf once, on approval">
                        <dt className="ops-stocknums__hint" tabIndex={0}>Left after</dt>
                      </Tooltip>
                      <dd className={detailShort ? 'is-short' : undefined}>
                        {Math.max(0, detailStock - detail.quantity)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <dl className="ops-facts">
                <div className="ops-fact">
                  <dt className="ops-fact__label">Requested by</dt>
                  <dd className="ops-fact__value ops-fact__person">
                    <span className="ui-avatar ui-avatar--sm" aria-hidden="true">
                      {initialsOf(detail.requestedBy?.name)}
                    </span>
                    <span
                      title={[detail.requestedBy?.email, detail.requestedBy?.department, detail.requestedBy?.semester ? `Sem ${detail.requestedBy.semester}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {detail.requestedBy?.name || 'Unknown requester'}
                    </span>
                  </dd>
                </div>
                <div className="ops-fact">
                  <dt className="ops-fact__label">Project</dt>
                  <dd className="ops-fact__value">{detail.projectId?.name || 'Unknown project'}</dd>
                </div>
                <div className="ops-fact">
                  <dt className="ops-fact__label">Category</dt>
                  <dd className="ops-fact__value">{detail.inventoryItemId?.category || '—'}</dd>
                </div>
                <div className="ops-fact">
                  <dt className="ops-fact__label">Location</dt>
                  <dd className="ops-fact__value">{detail.inventoryItemId?.location || '—'}</dd>
                </div>
              </dl>

              {detail.reason?.trim() ? (
                <section aria-labelledby="ops-detail-reason">
                  <h3 className="ops-section-label" id="ops-detail-reason">Reason</h3>
                  <p className="ops-quote">{detail.reason}</p>
                </section>
              ) : null}

              {detail.specifications?.trim() ? (
                <section aria-labelledby="ops-detail-spec">
                  <h3 className="ops-section-label" id="ops-detail-spec">Specifications</h3>
                  <p className="ops-quote">{detail.specifications}</p>
                </section>
              ) : null}

              {(detail.imageUrl || detail.documentUrl) && (
                <section aria-labelledby="ops-detail-files">
                  <h3 className="ops-section-label" id="ops-detail-files">Attachments</h3>
                  <div className="ops-attach">
                    {detail.imageUrl && (
                      <a
                        className="ops-attach__link"
                        href={detail.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img className="ops-attach__thumb" src={detail.imageUrl} alt="Component reference" />
                        <span>Component photo</span>
                      </a>
                    )}
                    {detail.documentUrl && (
                      <a
                        className="ops-attach__link"
                        href={detail.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <DocumentIcon />
                        <span>
                          {detail.documentOriginalName
                            ? detail.documentOriginalName
                            : 'Reference document'}
                        </span>
                      </a>
                    )}
                  </div>
                </section>
              )}

              {detail.status === 'rejected' && detail.rejectionReason && (
                <section aria-labelledby="ops-detail-rejection">
                  <h3 className="ops-section-label" id="ops-detail-rejection">Rejection reason</h3>
                  <p className="ops-quote ops-quote--negative">{detail.rejectionReason}</p>
                </section>
              )}

              <section aria-labelledby="ops-detail-timeline">
                <h3 className="ops-section-label" id="ops-detail-timeline">History</h3>
                <ol className="ops-steps">
                  <li className="ops-step is-done">
                    <span className="ops-step__dot" aria-hidden="true" />
                    <span className="ops-step__label">Submitted</span>
                    <span className="ops-step__when">
                      {formatStamp(detail.createdAt)}
                      {detail.requestedBy?.name ? ` · ${detail.requestedBy.name}` : ''}
                    </span>
                  </li>
                  <li
                    className={`ops-step${detail.status === 'pending' ? ' is-waiting' : ' is-done'}`}
                    data-status={detail.status}
                  >
                    <span className="ops-step__dot" aria-hidden="true" />
                    <span className="ops-step__label">
                      {detail.status === 'pending'
                        ? 'Awaiting review'
                        : detail.status === 'approved'
                          ? 'Approved'
                          : 'Rejected'}
                    </span>
                    <span className="ops-step__when">
                      {detail.status === 'pending'
                        ? 'With the project admin'
                        : `${formatStamp(detail.reviewedAt)}${detail.reviewedBy?.name ? ` · ${detail.reviewedBy.name}` : ''}`}
                    </span>
                  </li>
                </ol>
              </section>
            </div>

            <footer className="ui-modal__foot">
              {detail.status === 'pending' ? (
                <>
                  <button type="button" className="ui-btn ui-btn--quiet" onClick={() => openReject(detail)}>
                    Reject request
                  </button>
                  <button type="button" className="ui-btn ui-btn--primary" onClick={() => openApprove(detail)}>
                    Approve and allocate
                  </button>
                </>
              ) : (
                <button type="button" className="ui-btn ui-btn--ghost" onClick={closeDetail}>
                  Close
                </button>
              )}
            </footer>
          </aside>
        </OpsOverlay>
      )}

      {approveTarget && (
        <OpsOverlay onClose={closeApprove}>
          <div
            className="ui-modal ui-modal--narrow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-approve-title"
          >
            <header className="ui-modal__head">
              <div>
                <h2 className="ui-h2" id="ops-approve-title">Approve request</h2>
                <p className="ops-modal__sub">
                  {approveTarget.quantity} × {itemNameOf(approveTarget)} ·{' '}
                  {approveTarget.projectId?.name || 'Unknown project'}
                </p>
              </div>
              <button type="button" className="ui-icon-btn" aria-label="Close" onClick={closeApprove} autoFocus>
                <CloseIcon />
              </button>
            </header>
            <div className="ui-modal__body">
              <div className="ops-stack">
                <StockBar requested={approveTarget.quantity} available={approveTarget.inventoryItemId?.availableQuantity} size="md" />
                <dl className="ops-stocknums">
                  <div>
                    <dt>Requested</dt>
                    <dd>{approveTarget.quantity}</dd>
                  </div>
                  <div>
                    <dt>In stock</dt>
                    <dd>{approveTarget.inventoryItemId?.availableQuantity ?? '—'}</dd>
                  </div>
                  <div>
                    <Tooltip label="Deducted from the shelf once, on approval">
                      <dt className="ops-stocknums__hint" tabIndex={0}>Left after</dt>
                    </Tooltip>
                    <dd className={approveShort ? 'is-short' : undefined}>
                      {Math.max(0, approveStock - approveTarget.quantity)}
                    </dd>
                  </div>
                </dl>

                {approveShort ? (
                  <div className="ui-notice">
                    Requested quantity ({approveTarget.quantity}) exceeds currently available stock (
                    {approveStock}). Do you still wish to attempt approval?
                  </div>
                ) : null}

                <div className="ops-approve__who">
                  <span className="ui-avatar ui-avatar--sm" aria-hidden="true">
                    {initialsOf(approveTarget.requestedBy?.name)}
                  </span>
                  <span>{approveTarget.requestedBy?.name || 'Unknown requester'}</span>
                  <span className="ops-approve__stamp">{formatStamp(approveTarget.createdAt)}</span>
                </div>

                {approveError && (
                  <div className="ui-notice ui-notice--error" role="alert">{approveError}</div>
                )}
              </div>
            </div>
            <footer className="ui-modal__foot">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={closeApprove}>
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={confirmApprove}
                disabled={actionLoading === approveTarget._id}
              >
                {actionLoading === approveTarget._id
                  ? 'Approving…'
                  : approveShort
                    ? 'Attempt approval'
                    : 'Approve and allocate'}
              </button>
            </footer>
          </div>
        </OpsOverlay>
      )}

      {rejectTarget && (
        <OpsOverlay onClose={closeReject}>
          <div
            className="ui-modal ui-modal--narrow"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-reject-title"
          >
            <header className="ui-modal__head">
              <div>
                <h2 className="ui-h2" id="ops-reject-title">Reject request</h2>
                <p className="ops-modal__sub">
                  {rejectTarget.quantity} × {itemNameOf(rejectTarget)}
                </p>
              </div>
              <button type="button" className="ui-icon-btn" aria-label="Close" onClick={closeReject} autoFocus>
                <CloseIcon />
              </button>
            </header>
            <form onSubmit={handleReject}>
              <div className="ui-modal__body">
                <div className="ops-form-error">
                  <label className="ui-label" htmlFor="ops-reject-reason">Reason for rejection</label>
                  <textarea
                    id="ops-reject-reason"
                    className="ui-field ui-field--area"
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="What should the team leader change or provide?"
                    required
                  />
                  <p className="ui-hint">Shown to the team leader in their project history.</p>
                </div>
                {rejectError && (
                  <div className="ui-notice ui-notice--error ops-form-error" role="alert">
                    {rejectError}
                  </div>
                )}
              </div>
              <footer className="ui-modal__foot">
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  onClick={closeReject}
                  disabled={actionLoading === rejectTarget._id}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ui-btn ui-btn--danger"
                  disabled={actionLoading === rejectTarget._id || !rejectReason.trim()}
                >
                  {actionLoading === rejectTarget._id ? 'Rejecting…' : 'Confirm rejection'}
                </button>
              </footer>
            </form>
          </div>
        </OpsOverlay>
      )}
    </div>
  );
}
