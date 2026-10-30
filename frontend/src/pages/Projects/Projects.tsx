import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ProjectForm } from '../../components/projects/ProjectForm';
import { usePageLoading } from '../../context/LoadingContext';
import './project-list.css';

/* ── Shapes the API returns ───────────────────────────────────────────────── */

interface ProjectPerson {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  semester?: number | null;
  profileImage?: string | null;
}

interface ProjectRecord {
  _id: string;
  name: string;
  description?: string;
  status?: string;
  image?: string | null;
  teamLeaderId?: ProjectPerson | string | null;
  /** Server-counted roster size — the truth even when the roster is capped. */
  memberCount?: number;
  /** The caller's own place: leading | member | mentor | none. */
  myRelation?: 'leading' | 'member' | 'mentor' | 'none';
  createdAt?: string;
  updatedAt?: string;
}

interface MemberRecord {
  _id: string;
  studentId?: ProjectPerson | string | null;
}

interface JoinRequestRecord {
  _id: string;
  projectId?: { _id?: string } | string | null;
  status?: string;
}

type StatusKey = 'active' | 'completed' | 'inactive';

const STATUS_ORDER: StatusKey[] = ['active', 'completed', 'inactive'];

const STATUS_LABEL: Record<StatusKey, string> = {
  active: 'Active',
  completed: 'Completed',
  inactive: 'Inactive',
};

type RelationKey = 'lead' | 'member' | 'pending';

function statusKey(status?: string): StatusKey {
  return status === 'completed' || status === 'inactive' ? status : 'active';
}

function personOf(value?: ProjectPerson | string | null): ProjectPerson | null {
  return value && typeof value === 'object' ? value : null;
}

function initialOf(name?: string): string {
  return (name || '?').replace(/^Dr\.\s*/i, '').trim().charAt(0).toUpperCase() || '?';
}

