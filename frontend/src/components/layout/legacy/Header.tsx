import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../services/api';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownNotifs, setDropdownNotifs] = useState<any[]>([]);
  const [loadingDropdown, setLoadingDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = () => {
    if (user) {
      api<any>('GET', '/notifications/unread-count')
        .then((res) => setUnreadCount(res.count || 0))
        .catch(() => {});
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, [user, location.pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const toggleDropdown = async () => {
    if (!dropdownOpen) {
      setDropdownOpen(true);
      setLoadingDropdown(true);
      try {
        const res = await api<any>('GET', '/notifications?limit=5');
        setDropdownNotifs(res.data || []);
      } catch (err) {
        console.error('Failed to load dropdown notifications:', err);
      } finally {
        setLoadingDropdown(false);
      }
    } else {
      setDropdownOpen(false);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    setDropdownOpen(false);
    if (!notif.isRead) {
      try {
        await api('PATCH', `/notifications/${notif._id}/read`);
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    }
    if (notif.link) {
      navigate(notif.link);
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api('PATCH', '/notifications/read-all');
      setUnreadCount(0);
      setDropdownNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const getPageTitle = () => {
    const path = location.pathname.split('/')[1] || 'dashboard';
    if (path === 'about') return 'About us';
    return path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ');
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <header className={`app-header${dropdownOpen ? ' has-notif-open' : ''}`}>
      <h1 className="header-title">{getPageTitle()}</h1>
      <div className="header-actions">
        {user && (
          <span className="badge badge-student" style={{ padding: '6px 12px', fontSize: '12px' }}>
            {user.role.replace('_', ' ')}
          </span>
        )}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            className="notif-inbox-button"
            onClick={toggleDropdown}
            title="Inbox"
            aria-label={unreadCount > 0 ? `Inbox, ${unreadCount} unread notifications` : 'Inbox'}
            aria-expanded={dropdownOpen}
            aria-controls="notifications-panel"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
            </svg>
            <span>Inbox</span>
            {unreadCount > 0 && (
              <span className="notif-inbox-count" aria-hidden="true">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Popover */}
          {dropdownOpen && (
            <div
              id="notifications-panel"
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '360px',
                maxWidth: '90vw',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                overflow: 'hidden',
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              {/* Dropdown Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        background: 'var(--accent)',
                        color: 'white',
                        borderRadius: '10px',
                        padding: '1px 7px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '2px 4px',
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification Items List */}
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {loadingDropdown ? (
                  <div style={{ padding: '30px', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 8px auto', width: '24px', height: '24px' }}></div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading...</span>
                  </div>
                ) : dropdownNotifs.length > 0 ? (
                  dropdownNotifs.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => handleNotificationClick(n)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        background: n.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.04)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-2)')}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = n.isRead
                          ? 'transparent'
                          : 'rgba(99, 102, 241, 0.04)')
                      }
                    >
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: n.isRead ? 'transparent' : 'var(--accent)',
                          marginTop: '6px',
                          flexShrink: 0,
                        }}
                      ></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: n.isRead ? 600 : 700,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {n.title}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-faint)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatTimeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔔</div>
                    <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
                      No notifications
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      You are all caught up!
                    </div>
                  </div>
                )}
              </div>

              {/* Dropdown Footer */}
              <div
                style={{
                  padding: '10px 16px',
                  background: 'var(--bg)',
                  borderTop: '1px solid var(--border)',
                  textAlign: 'center',
                }}
              >
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/notifications');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  View All in Inbox →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
