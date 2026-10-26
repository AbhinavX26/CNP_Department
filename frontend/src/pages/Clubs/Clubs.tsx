import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ClubForm } from '../../components/clubs/ClubForm';
import { usePageLoading } from '../../context/LoadingContext';
import './clubs-page.css';

type RoleKind = 'core' | 'member' | 'pending' | 'staff';

interface Club {
  _id: string;
  name: string;
  description?: string;
  logo?: string | null;
  coverImage?: string | null;
  images?: string[];
  facultyCoordinatorId?: any;
  memberCount?: number;
  totalMembers?: number;
  coreTeamCount?: number;
}

const sizeOf = (c: Club) => c.memberCount ?? c.totalMembers ?? 0;

const initialsOf = (name: string) =>
  name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

/** Three steps of one blue, picked from the name so a person keeps their shade. */
const shade = (name: string) => (name.split('').reduce((n, ch) => n + ch.charCodeAt(0), 0) % 3) + 1;

function Mark({ name, image, size = 40 }: { name: string; image?: string | null; size?: number }) {
  return (
    <span className="cl-mark" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {image ? <img src={image} alt="" /> : initialsOf(name)}
    </span>
  );
}

function Face({ name, image, size = 32 }: { name: string; image?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return image ? (
    <img className="cl-face" src={image} alt="" style={style} />
  ) : (
    <span className={`cl-face cl-face--s${shade(name)}`} style={style} aria-hidden="true">{initialsOf(name)}</span>
  );
}

const icon = (path: ReactNode) => () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);
const SearchIcon = icon(<><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></>);
const ClubIcon = icon(<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />);
const PeopleIcon = icon(<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6" />);
const StarIcon = icon(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />);
const CapIcon = icon(<path d="m2 9 10-5 10 5-10 5L2 9Zm5 3v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4" />);

export default function Clubs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setPageLoading } = usePageLoading();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'mine'>('all');

  // Student specific state
  const [myMemberships, setMyMemberships] = useState<Record<string, any>>({});
  const [myPending, setMyPending] = useState<Record<string, boolean>>({});

  const loadClubs = async () => {
    setPageLoading(true);
    setError('');
    try {
      const res = await api<any>('GET', '/clubs');
      const allClubs: Club[] = res.data;
      setClubs(allClubs);

      // The roster is fetched once per club — the documented N+1. It feeds the
      // avatar stacks here as well as the student's membership map, so the club
      // admin sees the same faces the student does.
      const rosterEntries = await Promise.all(
        allClubs.map((c) =>
          api<any>('GET', `/clubs/${c._id}/members`)
            .then((r) => [c._id, r.data ?? []] as const)
            .catch(() => [c._id, [] as any[]] as const),
        ),
      );
      const rosters: Record<string, any[]> = {};
      rosterEntries.forEach(([clubId, list]) => {
        rosters[clubId] = list;
      });

      if (user?.role === 'student') {
        const reqs = await api<any>('GET', '/join-requests/student').then((r) => r.data);

        const pendingMap: Record<string, boolean> = {};
        reqs.forEach((r: any) => {
          if (r.status === 'pending' && r.clubId) {
            pendingMap[typeof r.clubId === 'object' ? r.clubId._id : r.clubId] = true;
          }
        });
        setMyPending(pendingMap);

        // The directory already carries the caller's own membership per club
        // (`myMembership`), so this is a read, not a scan of every roster. The
        // roster scan stays as a fallback for older cached payloads.
        const memberMap: Record<string, any> = {};
        allClubs.forEach((club: any) => {
          if (club.myMembership) memberMap[club._id] = club.myMembership;
        });
        if (Object.keys(memberMap).length === 0) {
          Object.entries(rosters).forEach(([clubId, list]) => {
            const me = list.find((x: any) => x.studentId?._id === user._id);
            if (me) memberMap[clubId] = me;
          });
        }
        setMyMemberships(memberMap);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Could not load the club directory.');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadClubs();
  }, [user]);

  const isStudent = user?.role === 'student';
  const canCreate = user?.role === 'club_admin';
  const joinedCount = Object.keys(myMemberships).length;

  const coordinatorCount = useMemo(() => {
    const ids = new Set<string>();
    clubs.forEach((c) => {
      const coord = typeof c.facultyCoordinatorId === 'object' ? c.facultyCoordinatorId : null;
      if (coord?._id) ids.add(coord._id);
    });
    return ids.size;
  }, [clubs]);

  const totalMembers = useMemo(
    () => clubs.reduce((sum, c) => sum + (c.memberCount ?? c.totalMembers ?? 0), 0),
    [clubs],
  );

  const coreTeamTotal = useMemo(
    () => clubs.reduce((sum, c) => sum + (c.coreTeamCount ?? 0), 0),
    [clubs],
  );

  const coveredClubs = useMemo(
    () => clubs.filter((c) => (typeof c.facultyCoordinatorId === 'object' ? c.facultyCoordinatorId?._id : c.facultyCoordinatorId)).length,
    [clubs],
  );

  // MOCK: search and the All / My clubs filter run over the full GET /clubs response.
  // Suggested API: GET /clubs?q=&scope=joined
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((c) => {
      if (scope === 'mine' && !myMemberships[c._id]) return false;
      if (!q) return true;
      const coord = typeof c.facultyCoordinatorId === 'object' ? c.facultyCoordinatorId : null;
      return [c.name, c.description, coord?.name, coord?.department]
        .filter(Boolean)
        .some((field: string) => field.toLowerCase().includes(q));
    });
  }, [clubs, query, scope, myMemberships]);

  // Clubs the student belongs to come first; everything else keeps the directory's own
  // alphabetical order so the grid never reshuffles between visits.
  const ordered = useMemo(
    () =>
      [...visible].sort((a, b) => {
        const mine = Number(!!myMemberships[b._id] || !!myPending[b._id]) - Number(!!myMemberships[a._id] || !!myPending[a._id]);
        return mine || a.name.localeCompare(b.name);
      }),
    [visible, myMemberships, myPending],
  );

  const filtersActive = query.trim().length > 0 || scope !== 'all';
  const myClubs = useMemo(() => clubs.filter((c) => myMemberships[c._id]), [clubs, myMemberships]);
  const biggest = useMemo(
    () => [...clubs].sort((a, b) => (b.memberCount ?? b.totalMembers ?? 0) - (a.memberCount ?? a.totalMembers ?? 0)),
    [clubs],
  );
  const maxMembers = Math.max(...biggest.map((c) => c.memberCount ?? c.totalMembers ?? 0), 0);

  const coordinatorList = useMemo(() => {
    // MOCK: coordinator → clubs grouping is derived from the directory payload.
    // Suggested API: GET /clubs/coordinators
    type CoordinatorEntry = {
      _id: string;
      name: string;
      department?: string;
      profileImage?: string | null;
      clubs: { _id: string; name: string }[];
    };
    const map = new Map<string, CoordinatorEntry>();
    clubs.forEach((c) => {
      const coord = typeof c.facultyCoordinatorId === 'object' ? c.facultyCoordinatorId : null;
      if (!coord?._id || !coord?.name) return;
      const entry: CoordinatorEntry = map.get(coord._id) || {
        _id: coord._id,
        name: coord.name,
        department: coord.department,
        profileImage: coord.profileImage,
        clubs: [],
      };
      entry.clubs.push({ _id: c._id, name: c.name });
      map.set(coord._id, entry);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [clubs]);

  const roleOf = (club: Club): { kind: RoleKind; label: string } | null => {
    if (user?.role === 'club_admin') return { kind: 'staff', label: 'Admin' };
    if (user?.role === 'faculty_coordinator') {
      const coordId = typeof club.facultyCoordinatorId === 'object' ? club.facultyCoordinatorId?._id : club.facultyCoordinatorId;
      if (coordId === user._id) return { kind: 'staff', label: 'Coordinator' };
    }
    if (myPending[club._id]) return { kind: 'pending', label: 'Request pending' };
    const membership = myMemberships[club._id];
    if (!membership) return null;
    if (membership.membershipType === 'core_team') {
      const position = membership.position && membership.position.toLowerCase() !== 'member' ? membership.position : null;
      return { kind: 'core', label: position ? `Core · ${position}` : 'Core team' };
    }
    return { kind: 'member', label: 'Member' };
  };

  const clearFilters = () => {
    setQuery('');
    setScope('all');
  };

  const withCoordinator = coveredClubs;
  const corePct = totalMembers > 0 ? Math.round((coreTeamTotal / totalMembers) * 100) : 0;
  const tiles = [
    { label: clubs.length === 1 ? 'Club' : 'Clubs', value: clubs.length, note: isStudent ? `${joinedCount} joined` : 'In the directory', tone: 'deep', Icon: ClubIcon },
    { label: totalMembers === 1 ? 'Member' : 'Members', value: totalMembers, note: clubs.length ? `About ${Math.round(totalMembers / clubs.length)} per club` : '', tone: 'blue', Icon: PeopleIcon },
    { label: 'Core team seats', value: coreTeamTotal, note: `${corePct}% of all members`, tone: 'sky', Icon: StarIcon },
    { label: coordinatorCount === 1 ? 'Coordinator' : 'Coordinators', value: coordinatorCount, note: clubs.length - withCoordinator > 0 ? `${clubs.length - withCoordinator} ${clubs.length - withCoordinator === 1 ? 'club' : 'clubs'} without one` : 'Every club covered', tone: 'mist', Icon: CapIcon },
  ];
  const noClubs = !loading && !error && clubs.length === 0;

  return (
    <div className="cl">
      <header className="cl-head">
        <div>
          <h1 className="cl-title">Clubs</h1>
          <p className="cl-sub">Student-managed clubs, who guides them and how big they are.</p>
        </div>
        <div className="cl-tools">
          <label className="cl-search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clubs or coordinators"
              aria-label="Search clubs by name, description or coordinator"
            />
          </label>
          {isStudent && (
            <div className="cl-seg" role="group" aria-label="Filter the directory">
              <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All</button>
              <button type="button" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>
                My clubs{joinedCount ? <span>{joinedCount}</span> : null}
              </button>
            </div>
          )}
          {canCreate && !showForm && (
            <button type="button" className="cl-btn" onClick={() => setShowForm(true)}>+ New club</button>
          )}
        </div>
      </header>

      {showForm && (
        <ClubForm onSave={() => { setShowForm(false); loadClubs(); }} onCancel={() => setShowForm(false)} />
      )}

      {error ? (
        <div className="cl-state" role="alert">
          <p className="cl-state-title">The club directory didn&rsquo;t load</p>
          <p className="cl-state-text">{error}</p>
          <button type="button" className="cl-btn cl-btn--quiet" onClick={loadClubs}>Try again</button>
        </div>
      ) : loading ? (
        <div aria-busy="true" aria-label="Loading clubs" className="cl-loading">
          <div className="cl-tiles">{[0, 1, 2, 3].map((i) => <span key={i} className="cl-skel cl-skel--tile" />)}</div>
          <span className="cl-skel cl-skel--table" />
        </div>
      ) : noClubs ? (
        <div className="cl-state">
          <p className="cl-state-title">No clubs yet</p>
          <p className="cl-state-text">
            {canCreate ? 'Clubs appear here as soon as they are created. Start the first one.' : 'The department has not published a student-managed club yet.'}
          </p>
        </div>
      ) : (
        <>
          <section className="cl-tiles" aria-label="Directory totals">
            {tiles.map(({ label, value, note, tone, Icon }) => (
              <div key={label} className={`cl-tile cl-tile--${tone}`}>
                <span className="cl-tile-icon"><Icon /></span>
                <span className="cl-tile-value">{value}</span>
                <span className="cl-tile-label">{label}</span>
                <span className="cl-tile-note">{note}</span>
              </div>
            ))}
          </section>

          <div className="cl-layout">
            <section className="cl-card" aria-label={filtersActive ? 'Filtered clubs' : 'Club directory'}>
              <header className="cl-card-head">
                <div>
                  <h2 className="cl-card-title">Club directory</h2>
                  <p className="cl-card-sub">
                    {filtersActive ? `${visible.length} of ${clubs.length} clubs match` : isStudent ? 'Your clubs are listed first' : 'Alphabetical'}
                  </p>
                </div>
                {filtersActive ? <button type="button" className="cl-link" onClick={clearFilters}>Clear filters</button> : null}
              </header>

              {visible.length === 0 ? (
                <p className="cl-empty">
                  {scope === 'mine' && !query.trim() ? 'You have not joined a club yet.' : `Nothing in ${clubs.length} clubs matches \u201c${query.trim()}\u201d.`}
                </p>
              ) : (
                <ul className="cl-rows">
                  <li className="cl-row cl-row--head" aria-hidden="true">
                    <span>Club</span><span>Coordinator</span><span>Members</span><span>Your role</span>
                  </li>
                  {ordered.map((club) => {
                    const coord = typeof club.facultyCoordinatorId === 'object' ? club.facultyCoordinatorId : null;
                    const role = roleOf(club);
                    const n = sizeOf(club);
                    const core = club.coreTeamCount ?? 0;
                    return (
                      <li className={`cl-row${role ? ' is-mine' : ''}`} key={club._id}>
                        <span className="cl-cell cl-club">
                          <Mark name={club.name} image={club.logo || club.coverImage || club.images?.[0]} />
                          <span className="cl-club-text">
                            <button type="button" className="cl-open" onClick={() => navigate(`/clubs/${club._id}`)}>{club.name}</button>
                            <span className="cl-desc">{club.description?.trim() || 'No description yet.'}</span>
                          </span>
                        </span>
                        <span className="cl-cell cl-coord" data-label="Coordinator">
                          {coord?.name ? (
                            <>
                              <Face name={coord.name} image={coord.profileImage} size={26} />
                              <span><strong>{coord.name}</strong>{coord.department ? <em>{coord.department}</em> : null}</span>
                            </>
                          ) : <span className="cl-muted">None assigned</span>}
                        </span>
                        <span className="cl-cell cl-size" data-label="Members">
                          <span className="cl-meter" role="img" aria-label={`${n} members, ${core} on the core team`}>
                            <i style={{ width: `${maxMembers ? Math.round((n / maxMembers) * 100) : 0}%` }} />
                          </span>
                          <b>{n}</b>
                        </span>
                        <span className="cl-cell cl-role" data-label="Your role">
                          {role ? <span className={`cl-pill cl-pill--${role.kind}`}>{role.label}</span> : <span className="cl-muted">&mdash;</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <aside className="cl-side" aria-label="Directory summary">
              {isStudent ? (
                <section className="cl-card">
                  <header className="cl-card-head"><h2 className="cl-card-title">Your clubs</h2><span className="cl-count">{myClubs.length}</span></header>
                  {myClubs.length ? (
                    <ul className="cl-list">
                      {myClubs.map((club) => {
                        const role = roleOf(club);
                        return (
                          <li key={club._id}>
                            <button type="button" className="cl-list-row" onClick={() => navigate(`/clubs/${club._id}`)}>
                              <Mark name={club.name} image={club.logo || club.coverImage || club.images?.[0]} size={34} />
                              <span className="cl-list-name">{club.name}</span>
                              {role ? <span className={`cl-pill cl-pill--${role.kind}`}>{role.label}</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="cl-empty">You haven&rsquo;t joined a club yet. Open one from the directory and send a request.</p>
                  )}
                </section>
              ) : (
                <section className="cl-card">
                  <header className="cl-card-head"><h2 className="cl-card-title">Members per club</h2><span className="cl-count">{totalMembers}</span></header>
                  <ul className="cl-ranks">
                    {biggest.map((club) => (
                      <li key={club._id}>
                        <span className="cl-rank-name">{club.name}</span>
                        <span className="cl-meter"><i style={{ width: `${maxMembers ? Math.round((sizeOf(club) / maxMembers) * 100) : 0}%` }} /></span>
                        <b>{sizeOf(club)}</b>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="cl-card">
                <header className="cl-card-head"><h2 className="cl-card-title">Faculty coordinators</h2><span className="cl-count">{coordinatorList.length}</span></header>
                {coordinatorList.length ? (
                  <ul className="cl-list">
                    {coordinatorList.map((coord) => (
                      <li className="cl-person" key={coord._id}>
                        <Face name={coord.name} image={coord.profileImage} size={34} />
                        <span className="cl-person-text">
                          <strong>{coord.name}</strong>
                          <span>{coord.department || 'Faculty'}</span>
                          <span className="cl-chips">
                            {coord.clubs.map((club) => (
                              <button type="button" key={club._id} onClick={() => navigate(`/clubs/${club._id}`)}>{club.name}</button>
                            ))}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="cl-empty">No faculty coordinator has been assigned yet.</p>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
