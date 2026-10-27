import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ProjectForm } from '../../components/projects/ProjectForm';
import { usePageLoading } from '../../context/LoadingContext';
import { AvatarStack, Counter } from '../../components/ui/vis';
import './projects.css';

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

const STATUS_LABEL: Record<StatusKey, string> = {
  active: 'Active',
  completed: 'Completed',
  inactive: 'Inactive',
};

const STATUS_NOTE: Record<StatusKey, string> = {
  active: 'Work in progress',
  completed: 'Delivered and closed',
  inactive: 'Paused for now',
};

/* What the signed-in person is to a project. Students vary row to row; a mentor
   or an admin holds one standing across the whole page. */
type RoleKey = 'lead' | 'member' | 'pending' | 'mentor' | 'admin';

const ROLE_LABEL: Record<RoleKey, string> = {
  lead: 'Team leader',
  member: 'Member',
  pending: 'Requested',
  mentor: 'Mentor',
  admin: 'Admin',
};

const ROLE_NOTE: Record<RoleKey, string> = {
  lead: 'You lead this project',
  member: 'You are on this team',
  pending: 'Your join request is pending',
  mentor: 'You mentor this project',
  admin: 'You administer this project',
};

const TABS: ('all' | StatusKey)[] = ['all', 'active', 'completed', 'inactive'];

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

/* ── Marks ────────────────────────────────────────────────────────────────── */

function SearchMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/* The lead glyph: a crown on a 12px grid, so it stays crisp at 11–14px —
   "this person leads" reads the same on a chip, a roster and a hero. */