/* Two letters, like the club boards: Campus Energy Monitor reads CE. */
function monogram(name?: string): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const icon = (path: ReactNode) => () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);
const SearchIcon = icon(<><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></>);
const FolderIcon = icon(<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h4l1.6 2H18.5A1.5 1.5 0 0 1 20 9.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9Z" />);
const PulseIcon = icon(<path d="M3 12h4l2.5-6 4 12 2.5-6H21" />);
const CheckIcon = icon(<path d="m5 12.5 4.5 4.5L19 7" />);
const PeopleIcon = icon(<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6" />);

/** A person's photo, or their initial on the brand gradient. */
function Face({ person, size = 28 }: { person?: ProjectPerson | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  return person?.profileImage ? (
    <img className="pl-face" src={person.profileImage} alt="" style={style} />
  ) : (
    <span className="pl-face" style={style} aria-hidden="true">{initialOf(person?.name)}</span>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, ProjectPerson[]>>({});
  const [pendingProjectIds, setPendingProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StatusKey>('all');

  const { user } = useAuth();
  const { setPageLoading } = usePageLoading();
  const newProjectTrigger = useRef<HTMLButtonElement>(null);
  const closeForm = () => {
    setShowForm(false);
    newProjectTrigger.current?.focus();
  };

  const loadProjects = async () => {
    setPageLoading(true);
    try {
      setError(null);
      let list: ProjectRecord[] = [];
      if (user?.role === 'faculty_mentor') {
        const res = await api<any>('GET', `/mentors/${user._id}/projects`);
        list = (res.data || []).map((m: any) => m.project).filter(Boolean);
      } else {
        const res = await api<any>('GET', '/projects');
        list = res.data || [];
      }
      setProjects(list);

      // MOCK: GET /projects carries no roster, so team size and "your relation" are
      // joined client-side from the per-project member list (one call per project).
      // Suggested API: include member ids/count on GET /projects, or GET /projects?mine=1.
      const [rosters, pending] = await Promise.all([
        Promise.all(
          list.map((project) =>
            api<any>('GET', `/projects/${project._id}/members`)
              .then((res) => ({ id: project._id, members: res.data || [] }))
              .catch(() => ({ id: project._id, members: [] as MemberRecord[] })),
          ),
        ),
        user?.role === 'student'
          ? api<any>('GET', '/join-requests/student')
              .then((res) => (res.data || []) as JoinRequestRecord[])
              .catch(() => [] as JoinRequestRecord[])
          : Promise.resolve([] as JoinRequestRecord[]),
      ]);

      const index: Record<string, ProjectPerson[]> = {};
      rosters.forEach(({ id, members }) => {
        index[id] = (members as MemberRecord[])
          .map((member) => personOf(member.studentId))
          .filter((person): person is ProjectPerson => Boolean(person));
      });
      setMembersByProject(index);

      setPendingProjectIds(
        pending
          .filter((request) => request.status === 'pending')
          .map((request) => {
            const project = request.projectId;
            return typeof project === 'object' && project ? project._id || '' : String(project || '');
          })
          .filter(Boolean),
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to load projects');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  const decorated = useMemo(
    () =>
      projects.map((project) => {
        const leader = personOf(project.teamLeaderId);
        const members = membersByProject[project._id] || [];
        return {
          project,
          status: statusKey(project.status),
          leader,
          members,
          pending: pendingProjectIds.includes(project._id),
        };
      }),
    [projects, membersByProject, pendingProjectIds],
  );

  // MOCK: GET /projects takes no query, so search and the status filter run over the
  // fetched list. Suggested API: GET /projects?q=&status=.
  const searched = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return decorated;
    return decorated.filter(({ project, leader }) =>
      [project.name, project.description, leader?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [decorated, query]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusKey, number> = { active: 0, completed: 0, inactive: 0 };
    decorated.forEach(({ status }) => {
      counts[status] += 1;
    });
    return counts;
  }, [decorated]);

  const visibleStatuses = STATUS_ORDER.filter((status) => statusCounts[status] > 0);

  /* Only the student's standing varies row to row; the admin and mentor views
     already list a single relation for the whole page. */
  const relationOf = (item: (typeof decorated)[number]): RelationKey | null => {
    if (!user || user.role !== 'student') return null;
    if (item.leader?._id && item.leader._id === user._id) return 'lead';
    if (item.members.some((member) => member._id === user._id)) return 'member';
    if (item.pending) return 'pending';
    return null;
  };

  const leaders = useMemo(() => {
    const seen = new Set<string>();
    return decorated
      .map(({ project, leader }) => ({ project, leader }))
      .filter(({ leader }) => {
        if (!leader?._id || seen.has(leader._id)) return false;
        seen.add(leader._id);
        return true;
      });
  }, [decorated]);

  const studentPeople = useMemo(() => {
    const seen = new Map<string, ProjectPerson>();
    Object.values(membersByProject).forEach((members) =>
      members.forEach((member) => {
        if (member._id && !seen.has(member._id)) seen.set(member._id, member);
      }),
    );
    return Array.from(seen.values());
  }, [membersByProject]);

  const uniqueStudents = studentPeople.length;

  const gauges = useMemo(() => {
    const none = [] as { key: string; label: string; value: number; total?: number }[];
    if (!user || projects.length === 0) return none;
    const leading = decorated.filter((item) => item.project.myRelation === 'leading' || item.leader?._id === user._id).length;
    const onTeam = decorated.filter((item) => item.project.myRelation === 'member' || item.members.some((member) => member._id === user._id)).length;
    if (user.role === 'student') {
      return [
        { key: 'lead', label: 'Leading', value: leading, total: projects.length },
        { key: 'team', label: 'On a team', value: onTeam, total: projects.length },
        { key: 'req', label: 'Requesting', value: pendingProjectIds.length, total: projects.length },
      ];
    }
    if (user.role === 'project_admin') {
      return [
        { key: 'admin', label: 'Administering', value: projects.length, total: projects.length },
        { key: 'led', label: 'With a leader', value: leaders.length, total: projects.length },
      ];
    }
    if (user.role === 'faculty_mentor') {
      return [
        { key: 'mentor', label: 'Mentoring', value: projects.length, total: projects.length },
        { key: 'led', label: 'With a leader', value: leaders.length, total: projects.length },
      ];
    }
    return [{ key: 'led', label: 'With a leader', value: leaders.length, total: projects.length }];
  }, [user, decorated, projects.length, leaders.length, pendingProjectIds.length]);

  const standingTitle = user?.role === 'student' ? 'Your standing' : 'Portfolio';

  const myRoleLabel = (item: (typeof decorated)[number]): { kind: 'core' | 'member' | 'pending' | 'staff'; label: string } | null => {
    if (user?.role === 'project_admin') return { kind: 'staff', label: 'Admin' };
    if (user?.role === 'faculty_mentor') return { kind: 'staff', label: 'Mentor' };
    const relation = relationOf(item);
    if (relation === 'lead') return { kind: 'core', label: 'Team leader' };
    if (relation === 'member') return { kind: 'member', label: 'Member' };
    if (relation === 'pending') return { kind: 'pending', label: 'Request pending' };
    return null;
  };

  // Mine first (students), then active before completed before inactive, then by name.
  const ordered = useMemo(
    () =>
      [...searched]
        .filter((item) => statusFilter === 'all' || item.status === statusFilter)
        .sort((a, b) => {
          const mineA = Number(!!relationOf(a));
          const mineB = Number(!!relationOf(b));
          return (
            mineB - mineA ||
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
            a.project.name.localeCompare(b.project.name)
          );
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searched, statusFilter, user],
  );

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  const filtersActive = query.trim().length > 0 || statusFilter !== 'all';
  const totalOnTeams = uniqueStudents;
  const avgTeam = projects.length
    ? Math.round(decorated.reduce((n, item) => n + (item.project.memberCount ?? item.members.length), 0) / projects.length)
    : 0;

  const tiles = [
    { label: projects.length === 1 ? 'Project' : 'Projects', value: projects.length, note: `${leaders.length} with a leader`, tone: 'deep', Icon: FolderIcon },
    { label: 'Active', value: statusCounts.active, note: statusCounts.active ? 'Work in progress' : 'None running', tone: 'blue', Icon: PulseIcon },
    { label: 'Completed', value: statusCounts.completed, note: statusCounts.inactive ? `${statusCounts.inactive} paused` : 'Delivered and closed', tone: 'sky', Icon: CheckIcon },
    { label: 'Students on teams', value: totalOnTeams, note: projects.length ? `About ${avgTeam} per project` : 'No teams yet', tone: 'mist', Icon: PeopleIcon },
  ];

  const filters: { key: 'all' | StatusKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: projects.length },
    ...visibleStatuses.map((status) => ({ key: status, label: STATUS_LABEL[status], count: statusCounts[status] })),
  ];

  const maxScale = (row: { total?: number; value: number }) => (row.total ? Math.round((row.value / row.total) * 100) : 0);

  return (
    <div className="pl">
      <header className="pl-head">
        <div>
          <h1 className="pl-title">Projects</h1>
          <p className="pl-sub">Explore GUIITAR projects and see how each team is progressing.</p>
        </div>
        <div className="pl-tools">
          <label className="pl-search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects or leaders"
              aria-label="Search projects"
            />
          </label>
          {user?.role === 'project_admin' && (
            <button ref={newProjectTrigger} type="button" className="pl-btn" onClick={() => setShowForm(true)}>
              + New project
            </button>
          )}
        </div>
      </header>

      {showForm && (
        <ProjectForm
          onSave={() => {
            closeForm();
            loadProjects();
          }}
          onCancel={closeForm}
        />
      )}

      {error && (
        <div className="pl-state pl-state--error" role="alert">
          <p className="pl-state-title">The projects didn&rsquo;t load</p>
          <p className="pl-state-text">{error}</p>
          <button type="button" className="pl-btn pl-btn--quiet" onClick={loadProjects}>Try again</button>
        </div>
      )}

      {loading ? (
        <div className="pl-loading" aria-busy="true" aria-label="Loading projects">
          <div className="pl-tiles">{[0, 1, 2, 3].map((i) => <span key={i} className="pl-skel pl-skel--tile" />)}</div>
          <span className="pl-skel pl-skel--table" />
        </div>
      ) : error && projects.length === 0 ? null : projects.length === 0 ? (
        <div className="pl-state">
          <span className="pl-state-icon"><FolderIcon /></span>
          <p className="pl-state-title">No projects yet</p>
          <p className="pl-state-text">
            {user?.role === 'project_admin'
              ? 'Create the first GUIITAR project to give a team a name and a board.'
              : 'Projects appear here once the council publishes them.'}
          </p>
          {user?.role === 'project_admin' && (
            <button type="button" className="pl-btn" onClick={() => setShowForm(true)}>+ New project</button>
          )}
        </div>
      ) : (
        <>
          <section className="pl-tiles" aria-label="Projects at a glance">
            {tiles.map(({ label, value, note, tone, Icon }) => (
              <div key={label} className={`pl-tile pl-tile--${tone}`}>
                <span className="pl-tile-icon"><Icon /></span>
                <span className="pl-tile-value">{value}</span>
                <span className="pl-tile-label">{label}</span>
                <span className="pl-tile-note">{note}</span>
              </div>
            ))}
          </section>

          <div className="pl-layout">
            <section className="pl-card" aria-label="Project directory">
              <header className="pl-card-head">
                <div>
                  <h2 className="pl-card-title">Project directory</h2>
                  <p className="pl-card-sub">
                    {filtersActive ? `${ordered.length} of ${projects.length} projects match` : user?.role === 'student' ? 'Your projects are listed first' : 'Active projects first'}
                  </p>
                </div>
                <div className="pl-seg" role="group" aria-label="Filter by status">
                  {filters.map((f) => (
                    <button key={f.key} type="button" aria-pressed={statusFilter === f.key} onClick={() => setStatusFilter(f.key)}>
                      {f.label}<span>{f.count}</span>
                    </button>
                  ))}
                </div>
              </header>

              <p className="ui-visually-hidden" aria-live="polite">{ordered.length} of {projects.length} projects</p>

              {ordered.length === 0 ? (
                <div className="pl-empty">
                  <p className="pl-state-title">No projects match this view</p>
                  <p className="pl-state-text">{query.trim() ? `Nothing matches “${query.trim()}”.` : 'This status has no projects.'}</p>
                  <button type="button" className="pl-btn pl-btn--quiet" onClick={clearFilters}>Clear filters</button>
                </div>
              ) : (
                <ul className="pl-rows">
                  <li className="pl-row pl-row--head" aria-hidden="true">
                    <span>Project</span><span>Team leader</span><span>Team</span><span>Status</span><span>Your role</span>
                  </li>
                  {ordered.map((item) => {
                    const { project, leader, members, status } = item;
                    const role = myRoleLabel(item);
                    const size = project.memberCount ?? members.length;
                    return (
                      <li className={`pl-row${role && role.kind !== 'staff' ? ' is-mine' : ''}`} key={project._id}>
                        <span className="pl-cell pl-project">
                          <span className={`pl-plate is-${status}`} aria-hidden="true">
                            {project.image ? <img src={project.image} alt="" /> : monogram(project.name)}
                          </span>
                          <span className="pl-project-text">
                            <Link className="pl-open" to={`/projects/${project._id}`}>{project.name}</Link>
                            <span className="pl-desc">{project.description?.trim() || 'No description yet.'}</span>
                          </span>
                        </span>
                        <span className="pl-cell pl-leader" data-label="Team leader">
                          {leader?.name ? (
                            <>
                              <Face person={leader} size={26} />
                              <strong>{leader.name}</strong>
                            </>
                          ) : <span className="pl-muted">Not assigned</span>}
                        </span>
                        <span className="pl-cell pl-team" data-label="Team">
                          {members.length > 0 ? (
                            <span className="pl-stack" aria-hidden="true">
                              {members.slice(0, 3).map((m, i) => <Face key={m._id || i} person={m} size={24} />)}
                            </span>
                          ) : null}
                          <b>{size}</b>
                          <span className="pl-muted">{size === 1 ? 'member' : 'members'}</span>
                        </span>
                        <span className="pl-cell" data-label="Status">
                          <span className={`pl-pill pl-pill--${status}`}>{STATUS_LABEL[status]}</span>
                        </span>
                        <span className="pl-cell" data-label="Your role">
                          {role ? <span className={`pl-pill pl-pill--${role.kind}`}>{role.label}</span> : <span className="pl-muted">&mdash;</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <aside className="pl-side" aria-label="Portfolio summary">
              {gauges.length > 0 && (
                <section className="pl-card" aria-labelledby="pl-standing-title">
                  <header className="pl-card-head">
                    <h2 className="pl-card-title" id="pl-standing-title">{standingTitle}</h2>
                    <span className="pl-count">{projects.length}</span>
                  </header>
                  <ul className="pl-gauge">
                    {gauges.map((row) => (
                      <li key={row.key}>
                        <span className="pl-gauge-label">{row.label}</span>
                        <span className="pl-meter" role="img" aria-label={`${row.label}: ${row.value}${row.total ? ` of ${row.total}` : ''}`}>
                          <i style={{ width: `${maxScale(row)}%` }} />
                        </span>
                        <b>{row.value}</b>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {leaders.length > 0 && (
                <section className="pl-card" aria-labelledby="pl-leaders-title">
                  <header className="pl-card-head">
                    <h2 className="pl-card-title" id="pl-leaders-title">Team leaders</h2>
                    <span className="pl-count">{leaders.length}</span>
                  </header>
                  <ul className="pl-leaders">
                    {leaders.map(({ project, leader }) => (
                      <li key={project._id}>
                        <Link className="pl-leader-row" to={`/projects/${project._id}`}>
                          <Face person={leader} size={34} />
                          <span className="pl-leader-text">
                            <strong>{leader?.name || 'Not assigned'}</strong>
                            <span>{project.name}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
