import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ClubManagement } from '../../components/clubs/ClubManagement';
import { MemberItem } from '../../components/clubs/MemberItem';
import { EventForm } from '../../components/events/EventForm';
import { partitionEvents, useLocalDay } from '../../eventDate';
import { usePageLoading } from '../../context/LoadingContext';
import './club-details.css';

const icon = (path: ReactNode) => () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);
const ArrowLeft = icon(<path d="M20 12H5M11 6l-6 6 6 6" />);
const UsersIcon = icon(<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6" />);
const StarIcon = icon(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />);
const CalendarIcon = icon(<><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10.5h16M8 3.5v4M16 3.5v4" /></>);
const ClockIcon = icon(<path d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />);
const CloseIcon = icon(<path d="M6 6l12 12M18 6 6 18" />);
const MailIcon = icon(<><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4.5 7 7.5 6 7.5-6" /></>);
const SearchIcon = icon(<><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></>);
const PinIcon = icon(<><path d="M12 20.5s6.2-5.1 6.2-9.7a6.2 6.2 0 1 0-12.4 0c0 4.6 6.2 9.7 6.2 9.7Z" /><circle cx="12" cy="10.6" r="2.2" /></>);
const EditIcon = icon(<><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 6.5 3 3" /></>);
const TrashIcon = icon(<path d="M4 7h16M9.5 7V4.8h5V7M6.6 7l.8 12a1.6 1.6 0 0 0 1.6 1.4h6a1.6 1.6 0 0 0 1.6-1.4l.8-12" />);

function initials(name?: string) {
  if (!name) return '?';
  return name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

const timeOf = (value?: string) =>
  value ? new Date(value).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
const fullDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

type PillKind = 'core' | 'member' | 'pending' | 'staff';

export default function ClubDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setPageLoading } = usePageLoading();
  const today = useLocalDay();

  const [club, setClub] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [clubEventTab, setClubEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [joinStatus, setJoinStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [memberQuery, setMemberQuery] = useState('');
  const [deletingEvent, setDeletingEvent] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const loadClubAndMembers = async () => {
    setPageLoading(true);
    try {
      // One club, with its counts and the caller's own membership, from one request.
      const c = await api<any>('GET', `/clubs/${id}`).then(res => res.data);
      if (!c) throw new Error('Not found');
      setClub(c);

      const mems = await api<any>('GET', `/clubs/${id}/members`).then(res => res.data);
      setMembers(mems);

      const evts = await api<any>('GET', `/clubs/${id}/events`).then(res => res.data).catch(() => []);
      const clubEvts = evts.filter((e: any) => {
        const eClubId = typeof e.clubId === 'object' ? e.clubId?._id : e.clubId;
        return !eClubId || eClubId === id;
      });
      const { upcoming, past } = partitionEvents(clubEvts);
      setUpcomingEvents(upcoming);
      setPastEvents(past);

      if (user?.role === 'student') {
        const reqs = await api<any>('GET', '/join-requests/student').then(res => res.data);
        const isMember = Boolean(c.myMembership) || mems.some((m: any) => m.studentId?._id === user._id);
        const hasPending = reqs.some((r: any) => r.clubId?._id === id && r.status === 'pending');
        if (isMember) setJoinStatus('member');
        else if (hasPending) setJoinStatus('pending');
        else setJoinStatus('none');
      }
    } catch (e: any) {
      alert('Error loading club details: ' + (e.message || 'Not found'));
      navigate('/clubs');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadClubAndMembers();
  }, [id, user, navigate, today]);

  useEffect(() => {
    if (!loading && window.location.hash) {
      setTimeout(() => {
        const el = document.querySelector(window.location.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [loading]);

  useEffect(() => {
    if (!deletingEvent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) setDeletingEvent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deletingEvent, deleting]);

  useEffect(() => {
    if (!showEventForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowEventForm(false);
        setEditingEvent(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showEventForm]);

  /* Leaving is the same door as joining: DELETE /clubs/:id/join. Core-team seats
     are removed by a coordinator, so the API refuses those (409) and we do not
     offer the action at all. */
  const handleLeave = async () => {
    try {
      setLeaving(true);
      await api('DELETE', `/clubs/${id}/join`);
      setJoinStatus('none');
      setConfirmLeave(false);
      await loadClubAndMembers();
    } catch (e: any) {
      alert(e.message || 'Could not leave the club');
    } finally {
      setLeaving(false);
    }
  };

  const handleJoin = async () => {
    try {
      await api('POST', `/clubs/${id}/join`);
      setJoinStatus('pending');
      alert('Join request sent successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to join');
    }
  };

  const coreTeam = useMemo(() => members.filter((m) => m.membershipType === 'core_team'), [members]);
  const regularMembers = useMemo(() => members.filter((m) => m.membershipType !== 'core_team'), [members]);

  // MOCK: the composition scale counts the members array; the API exposes no aggregate on this route.
  // Suggested API: include coreTeamCount / memberCount on GET /clubs/:id

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const rank = (m: any) => (m.membershipType === 'core_team' ? 0 : 1);
      return rank(a) - rank(b) || (a.studentId?.name || '').localeCompare(b.studentId?.name || '');
    });
  }, [members]);

  const shownMembers = useMemo(() => {
    // MOCK: member search runs client side over GET /clubs/:id/members.
    // Suggested API: GET /clubs/:id/members?q=
    const q = memberQuery.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter((m) =>
      [m.studentId?.name, m.studentId?.email, m.studentId?.department, m.position]
        .filter(Boolean)
        .some((field: string) => field.toLowerCase().includes(q)),
    );
  }, [sortedMembers, memberQuery]);

  if (loading) {
    return (
      <div className="cdx" aria-busy="true" aria-label="Loading club">
        <span className="cdx-skel cdx-skel--hero" />
        <div className="cdx-tiles">{[0, 1, 2, 3].map((i) => <span key={i} className="cdx-skel cdx-skel--tile" />)}</div>
        <span className="cdx-skel cdx-skel--card" />
      </div>
    );
  }

  if (!club) return null;

  const isCoordinator = user?.role === 'faculty_coordinator' &&
    (typeof club.facultyCoordinatorId === 'object' ? club.facultyCoordinatorId?._id : club.facultyCoordinatorId) === user?._id;
  const isClubAdmin = user?.role === 'club_admin';
  const canManage = isCoordinator || isClubAdmin;
  const isStudent = user?.role === 'student';

  const coordinator = typeof club.facultyCoordinatorId === 'object' ? club.facultyCoordinatorId : null;
  const myMembership = members.find((m) => m.studentId?._id === user?._id);
  const coreCount = coreTeam.length;
  const regularCount = regularMembers.length;
  const corePct = members.length ? Math.round((coreCount / members.length) * 100) : 0;
  const nextEvent = upcomingEvents[0] || null;
  const eventList = clubEventTab === 'upcoming' ? upcomingEvents : pastEvents;
  const logo = club.logo || null;

  const myPosition =
    myMembership?.membershipType === 'core_team' && myMembership?.position &&
    myMembership.position.toLowerCase() !== 'member'
      ? myMembership.position
      : null;

  const state: { kind: PillKind; label: string } | null = isClubAdmin
    ? { kind: 'staff', label: 'Club admin' }
    : isCoordinator
      ? { kind: 'staff', label: 'Coordinator' }
      : joinStatus === 'member'
        ? myMembership?.membershipType === 'core_team'
          ? { kind: 'core', label: myPosition ? `Core team · ${myPosition}` : 'Core team' }
          : { kind: 'member', label: 'Member' }
        : joinStatus === 'pending'
          ? { kind: 'pending', label: 'Request pending' }
          : null;

  const openNewEvent = () => { setEditingEvent(null); setShowEventForm(true); };

  const tiles = [
    { label: members.length === 1 ? 'Member' : 'Members', value: members.length, note: regularCount ? `${regularCount} regular` : 'No regular members yet', tone: 'deep', Icon: UsersIcon },
    { label: 'Core team', value: coreCount, note: members.length ? `${corePct}% of the club` : 'No seats filled', tone: 'blue', Icon: StarIcon },
    { label: 'Upcoming events', value: upcomingEvents.length, note: nextEvent ? `Next on ${fullDate(nextEvent.eventDate || nextEvent.date)}` : 'Nothing scheduled', tone: 'sky', Icon: CalendarIcon },
    { label: 'Past events', value: pastEvents.length, note: club.createdAt ? `Club since ${fullDate(club.createdAt)}` : 'Held so far', tone: 'mist', Icon: ClockIcon },
  ];

  const eventRow = (e: any) => {
    const raw = e.eventDate || e.date;
    const d = raw ? new Date(raw) : null;
    const valid = d !== null && !Number.isNaN(d.getTime());
    const past = clubEventTab === 'past';
    return (
      <li key={e._id} id={`event-${e._id}`} className={`cdx-event${past ? ' is-past' : ''}`}>
        <span className="cdx-date" aria-hidden="true">
          {valid ? (
            <>
              <small>{d!.toLocaleDateString(undefined, { month: 'short' })}</small>
              <b>{d!.getDate()}</b>
              <small>{d!.toLocaleDateString(undefined, { weekday: 'short' })}</small>
            </>
          ) : <b>TBD</b>}
        </span>
        <div className="cdx-event-main">
          <h3 className="cdx-event-title">{e.title}</h3>
          <p className="cdx-event-meta">
            {valid ? <span><ClockIcon />{timeOf(raw)}</span> : null}
            {e.location ? <span><PinIcon />{e.location}</span> : null}
          </p>
          {e.description ? <p className="cdx-event-desc">{e.description}</p> : null}
          {(e.eventLink || e.relatedDocument?.url) && (
            <p className="cdx-event-links">
              {e.eventLink && <a href={e.eventLink} target="_blank" rel="noopener noreferrer">{e.eventLinkName?.trim() || 'Event link'}</a>}
              {e.relatedDocument?.url && (
                <a href={e.relatedDocument.url} target="_blank" rel="noopener noreferrer">
                  {e.relatedDocumentName?.trim() || e.relatedDocument.originalName || 'Related document'}
                </a>
              )}
            </p>
          )}
        </div>
        <div className="cdx-event-side">
          <span className={`cdx-tag ${past ? 'is-past' : 'is-go'}`}>{past ? 'Past' : 'Upcoming'}</span>
          {canManage && (
            <span className="cdx-event-actions">
              <button type="button" className="cdx-icon-btn" aria-label={`Edit ${e.title}`} onClick={() => { setEditingEvent({ ...e, clubId: typeof e.clubId === 'object' && e.clubId ? e.clubId : club }); setShowEventForm(true); }}>
                <EditIcon />
              </button>
              <button type="button" className="cdx-icon-btn is-danger" aria-label={`Delete ${e.title}`} onClick={() => setDeletingEvent({ id: e._id, title: e.title || 'this event' })}>
                <TrashIcon />
              </button>
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="cdx">
      <button type="button" className="cdx-back" onClick={() => navigate('/clubs')}>
        <ArrowLeft />
        All clubs
      </button>

      {/* Hero */}
      <section className="cdx-hero" aria-labelledby="club-name">
        {club.coverImage ? <img className="cdx-hero-cover" src={club.coverImage} alt="" /> : null}
        <div className="cdx-hero-body">
          <span className="cdx-logo" aria-hidden="true">
            {logo ? <img src={logo} alt="" /> : initials(club.name)}
          </span>
          <div className="cdx-hero-text">
            <p className="cdx-hero-eyebrow">Student managed club</p>
            <div className="cdx-hero-title">
              <h1 id="club-name">{club.name}</h1>
              {state ? <span className={`cdx-pill cdx-pill--${state.kind}`}>{state.label}</span> : null}
            </div>
            <p className="cdx-hero-desc">{club.description?.trim() || 'This club has not added a description yet.'}</p>
            <div className="cdx-hero-facts">
              {coordinator?.name ? (
                <span className="cdx-fact">
                  <span className="cdx-face" aria-hidden="true">
                    {coordinator.profileImage ? <img src={coordinator.profileImage} alt="" /> : initials(coordinator.name)}
                  </span>
                  <span>
                    <small>Faculty coordinator</small>
                    <strong>{coordinator.name}</strong>
                  </span>
                  {coordinator.email ? (
                    <a className="cdx-fact-mail" href={`mailto:${coordinator.email}`} aria-label={`Email ${coordinator.name}`}><MailIcon /></a>
                  ) : null}
                </span>
              ) : (
                <span className="cdx-fact cdx-fact--void">
                  <span>
                    <small>Faculty coordinator</small>
                    <strong>Not assigned yet</strong>
                  </span>
                </span>
              )}
              <span className="cdx-fact">
                <span>
                  <small>Members</small>
                  <strong>{members.length}</strong>
                </span>
              </span>
              {club.createdAt ? (
                <span className="cdx-fact">
                  <span>
                    <small>Created</small>
                    <strong>{fullDate(club.createdAt)}</strong>
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="cdx-hero-actions">
            {isStudent && joinStatus === 'none' ? (
              <button type="button" className="cdx-btn cdx-btn--light" onClick={handleJoin}>Join club</button>
            ) : null}
            {isStudent && joinStatus === 'pending' ? (
              <span className="cdx-hint">Waiting for a coordinator to review your request.</span>
            ) : null}
            {isStudent && joinStatus === 'member' && myMembership?.membershipType !== 'core_team' ? (
              confirmLeave ? (
                <span className="cdx-leave" role="group" aria-label="Confirm leaving this club">
                  <button type="button" className="cdx-btn cdx-btn--danger" onClick={handleLeave} disabled={leaving}>
                    {leaving ? 'Leaving…' : 'Confirm leave'}
                  </button>
                  <button type="button" className="cdx-btn cdx-btn--ghost" onClick={() => setConfirmLeave(false)} disabled={leaving}>Stay</button>
                </span>
              ) : (
                <button type="button" className="cdx-btn cdx-btn--ghost" onClick={() => setConfirmLeave(true)} title="Leave this club; you can request to join again">
                  Leave club
                </button>
              )
            ) : null}
          </div>
        </div>
      </section>

      {canManage && (
        <section className="cdx-manage" aria-label="Manage this club">
          <div>
            <h2 className="cdx-card-title">Manage club</h2>
            <p className="cdx-card-sub">Review requests, edit details and keep the roster current.</p>
          </div>
          <ClubManagement club={club} onUpdate={loadClubAndMembers} />
        </section>
      )}

      <section className="cdx-tiles" aria-label="Club at a glance">
        {tiles.map(({ label, value, note, tone, Icon }) => (
          <div key={label} className={`cdx-tile cdx-tile--${tone}`}>
            <span className="cdx-tile-icon"><Icon /></span>
            <span className="cdx-tile-value">{value}</span>
            <span className="cdx-tile-label">{label}</span>
            <span className="cdx-tile-note">{note}</span>
          </div>
        ))}
      </section>

      <div className="cdx-layout">
        <div className="cdx-main">
          {/* Events */}
          <section className="cdx-card" aria-labelledby="club-events-title">
            <header className="cdx-card-head">
              <div>
                <h2 className="cdx-card-title" id="club-events-title">Events</h2>
                <p className="cdx-card-sub">{eventList.length} {clubEventTab}</p>
              </div>
              <div className="cdx-tools">
                <div className="cdx-seg" role="group" aria-label="Event period">
                  <button type="button" aria-pressed={clubEventTab === 'upcoming'} onClick={() => setClubEventTab('upcoming')}>Upcoming</button>
                  <button type="button" aria-pressed={clubEventTab === 'past'} onClick={() => setClubEventTab('past')}>Past</button>
                </div>
                {canManage && !showEventForm && (
                  <button type="button" className="cdx-btn cdx-btn--solid" onClick={openNewEvent}>Add event</button>
                )}
              </div>
            </header>
            {eventList.length > 0 ? (
              <ul className="cdx-events">{eventList.map(eventRow)}</ul>
            ) : (
              <div className="cdx-empty">
                <span className="cdx-empty-mark"><CalendarIcon /></span>
                <p className="cdx-empty-title">No {clubEventTab} events</p>
                {canManage && clubEventTab === 'upcoming' ? (
                  <button type="button" className="cdx-btn cdx-btn--solid" onClick={openNewEvent}>Add event</button>
                ) : (
                  <p className="cdx-empty-text">{clubEventTab === 'upcoming' ? 'Events appear here as soon as the club schedules them.' : 'Finished events are kept here.'}</p>
                )}
              </div>
            )}
          </section>

          {/* Members */}
          <section className="cdx-card" id="club-members" aria-labelledby="club-members-title">
            <header className="cdx-card-head">
              <div>
                <h2 className="cdx-card-title" id="club-members-title">Members</h2>
                <p className="cdx-card-sub">{members.length} in total, core team first</p>
              </div>
              {members.length > 6 && (
                <label className="cdx-search">
                  <SearchIcon />
                  <input type="search" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Find a member" aria-label="Search members" />
                </label>
              )}
            </header>
            {shownMembers.length > 0 ? (
              <ul className="cdx-members">
                {shownMembers.map((m) => (
                  <MemberItem key={m._id} m={m} clubId={club._id} canManage={canManage} onRefresh={loadClubAndMembers} />
                ))}
              </ul>
            ) : (
              <div className="cdx-empty">
                <span className="cdx-empty-mark"><UsersIcon /></span>
                <p className="cdx-empty-title">{members.length ? 'No member matches that search' : 'No members yet'}</p>
                {!members.length ? <p className="cdx-empty-text">Students join from the directory; approved requests land here.</p> : null}
              </div>
            )}
          </section>

          {club.images && club.images.length > 0 && (
            <section className="cdx-card" aria-labelledby="club-gallery-title">
              <header className="cdx-card-head">
                <div>
                  <h2 className="cdx-card-title" id="club-gallery-title">Gallery</h2>
                  <p className="cdx-card-sub">{club.images.length} {club.images.length === 1 ? 'photo' : 'photos'}</p>
                </div>
              </header>
              <div className="cdx-gallery">
                {club.images.map((img: any, i: number) => (
                  <img key={i} src={typeof img === 'string' ? img : img.url} alt={`${club.name} gallery image ${i + 1}`} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="cdx-side" aria-label="Club summary">
          <section className="cdx-card cdx-card--dark">
            <header className="cdx-card-head">
              <div>
                <h2 className="cdx-card-title">Next up</h2>
                <p className="cdx-card-sub">The club&rsquo;s next event</p>
              </div>
            </header>
            {nextEvent ? (
              <div className="cdx-next">
                <span className="cdx-next-date" aria-hidden="true">
                  <b>{new Date(nextEvent.eventDate || nextEvent.date).getDate()}</b>
                  {new Date(nextEvent.eventDate || nextEvent.date).toLocaleDateString(undefined, { month: 'short' })}
                </span>
                <span className="cdx-next-text">
                  <strong>{nextEvent.title}</strong>
                  <span>{[timeOf(nextEvent.eventDate || nextEvent.date), nextEvent.location].filter(Boolean).join(' · ')}</span>
                </span>
              </div>
            ) : (
              <p className="cdx-dark-empty">Nothing scheduled yet.</p>
            )}
          </section>

          <section className="cdx-card" aria-labelledby="club-core-title">
            <header className="cdx-card-head">
              <div>
                <h2 className="cdx-card-title" id="club-core-title">Core team</h2>
                <p className="cdx-card-sub">{coreCount} {coreCount === 1 ? 'seat' : 'seats'} filled</p>
              </div>
            </header>
            <span className="cdx-meter" role="img" aria-label={`${coreCount} of ${members.length} members sit on the core team`}>
              <i style={{ width: `${corePct}%` }} />
            </span>
            {coreTeam.length ? (
              <ul className="cdx-core">
                {coreTeam.map((m) => (
                  <li key={m._id}>
                    <span className="cdx-face cdx-face--lg" aria-hidden="true">
                      {m.studentId?.profileImage ? <img src={m.studentId.profileImage} alt="" /> : initials(m.studentId?.name)}
                    </span>
                    <span className="cdx-core-text">
                      <strong>{m.studentId?.name || 'Member'}</strong>
                      <span>{m.position && m.position.toLowerCase() !== 'member' ? m.position : 'Core team'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cdx-muted-text">No core team seats yet.</p>
            )}
          </section>
        </aside>
      </div>

      {showEventForm && (
        <div className="cdx-overlay ui-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowEventForm(false); setEditingEvent(null); } }}>
          <div className="ui-modal ui-modal--wide cdx-modal" role="dialog" aria-modal="true" aria-labelledby="clubs-event-form-title">
            <div className="ui-modal__head">
              <h2 id="clubs-event-form-title" className="ui-panel__title">{editingEvent ? 'Edit event' : 'New event'}</h2>
              <button type="button" className="ui-icon-btn" onClick={() => { setShowEventForm(false); setEditingEvent(null); }} aria-label="Close"><CloseIcon /></button>
            </div>
            <EventForm
              clubId={id!}
              event={editingEvent}
              onSave={() => { setShowEventForm(false); setEditingEvent(null); loadClubAndMembers(); }}
              onCancel={() => { setShowEventForm(false); setEditingEvent(null); }}
            />
          </div>
        </div>
      )}

      {deletingEvent && (
        <div className="cdx-overlay ui-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) setDeletingEvent(null); }}>
          <div className="ui-modal ui-modal--narrow cdx-modal" role="dialog" aria-modal="true" aria-labelledby="clubs-delete-event-title">
            <div className="ui-modal__head">
              <h2 id="clubs-delete-event-title" className="ui-panel__title">Delete event</h2>
              <button type="button" className="ui-icon-btn" onClick={() => setDeletingEvent(null)} disabled={deleting} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className="ui-modal__body">
              <p className="clubs-modal__danger-text">
                <strong>{deletingEvent.title}</strong> will be removed from the club and the department calendar. This cannot be undone.
              </p>
            </div>
            <div className="ui-modal__foot">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setDeletingEvent(null)} disabled={deleting}>Keep event</button>
              <button
                type="button"
                className="ui-btn ui-btn--danger"
                disabled={deleting}
                onClick={async () => {
                  try {
                    setDeleting(true);
                    await api('DELETE', `/events/${deletingEvent.id}`);
                    setUpcomingEvents(prev => prev.filter(x => x._id !== deletingEvent.id));
                    setPastEvents(prev => prev.filter(x => x._id !== deletingEvent.id));
                    setDeletingEvent(null);
                  } catch (err: any) {
                    alert(err.message || 'Failed to delete event');
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Deleting…' : 'Delete event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