function LeadMark({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none" aria-hidden="true" focusable="false">
      <path
        d="M2.6 8.3 2 3.3l2.4 1.8L6 2.6l1.6 2.5L10 3.3l-.6 5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M2.6 10.2h6.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* Waiting on a decision: a dashed ring, the one open mark in the set. */
function PendingMark({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="4.3" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.8" />
      <circle cx="6" cy="6" r="1.15" fill="currentColor" />
    </svg>
  );
}

function FolderMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7.5A1.5 1.5 0 0 1 5.5 6h4l1.6 2H18.5A1.5 1.5 0 0 1 20 9.5v7A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PulseMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5.5 12.5 4.2 4.2 8.8-9.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9.5" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 18.5a5.7 5.7 0 0 1 11.4 0M16 6.4a3 3 0 0 1 0 5.2M17.5 14.2a5.7 5.7 0 0 1 2.7 4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** The monogram plate on a row, with the status as a corner cut. */
function Plate({ project, status }: { project: ProjectRecord; status: StatusKey }) {
  return (
    <span className={`prj-plate is-${status}`} aria-hidden="true">
      {project.image ? <img src={project.image} alt="" /> : monogram(project.name)}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

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

  /* The tabs count what the search left standing, so a tab never promises rows
     the list will not show. */
  const tabCounts = useMemo(() => {
    const counts: Record<'all' | StatusKey, number> = {
      all: searched.length,
      active: 0,
      completed: 0,
      inactive: 0,
    };
    searched.forEach(({ status }) => {
      counts[status] += 1;
    });
    return counts;
  }, [searched]);

  /* The caller's standing on one project. Students vary row to row; a mentor's
     list is already their own and an admin runs everything on the board. */
  const roleOf = (item: (typeof decorated)[number]): RoleKey | null => {
    if (!user) return null;
    if (user.role === 'project_admin') return 'admin';
    if (user.role === 'faculty_mentor') return 'mentor';
    if (user.role !== 'student') return null;
    if (item.project.myRelation === 'leading' || (item.leader?._id && item.leader._id === user._id)) {
      return 'lead';
    }
    if (item.project.myRelation === 'member' || item.members.some((member) => member._id === user._id)) {
      return 'member';
    }
    return item.pending ? 'pending' : null;
  };

  /* A student's own projects lead the list; the sort is stable, so everything
     else keeps the order the API gave it. */
  const listed = (() => {
    const rows = searched.filter((item) => statusFilter === 'all' || item.status === statusFilter);
    if (user?.role !== 'student') return rows;
    const rank = (item: (typeof decorated)[number]) => {
      const role = roleOf(item);
      return role === 'lead' ? 0 : role === 'member' ? 1 : role === 'pending' ? 2 : 3;
    };
    return [...rows].sort((a, b) => rank(a) - rank(b));
  })();

  const ledProjects = useMemo(() => decorated.filter((item) => item.leader), [decorated]);

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

  /* Seats over projects: how many people a typical team holds. The server's
     `memberCount` wins over the fetched roster, so a capped roster cannot
     under-report a team. */
  const seats = decorated.reduce(
    (sum, item) => sum + (item.project.memberCount ?? item.members.length),
    0,
  );
  const perProject = projects.length ? Math.round(seats / projects.length) : 0;

  const tiles = [
    {
      key: 'all',
      tone: 'deep',
      label: 'Projects',
      value: projects.length,
      note: `${ledProjects.length} with a leader`,
      mark: <FolderMark />,
    },
    {
      key: 'active',
      tone: 'bright',
      label: 'Active',
      value: statusCounts.active,
      note: STATUS_NOTE.active,
      mark: <PulseMark />,
    },
    {
      key: 'completed',
      tone: 'soft',
      label: 'Completed',
      value: statusCounts.completed,
      note: statusCounts.inactive ? `${statusCounts.inactive} paused` : 'None paused',
      mark: <CheckMark />,
    },
    {
      key: 'students',
      tone: 'wash',
      label: 'Students on teams',
      value: uniqueStudents,
      note: uniqueStudents ? `About ${perProject} per project` : 'No teams yet',
      mark: <UsersMark />,
    },
  ];

  /* What the portfolio means to the person reading it: counts over the page,
     never a sentence. `myRelation` comes from the API, so the student counts do
     not depend on whether the roster call happened to succeed. */
  const gauges = (() => {
    if (!user || projects.length === 0) return [] as { key: string; label: string; value: number }[];

    if (user.role === 'student') {
      const leading = decorated.filter((item) => roleOf(item) === 'lead').length;
      const onTeam = decorated.filter((item) => roleOf(item) === 'member').length;
      return [
        { key: 'lead', label: 'Leading', value: leading },
        { key: 'team', label: 'On a team', value: onTeam },
        { key: 'req', label: 'Requesting', value: pendingProjectIds.length },
      ];
    }

    const scope =
      user.role === 'project_admin'
        ? 'Administering'
        : user.role === 'faculty_mentor'
          ? 'Mentoring'
          : 'On the board';
    return [
      { key: 'scope', label: scope, value: projects.length },
      { key: 'lead', label: 'With a leader', value: ledProjects.length },
      { key: 'active', label: 'Active now', value: statusCounts.active },
    ];
  })();

  const standingTitle = user?.role === 'student' ? 'Your standing' : 'Portfolio';

  const directorySub =
    user?.role === 'student'
      ? 'Your projects are listed first'
      : user?.role === 'faculty_mentor'
        ? 'The projects you mentor'
        : 'Every GUIITAR project on the board';

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  const TAB_LABEL: Record<'all' | StatusKey, string> = { all: 'All', ...STATUS_LABEL };

  return (
    <div className="prj-page">
      <header className="ui-page-head prj-head prj-rise" style={{ '--i': 0 } as CSSProperties}>
        <div className="ui-page-head__text">
          <h1 className="ui-title">Projects</h1>
          <p className="ui-sub prj-head__intro">
            Explore GUIITAR projects and see how each team is progressing.
          </p>
        </div>

        <div className="ui-page-actions prj-head__actions">
          <div className="ui-search prj-search">
            <SearchMark />
            <input
              className="ui-field"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects or leaders"
              aria-label="Search projects or leaders"
            />
          </div>
          {user?.role === 'project_admin' && (
            <button
              ref={newProjectTrigger}
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={() => setShowForm(true)}
            >
              New project
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
        <div className="ui-notice ui-notice--error prj-notice" role="alert">
          <span>{error}</span>
          <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={loadProjects}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div aria-hidden="true">
          <div className="prj-tiles">
            {[0, 1, 2, 3].map((cell) => (
              <span className="ui-skel prj-tile-skel" key={cell} />
            ))}
          </div>
          <div className="prj-layout">
            <div className="ui-panel prj-dir">
              <div className="prj-dir__head">
                <span className="ui-skel" style={{ width: '9rem', height: 14 }} />
              </div>
              {[0, 1, 2, 3].map((row) => (
                <div className="prj-skel-row" key={row}>
                  <span className="ui-skel prj-skel-row__mark" />
                  <span className="ui-skel prj-skel-row__main" />
                  <span className="ui-skel prj-skel-row__person" />
                </div>
              ))}
            </div>
            <aside className="prj-aside">
              <div className="ui-panel">
                <div className="ui-panel__body ui-stack">
                  {[0, 1, 2].map((row) => (
                    <span className="ui-skel" key={row} style={{ width: '100%', height: 16 }} />
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      ) : error && projects.length === 0 ? null : projects.length === 0 ? (
        <div className="ui-empty prj-empty">
          <span className="ui-empty__mark">
            <FolderMark />
          </span>
          <p className="ui-empty__title">No projects yet</p>
          <p className="ui-empty__text">
            {user?.role === 'project_admin'
              ? 'Create the first GUIITAR project to give a team a name and a board.'
              : 'Projects appear here once the council publishes them.'}
          </p>
          {user?.role === 'project_admin' && (
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => setShowForm(true)}>
              New project
            </button>
          )}
        </div>
      ) : (
        <>
          {/* The portfolio in four numbers: real counts, never a sentence. */}
          <ul className="prj-tiles" aria-label="Projects at a glance">
            {tiles.map((tile, index) => (
              <li
                key={tile.key}
                className={`prj-tile is-${tile.tone} prj-rise`}
                style={{ '--i': index + 1 } as CSSProperties}
              >
                <span className="prj-tile__mark">{tile.mark}</span>
                <span className="prj-tile__value">
                  <Counter value={tile.value} />
                </span>
                <span className="prj-tile__label">{tile.label}</span>
                <span className="prj-tile__note">{tile.note}</span>
              </li>
            ))}
          </ul>

          <div className="prj-layout">
            <section
              className="ui-panel prj-dir prj-rise"
              aria-labelledby="prj-dir-title"
              style={{ '--i': 5 } as CSSProperties}
            >
              <header className="prj-dir__head">
                <div className="prj-dir__titles">
                  <h2 className="prj-dir__title" id="prj-dir-title">
                    Project directory
                  </h2>
                  <p className="prj-dir__sub">{directorySub}</p>
                </div>

                <div className="prj-tabs" role="group" aria-label="Filter by status">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className="prj-tab"
                      aria-pressed={statusFilter === tab}
                      title={tab === 'all' ? 'Every project' : STATUS_NOTE[tab]}
                      onClick={() => setStatusFilter(tab)}
                    >
                      {TAB_LABEL[tab]}
                      <span className="prj-tab__count">{tabCounts[tab]}</span>
                    </button>
                  ))}
                </div>
              </header>

              <p className="ui-visually-hidden" aria-live="polite">
                {listed.length} of {projects.length} projects
              </p>

              {listed.length === 0 ? (
                <div className="ui-empty prj-empty prj-empty--board">
                  <span className="ui-empty__mark">
                    <FolderMark />
                  </span>
                  <p className="ui-empty__title">No projects match this view</p>
                  <p className="ui-empty__text">
                    {query.trim() ? `Nothing matches “${query.trim()}”.` : 'This status has no projects.'}
                  </p>
                  <button type="button" className="ui-btn ui-btn--quiet ui-btn--sm" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="prj-cols" aria-hidden="true">
                    <span>Project</span>
                    <span>Team leader</span>
                    <span>Team</span>
                    <span>Status</span>
                    <span>Your role</span>
                  </div>
                  <ul className="prj-rows">
                    {listed.map((item) => {
                      const { project, leader, members, status } = item;
                      const role = roleOf(item);
                      const mine = role === 'lead' || role === 'member' || role === 'pending';
                      const teamSize = project.memberCount ?? members.length;
                      const people = members.map((member) => ({
                        name: member.name || 'Unnamed student',
                        image: member.profileImage || undefined,
                      }));

                      return (
                        <li key={project._id}>
                          <Link
                            className={`prj-row is-${status}${mine ? ' is-mine' : ''}`}
                            to={`/projects/${project._id}`}
                          >
                            <span className="prj-cell prj-cell--project">
                              <Plate project={project} status={status} />
                              <span className="prj-row__main">
                                <span className="prj-row__name">{project.name}</span>
                                <span className="prj-row__line" title={project.description || undefined}>
                                  {project.description || 'No description yet.'}
                                </span>
                              </span>
                            </span>

                            <span className="prj-cell">
                              <span className="prj-cell__label">Team leader</span>
                              <span className={`prj-lead${leader ? '' : ' is-empty'}`}>
                                <span className="prj-lead__plate" aria-hidden="true">
                                  {leader?.profileImage ? (
                                    <img src={leader.profileImage} alt="" />
                                  ) : leader ? (
                                    initialOf(leader.name)
                                  ) : (
                                    '?'
                                  )}
                                </span>
                                <span className="prj-lead__name">{leader?.name || 'Not assigned'}</span>
                              </span>
                            </span>

                            <span className="prj-cell">
                              <span className="prj-cell__label">Team</span>
                              <span className="prj-team">
                                {people.length ? (
                                  <AvatarStack people={people} max={3} size="sm" />
                                ) : (
                                  <span className="prj-av-empty" role="img" aria-label="No team members yet" />
                                )}
                                <span className="prj-team__count">
                                  <strong>{teamSize}</strong> {teamSize === 1 ? 'member' : 'members'}
                                </span>
                              </span>
                            </span>

                            <span className="prj-cell">
                              <span className="prj-cell__label">Status</span>
                              <span className={`prj-status is-${status}`}>{STATUS_LABEL[status]}</span>
                            </span>

                            <span className="prj-cell">
                              <span className="prj-cell__label">Your role</span>
                              {role ? (
                                <span className={`prj-role is-${role}`} title={ROLE_NOTE[role]}>
                                  {role === 'lead' ? <LeadMark size={11} /> : null}
                                  {role === 'pending' ? <PendingMark size={11} /> : null}
                                  {ROLE_LABEL[role]}
                                </span>
                              ) : (
                                <span className="prj-role__none" aria-label="No role on this project">
                                  —
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            <aside className="prj-aside" aria-label="Portfolio summary">
              {gauges.length > 0 && (
                <section
                  className="ui-panel prj-side-panel prj-rise"
                  aria-labelledby="prj-standing-title"
                  style={{ '--i': 5 } as CSSProperties}
                >
                  <header className="prj-side__head">
                    <h2 className="prj-side__title" id="prj-standing-title">
                      {standingTitle}
                    </h2>
                    <span className="prj-side__meta">
                      <Counter value={projects.length} />
                    </span>
                  </header>
                  <ul className="prj-gauge">
                    {gauges.map((row) => (
                      <li className="prj-gauge__row" key={row.key}>
                        <span className="prj-gauge__label">{row.label}</span>
                        <span
                          className="prj-gauge__scale"
                          role="img"
                          aria-label={`${row.label}: ${row.value} of ${projects.length} projects`}
                        >
                          <span
                            className="prj-gauge__fill"
                            style={{ '--w': `${Math.min(100, (row.value / projects.length) * 100)}%` } as CSSProperties}
                          />
                        </span>
                        <span className="prj-gauge__num">
                          <Counter value={row.value} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {ledProjects.length > 0 && (
                <section
                  className="ui-panel prj-side-panel prj-rise"
                  aria-labelledby="prj-leaders-title"
                  style={{ '--i': 6 } as CSSProperties}
                >
                  <header className="prj-side__head">
                    <h2 className="prj-side__title" id="prj-leaders-title">
                      Team leaders
                    </h2>
                    <span className="prj-side__meta">
                      <Counter value={ledProjects.length} />
                    </span>
                  </header>
                  <ul className="prj-leaders">
                    {ledProjects.map(({ project, leader }) => (
                      <li key={project._id}>
                        <Link className="prj-leader" to={`/projects/${project._id}`}>
                          <span className="prj-lead__plate prj-lead__plate--round" aria-hidden="true">
                            {leader?.profileImage ? (
                              <img src={leader.profileImage} alt="" />
                            ) : (
                              initialOf(leader?.name)
                            )}
                          </span>
                          <span className="prj-leader__text">
                            <span className="prj-leader__name">{leader?.name}</span>
                            <span className="prj-leader__project">{project.name}</span>
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
