import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { UserDisplay } from '../../components/dashboard/legacy/UserDisplay';
import { EventCard } from '../../components/dashboard/legacy/EventCard';
import { EventForm } from '../../components/dashboard/legacy/EventForm';
import { StudentDashboardPage } from './StudentDashboardPage';
import { partitionEvents, useLocalDay } from '../../eventDate';
import { usePageLoading } from '../../context/LoadingContext';
import LoadingScreen from '../../components/LoadingScreen';
import './role-dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const { setPageLoading } = usePageLoading();
  const navigate = useNavigate();
  const today = useLocalDay();
  
  // FC & Club Admin State
  const [coordinatorClubs, setCoordinatorClubs] = useState<any[]>([]);
  const [coordinatorError, setCoordinatorError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [allClubsList, setAllClubsList] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // FM State
  const [mentorProjects, setMentorProjects] = useState<any[]>([]);
  
  // Club Admin State
  const [clubAdminStats, setClubAdminStats] = useState<any>(null);
  const [clubAdminRequests, setClubAdminRequests] = useState<any[]>([]);

  // Project Admin State
  const [projectAdminStats, setProjectAdminStats] = useState<any>(null);
  const [projectAdminRequests, setProjectAdminRequests] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const load = async () => {
      setPageLoading(true);
      try {
        if (user?.role === 'faculty_coordinator') {
          setCoordinatorError(null);
          let assignedClubs: any[] = [];
          try {
            const res = await api<any>('GET', `/clubs?coordinatorId=${user._id}`);
            assignedClubs = res.data || [];
          } catch (err: any) {
            console.error('Failed to load coordinator clubs:', err);
            setCoordinatorError(err.message || 'Failed to load assigned clubs.');
            assignedClubs = [];
          }
          setCoordinatorClubs(assignedClubs);
          setAllClubsList(assignedClubs);

          const reqPromises = assignedClubs.map((c: any) =>
            api<any>('GET', `/join-requests/club/${c._id}`).then(res => res.data).catch(() => [])
          );

          const [reqResults, allEvts, notifs] = await Promise.all([
            Promise.all(reqPromises),
            api<any>('GET', '/events').then(res => res.data).catch(() => []),
            api<any>('GET', '/notifications').then(res => res.data).catch(() => [])
          ]);

          const allPendingReqs = reqResults.flat().filter((r: any) => r.status === 'pending');
          setPendingRequests(allPendingReqs);

          const { upcoming, past } = partitionEvents(allEvts);

          setUpcomingEvents(upcoming);
          setPastEvents(past);
          setUnreadNotifications(notifs.filter((n: any) => !n.isRead).length);

        } else if (user?.role === 'club_admin') {
          const [allClubs, notifs, reqs, allEvts] = await Promise.all([
            api<any>('GET', '/clubs').then(res => res.data).catch(() => []),
            api<any>('GET', '/notifications').then(res => res.data).catch(() => []),
            api<any>('GET', '/join-requests/club/all').then(res => res.data).catch(() => []),
            api<any>('GET', '/events').then(res => res.data).catch(() => [])
          ]);
          setAllClubsList(allClubs);

          setClubAdminRequests(reqs.filter((r: any) => r.status === 'pending'));
          setClubAdminStats({
            totalClubs: allClubs.length,
            withCoordinator: allClubs.filter((c: any) => c.facultyCoordinatorId).length,
            withoutCoordinator: allClubs.filter((c: any) => !c.facultyCoordinatorId).length,
          });

          const { upcoming, past } = partitionEvents(allEvts);

          setUpcomingEvents(upcoming);
          setPastEvents(past);
          setUnreadNotifications(notifs.filter((n: any) => !n.isRead).length);
        } else if (user?.role === 'faculty_mentor') {
          const mProjects = await api<any>('GET', `/mentors/${user._id}/projects`).then(res => res.data);
          setMentorProjects(mProjects);

          const notifs = await api<any>('GET', '/notifications').then(res => res.data);
          setUnreadNotifications(notifs.filter((n: any) => !n.isRead).length);
        } else if (user?.role === 'project_admin') {
          const [projects, matReqs, inventory, notifs, reqs] = await Promise.all([
            api<any>('GET', '/projects').then(res => res.data),
            api<any>('GET', '/material-requests').then(res => res.data).catch(() => []),
            api<any>('GET', '/inventory').then(res => res.data).catch(() => []),
            api<any>('GET', '/notifications').then(res => res.data).catch(() => []),
            api<any>('GET', '/join-requests/project/all').then(res => res.data).catch(() => [])
          ]);
          
          setProjectAdminStats({
            totalProjects: projects.length,
            activeProjects: projects.filter((p: any) => p.status === 'active').length,
            completedProjects: projects.filter((p: any) => p.status === 'completed').length,
            inactiveProjects: projects.filter((p: any) => p.status === 'inactive').length,
            withTeamLeader: projects.filter((p: any) => p.teamLeaderId).length,
            pendingMaterialRequests: matReqs.filter((r: any) => r.status === 'pending').length,
            inventoryItems: inventory.length
          });
          setProjectAdminRequests(reqs.filter((r: any) => r.status === 'pending'));
          setUnreadNotifications(notifs.filter((n: any) => !n.isRead).length);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
  };

  useEffect(() => {
    if (user?.role !== 'student') void load();
  }, [user, today]);

  if (user?.role === 'student') return <StudentDashboardPage user={user} />;

  if (loading) return <LoadingScreen isReady={!loading} />;
  if (!user) return null;

  let roleLabel = 'Dashboard';
  let roleIntro = '';
  let primaryAction = 'View dashboard';
  let primaryPath = '/dashboard';
  let overviewSummary = '';
  const overviewAttention: string[] = [];

  switch (user.role) {
    case 'faculty_coordinator':
      roleLabel = 'Faculty Coordinator';
      roleIntro = 'Coordinate assigned clubs and university events.';
      primaryAction = 'Manage clubs';
      primaryPath = '/clubs';
      overviewSummary = coordinatorClubs.length + ' assigned ' + (coordinatorClubs.length === 1 ? 'club' : 'clubs') + ' and ' + upcomingEvents.length + ' upcoming ' + (upcomingEvents.length === 1 ? 'event.' : 'events.');
      if (pendingRequests.length) overviewAttention.push(pendingRequests.length + ' pending club ' + (pendingRequests.length === 1 ? 'request' : 'requests'));
      break;
    case 'faculty_mentor':
      roleLabel = 'Faculty Mentor';
      roleIntro = 'Keep your mentored GUIITAR projects moving.';
      primaryAction = 'View projects';
      primaryPath = '/projects';
      overviewSummary = 'You mentor ' + mentorProjects.length + ' ' + (mentorProjects.length === 1 ? 'project.' : 'projects.');
      break;
    case 'club_admin':
      roleLabel = 'Club Admin';
      roleIntro = 'Oversee club membership and campus events.';
      primaryAction = 'Manage clubs';
      primaryPath = '/clubs';
      overviewSummary = (clubAdminStats?.totalClubs ?? 0) + ' clubs and ' + upcomingEvents.length + ' upcoming ' + (upcomingEvents.length === 1 ? 'event.' : 'events.');
      if (clubAdminRequests.length) overviewAttention.push(clubAdminRequests.length + ' pending club ' + (clubAdminRequests.length === 1 ? 'request' : 'requests'));
      break;
    case 'project_admin':
      roleLabel = 'Project Admin';
      roleIntro = 'Coordinate project requests, materials, and inventory.';
      primaryAction = 'Manage projects';
      primaryPath = '/projects';
      overviewSummary = (projectAdminStats?.totalProjects ?? 0) + ' projects, including ' + (projectAdminStats?.activeProjects ?? 0) + ' active.';
      if (projectAdminRequests.length) overviewAttention.push(projectAdminRequests.length + ' pending project ' + (projectAdminRequests.length === 1 ? 'request' : 'requests'));
      if (projectAdminStats?.pendingMaterialRequests) overviewAttention.push(projectAdminStats.pendingMaterialRequests + ' material ' + (projectAdminStats.pendingMaterialRequests === 1 ? 'request to review' : 'requests to review'));
      break;
  }

  if (unreadNotifications) overviewAttention.push(unreadNotifications + ' unread ' + (unreadNotifications === 1 ? 'notification' : 'notifications'));

  return (
    <div className="staff-dash">
      <header className="student-dash-header">
        <div className="student-dash-header-copy">
          <p className="student-dash-eyebrow">
            {roleLabel} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="student-dash-title">
            Welcome back, <span className="student-dash-title-accent">{user.name.trim().split(/\s+/)[0] || user.name}</span>
          </h2>
          <p className="student-dash-lede">{roleIntro}</p>
        </div>
        <div className="student-dash-header-actions">
          <button
            type="button"
            className="student-dash-notification-link"
            onClick={() => navigate('/notifications')}
            aria-label={unreadNotifications ? 'Notifications, ' + unreadNotifications + ' unread' : 'Notifications'}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Notifications</span>
            {unreadNotifications > 0 ? <span className="student-dash-notification-count">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span> : null}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(primaryPath)}>
            {primaryAction}
          </button>
        </div>
      </header>

      <div className="student-dash-overview" role="region" aria-label="Dashboard summary">
        <p className="student-dash-overview-summary">{overviewSummary}</p>
        {overviewAttention.length ? (
          <ul className="student-dash-overview-attention">
            {overviewAttention.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : (
          <p className="student-dash-overview-quiet">No pending requests or unread notifications right now.</p>
        )}
      </div>
      
      {user?.role === 'faculty_coordinator' && (
        <div className="role-dashboard-grid role-dashboard-grid--coordinator">
          {/* Assigned Clubs Section (Multi-Card Grid, matching Faculty Mentor layout) */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Assigned Clubs</h3>
              <span className="badge badge-primary">{coordinatorClubs.length}</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {coordinatorError ? (
                <div
                  className="empty-state"
                  style={{
                    padding: '32px',
                    color: 'var(--danger, #ef4444)',
                    background: 'var(--surface)',
                    borderRadius: '12px',
                    border: '1px dashed var(--border)',
                    textAlign: 'center'
                  }}
                >
                  {coordinatorError}
                </div>
              ) : coordinatorClubs.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px'
                  }}
                >
                  {coordinatorClubs.map(club => (
                    <div
                      key={club._id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '20px',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        background: 'var(--bg-card-2)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                        {club.logo ? (
                          <img
                            src={club.logo}
                            alt={club.name}
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '12px',
                              objectFit: 'cover',
                              flexShrink: 0
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '12px',
                              background: 'var(--bg)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '24px',
                              flexShrink: 0
                            }}
                          >
                            🏛
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            style={{
                              margin: '0 0 6px 0',
                              fontSize: '18px',
                              fontWeight: 600,
                              color: 'var(--text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {club.name}
                          </h4>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '13px',
                              color: 'var(--text-faint)',
                              lineHeight: 1.4,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {club.description || 'No description provided.'}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            padding: '14px 12px',
                            borderRadius: '10px',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                            {club.totalMembers ?? club.memberCount ?? 0}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                            Total Members
                          </div>
                        </div>
                        <div
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--warn-soft)',
                            padding: '14px 12px',
                            borderRadius: '10px',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--warn)', marginBottom: '4px' }}>
                            {club.coreTeamCount ?? 0}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                            Core Team
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 'auto' }}>
                        <button
                          className="btn btn-primary"
                          style={{ width: '100%' }}
                          onClick={() => navigate(`/clubs/${club._id}`)}
                        >
                          Manage Club
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="empty-state"
                  style={{
                    padding: '40px',
                    background: 'var(--surface)',
                    borderRadius: '12px',
                    border: '1px dashed var(--border)',
                    textAlign: 'center'
                  }}
                >
                  No clubs assigned yet.
                </div>
              )}
            </div>
          </div>

          {/* Pending Join Requests */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Pending Join Requests</h3>
              {coordinatorClubs.length > 0 && pendingRequests.length > 0 && (
                <span className="badge badge-student" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                  {pendingRequests.length}
                </span>
              )}
            </div>
            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {coordinatorClubs.length > 0 ? (
                pendingRequests.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                      {pendingRequests.slice(0, 3).map(r => (
                        <div
                          key={r._id}
                          style={{
                            border: '1px solid var(--border)',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            fontSize: '14px',
                            background: 'var(--bg-card-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }}></div>
                            <div>
                              {r.studentId ? <UserDisplay user={r.studentId} showEmail={false} /> : <div style={{ fontWeight: 500 }}>Unknown Student</div>}
                              <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                                Club: {r.clubId?.name || (coordinatorClubs.find(c => c._id === (typeof r.clubId === 'object' ? r.clubId?._id : r.clubId))?.name) || 'Assigned Club'}
                              </div>
                            </div>
                          </div>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => navigate(`/clubs/${typeof r.clubId === 'object' ? r.clubId?._id : r.clubId}`)}
                          >
                            Review
                          </button>
                        </div>
                      ))}
                      {pendingRequests.length > 3 && (
                        <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', marginTop: '8px', fontStyle: 'italic' }}>
                          + {pendingRequests.length - 3} more pending requests
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                      <button
                        className="btn btn-outline"
                        style={{ width: '100%' }}
                        onClick={() => {
                          const targetClubId = (typeof pendingRequests[0]?.clubId === 'object' ? pendingRequests[0]?.clubId?._id : pendingRequests[0]?.clubId) || coordinatorClubs[0]?._id;
                          navigate(`/clubs/${targetClubId}`);
                        }}
                      >
                        Review Requests
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>No pending requests.</div>
                )
              ) : (
                <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>No clubs assigned yet.</div>
              )}
            </div>
          </div>

          {/* University Events */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="card-title" style={{ margin: 0 }}>University Events</h3>
                <span className="badge badge-success">{upcomingEvents.length} upcoming</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${eventTab === 'upcoming' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  onClick={() => setEventTab('upcoming')}
                >
                  Upcoming ({upcomingEvents.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${eventTab === 'past' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  onClick={() => setEventTab('past')}
                >
                  Past ({pastEvents.length})
                </button>
                {coordinatorClubs.length > 0 && !showEventForm && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                    onClick={() => { setEditingEvent(null); setShowEventForm(true); }}
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>

            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
              {showEventForm ? (
                <div style={{ padding: '16px' }}>
                  <EventForm
                    clubId={editingEvent ? (typeof editingEvent.clubId === 'object' ? editingEvent.clubId?._id : editingEvent.clubId) : coordinatorClubs[0]?._id}
                    event={editingEvent}
                    onSave={() => {
                      setShowEventForm(false);
                      setEditingEvent(null);
                      load();
                    }}
                    onCancel={() => {
                      setShowEventForm(false);
                      setEditingEvent(null);
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
                  {(eventTab === 'upcoming' ? upcomingEvents : pastEvents).length > 0 ? (
                    <div style={{ display: 'grid', gap: '14px', marginBottom: '20px' }}>
                      {(eventTab === 'upcoming' ? upcomingEvents : pastEvents).slice(0, 3).map(e => {
                        const eClubId = typeof e.clubId === 'object' ? e.clubId?._id : e.clubId;
                        const canManageEvent = user?.role === 'club_admin' || (user?.role === 'faculty_coordinator' && coordinatorClubs.some(c => c._id === eClubId));
                        return (
                          <EventCard
                            key={e._id}
                            event={e}
                            compact
                            isPast={eventTab === 'past'}
                            canManage={canManageEvent}
                            onEdit={evt => {
                              setEditingEvent(evt);
                              setShowEventForm(true);
                            }}
                            onDelete={async (id) => {
                              if (!window.confirm('Are you sure you want to delete this event?')) return;
                              try {
                                await api('DELETE', `/events/${id}`);
                                setUpcomingEvents(prev => prev.filter(x => x._id !== id));
                                setPastEvents(prev => prev.filter(x => x._id !== id));
                              } catch (err: any) {
                                alert(err.message || 'Failed to delete event');
                              }
                            }}
                          />
                        );
                      })}
                      {(eventTab === 'upcoming' ? upcomingEvents : pastEvents).length > 3 && (
                        <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', fontStyle: 'italic' }}>
                          + {(eventTab === 'upcoming' ? upcomingEvents : pastEvents).length - 3} more {eventTab} events
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ margin: 'auto', width: '100%', padding: '32px 16px' }}>
                      No {eventTab} events scheduled across clubs.
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                    <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => navigate('/events')}>
                      Manage Events
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Profile & Notifications Card */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Profile & Notifications</h3>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Unread Notifications</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)' }}>Stay updated with administrative alerts</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {unreadNotifications > 0 && <span className="badge badge-student" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', padding: '6px 12px' }}>{unreadNotifications} New</span>}
                  <button className="btn btn-sm btn-outline" onClick={() => navigate('/notifications')}>View All</button>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <UserDisplay user={user} showEmail={false} />
                  </div>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/profile')}>Edit Profile</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'faculty_mentor' && (
        <div className="role-dashboard-grid role-dashboard-grid--mentor">
          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Assigned Projects</h3>
              <span className="badge badge-primary">{mentorProjects.length}</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {mentorProjects.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {mentorProjects.map(mp => {
                    const p = mp.project;
                    const tlObj = typeof p.teamLeaderId === 'object' ? p.teamLeaderId : null;
                    return (
                      <div key={mp.assignmentId} style={{ display: 'flex', flexDirection: 'column', padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-card-2)' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                          {p.image ? (
                            <img src={p.image} alt={p.name} style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📋</div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h4>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-student'}`} style={{ padding: '2px 6px', fontSize: '11px' }}>{p.status}</span>
                              <span className="badge" style={{ background: mp.isPrimary ? 'var(--primary-glow)' : 'var(--bg)', color: mp.isPrimary ? 'var(--primary)' : 'var(--text-faint)', border: mp.isPrimary ? '1px solid rgba(var(--primary-rgb), 0.2)' : '1px solid var(--border)', fontSize: '11px' }}>
                                {mp.isPrimary ? 'Primary Mentor' : 'Secondary Mentor'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {tlObj && (
                          <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                              {tlObj.name.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Team Leader</div>
                              <UserDisplay user={tlObj} showEmail={false} />
                            </div>
                          </div>
                        )}

                        <div style={{ marginTop: 'auto' }}>
                          <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => navigate(`/projects/${p._id}`)}>View Project Details</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="empty-state" style={{ padding: '40px', background: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border)' }}>You are not assigned to any projects yet.</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Profile & Notifications</h3>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Unread Notifications</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)' }}>Stay updated with your projects</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {unreadNotifications > 0 && <span className="badge badge-student" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', padding: '6px 12px' }}>{unreadNotifications} New</span>}
                  <button className="btn btn-sm btn-outline" onClick={() => navigate('/notifications')}>View All</button>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <UserDisplay user={user} showEmail={false} />
                  </div>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/profile')}>Edit Profile</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'club_admin' && clubAdminStats && (
        <div className="role-dashboard-grid role-dashboard-grid--club-admin">
          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Club Administration</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>{clubAdminStats.totalClubs}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Clubs</div>
                </div>
                <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--success-soft)', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 12px rgba(var(--success-rgb), 0.05)' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--success)', marginBottom: '8px' }}>{clubAdminStats.withCoordinator}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>With Coordinator</div>
                </div>
                <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--warn-soft)', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 12px rgba(var(--warn-rgb), 0.05)' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--warn)', marginBottom: '8px' }}>{clubAdminStats.withoutCoordinator}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Needs Coordinator</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-primary" onClick={() => navigate('/clubs')}>Manage Clubs</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Pending Join Requests (All Clubs)</h3>
              {clubAdminRequests.length > 0 && <span className="badge badge-student" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>{clubAdminRequests.length}</span>}
            </div>
            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {clubAdminRequests.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                    {clubAdminRequests.slice(0, 3).map(r => (
                      <div key={r._id} style={{ border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-card-2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warn)' }}></div>
                        <div>
                          {r.studentId ? <UserDisplay user={r.studentId} showEmail={false} /> : <div style={{ fontWeight: 500 }}>Unknown Student</div>}
                          <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Requested to join: {r.clubId?.name || 'Unknown Club'}</div>
                        </div>
                      </div>
                    ))}
                    {clubAdminRequests.length > 3 && <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', marginTop: '8px', fontStyle: 'italic' }}>+ {clubAdminRequests.length - 3} more pending requests</div>}
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => navigate('/clubs')}>Manage via Clubs</button>
                  </div>
                </div>
              ) : <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>No pending requests.</div>}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="card-title" style={{ margin: 0 }}>University Events</h3>
                <span className="badge badge-success">{upcomingEvents.length} upcoming</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${eventTab === 'upcoming' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  onClick={() => setEventTab('upcoming')}
                >
                  Upcoming ({upcomingEvents.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${eventTab === 'past' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  onClick={() => setEventTab('past')}
                >
                  Past ({pastEvents.length})
                </button>
                {!showEventForm && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                    onClick={() => { setEditingEvent(null); setShowEventForm(true); }}
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>

            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
              {showEventForm ? (
                <div style={{ padding: '16px' }}>
                  <EventForm
                    availableClubs={allClubsList}
                    clubId={editingEvent ? (typeof editingEvent.clubId === 'object' ? editingEvent.clubId?._id : editingEvent.clubId) : undefined}
                    event={editingEvent}
                    onSave={() => {
                      setShowEventForm(false);
                      setEditingEvent(null);
                      load();
                    }}
                    onCancel={() => {
                      setShowEventForm(false);
                      setEditingEvent(null);
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
                  {(eventTab === 'upcoming' ? upcomingEvents : pastEvents).length > 0 ? (
                    <div style={{ display: 'grid', gap: '14px', marginBottom: '20px' }}>
                      {(eventTab === 'upcoming' ? upcomingEvents : pastEvents).slice(0, 3).map(e => (
                        <EventCard
                          key={e._id}
                          event={e}
                          compact
                          isPast={eventTab === 'past'}
                          canManage={true}
                          onEdit={evt => {
                            setEditingEvent(evt);
                            setShowEventForm(true);
                          }}
                          onDelete={async (id) => {
                            if (!window.confirm('Are you sure you want to delete this event?')) return;
                            try {
                              await api('DELETE', `/events/${id}`);
                              setUpcomingEvents(prev => prev.filter(x => x._id !== id));
                              setPastEvents(prev => prev.filter(x => x._id !== id));
                            } catch (err: any) {
                              alert(err.message || 'Failed to delete event');
                            }
                          }}
                        />
                      ))}
                      {(eventTab === 'upcoming' ? upcomingEvents : pastEvents).length > 3 && (
                        <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', fontStyle: 'italic' }}>
                          + {(eventTab === 'upcoming' ? upcomingEvents : pastEvents).length - 3} more {eventTab} events
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ margin: 'auto', width: '100%', padding: '32px 16px' }}>
                      No {eventTab} events scheduled across clubs.
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
                    <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => navigate('/events')}>
                      Manage Events
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Profile & Notifications</h3>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Unread Notifications</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)' }}>Stay updated with administrative alerts</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {unreadNotifications > 0 && <span className="badge badge-student" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', padding: '6px 12px' }}>{unreadNotifications} New</span>}
                  <button className="btn btn-sm btn-outline" onClick={() => navigate('/notifications')}>View All</button>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <UserDisplay user={user} showEmail={false} />
                  </div>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/profile')}>Edit Profile</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {user?.role === 'project_admin' && projectAdminStats && (
        <div className="role-dashboard-grid role-dashboard-grid--project-admin">
          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Project Administration Overview</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--border)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>{projectAdminStats.totalProjects}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Projects</div>
                </div>
                <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--success-soft)', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 12px rgba(var(--success-rgb), 0.05)' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--success)', marginBottom: '8px' }}>{projectAdminStats.activeProjects}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Active Projects</div>
                </div>
                <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--primary-soft)', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.05)' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>{projectAdminStats.withTeamLeader}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>With Team Leader</div>
                </div>
                <div style={{ background: 'var(--bg-card-2)', border: '1px solid var(--warn-soft)', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 12px rgba(var(--warn-rgb), 0.05)' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--warn)', marginBottom: '8px' }}>{projectAdminStats.pendingMaterialRequests}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Pending Mat. Requests</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => navigate('/projects')}>Manage Projects</button>
                <button className="btn btn-outline" onClick={() => navigate('/inventory')}>Guitar Inventory</button>
                <button className="btn btn-outline" onClick={() => navigate('/material-requests')}>Material Requests</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Pending Join Requests</h3>
              {projectAdminRequests.length > 0 && <span className="badge badge-student" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>{projectAdminRequests.length}</span>}
            </div>
            <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {projectAdminRequests.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                    {projectAdminRequests.slice(0, 3).map(r => (
                      <div key={r._id} style={{ border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-card-2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warn)' }}></div>
                        <div>
                          {r.studentId ? <UserDisplay user={r.studentId} showEmail={false} /> : <div style={{ fontWeight: 500 }}>Unknown Student</div>}
                          <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Requested: {r.projectId?.name || 'Unknown Project'}</div>
                        </div>
                      </div>
                    ))}
                    {projectAdminRequests.length > 3 && <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', marginTop: '8px', fontStyle: 'italic' }}>+ {projectAdminRequests.length - 3} more requests</div>}
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => navigate('/projects')}>Manage via Projects</button>
                  </div>
                </div>
              ) : <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>No pending project requests.</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ marginBottom: '16px' }}>
              <h3 className="card-title">Profile & Notifications</h3>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Unread Notifications</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-faint)' }}>Stay updated with project alerts</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {unreadNotifications > 0 && <span className="badge badge-student" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', padding: '6px 12px' }}>{unreadNotifications} New</span>}
                  <button className="btn btn-sm btn-outline" onClick={() => navigate('/notifications')}>View All</button>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <UserDisplay user={user} showEmail={false} />
                  </div>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => navigate('/profile')}>Edit Profile</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
