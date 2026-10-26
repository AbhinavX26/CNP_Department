import { useNavigate } from 'react-router-dom';
import type { StudentDashboardData } from '../../../../types/studentDashboard';
import { MeterBar } from './charts';
import {
  asEvents,
  eventClubName,
  eventsByClub,
  eventStart,
  isTeamLeader,
  requestBreakdown,
  roleBreakdown,
} from './derive';
import {
  BellIcon,
  Card,
  CardError,
  ClubIcon,
  DARK,
  LIGHT,
  MID,
  ProjectIcon,
  RequestIcon,
  statusTone,
} from './ui';

interface PanelProps {
  data: StudentDashboardData;
  className?: string;
}

/** The three panels below share one gradient scheme and drop into any layout. */
export function OverviewPanel({ data, className = '' }: PanelProps) {
  const navigate = useNavigate();
  const { user, clubs, projects, joinRequests, unreadCount, errors } = data;
  const events = asEvents(data.upcomingEvents)
    .filter((e) => eventStart(e))
    .sort((a, b) => eventStart(a)!.getTime() - eventStart(b)!.getTime());
  const requestGroups = requestBreakdown(joinRequests);
  const roles = roleBreakdown(clubs, projects, user._id);
  const pending = requestGroups.reduce((s, g) => s + g.pending, 0);
  const approved = requestGroups.reduce((s, g) => s + g.approved, 0);
  const rejected = requestGroups.reduce((s, g) => s + g.rejected, 0);
  const tiles = [
    { label: 'Clubs joined', value: clubs.length, note: clubs.length ? `${roles.coreTeam} on a core team` : 'Not in a club yet', tone: 'deep', Icon: ClubIcon, to: '/clubs' },
    { label: 'Projects', value: projects.length, note: projects.length ? `${roles.leaders} as team leader` : 'No projects yet', tone: 'blue', Icon: ProjectIcon, to: '/projects' },
    { label: 'Pending requests', value: pending, note: `${approved} approved · ${rejected} declined`, tone: 'sky', Icon: RequestIcon, to: '/notifications' },
    { label: 'Unread alerts', value: unreadCount, note: unreadCount ? 'Open your inbox' : 'All caught up', tone: 'mist', Icon: BellIcon, to: '/notifications' },
  ];
  const nextUp = events.slice(0, 2);
  return (
    <div className="sdx">
          <Card
            title="Your overview"
            sub="Clubs, projects and requests at a glance"
            className={className}
          >
            {errors.clubs || errors.projects || errors.requests ? (
              <CardError message={errors.clubs || errors.projects || errors.requests || ''} />
            ) : null}
            <div className="sdx-tiles">
              {tiles.map(({ label, value, note, tone, Icon, to }) => (
                <button type="button" key={label} className={`sdx-tile sdx-tile--${tone}`} onClick={() => navigate(to)}>
                  <span className="sdx-tile-icon"><Icon /></span>
                  <span className="sdx-tile-value">{value}</span>
                  <span className="sdx-tile-label">{label}</span>
                  <span className="sdx-tile-note">{note}</span>
                </button>
              ))}
            </div>
            <div className="sdx-coming">
              <h4 className="sdx-coming-title">Coming up next</h4>
              {errors.events ? null : nextUp.length === 0 ? (
                <p className="sdx-foot">No events on the calendar yet.</p>
              ) : (
                <ul className="sdx-nextup" aria-label="Next events">
                  {nextUp.map((event) => {
                    const start = eventStart(event)!;
                    return (
                      <li key={event._id}>
                        <span className="sdx-date" aria-hidden="true">
                          <b>{start.getDate()}</b>
                          {start.toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <span className="sdx-nextup-text">
                          <strong title={event.title}>{event.title || 'Untitled event'}</strong>
                          <span>
                            {[eventClubName(event), event.location].filter(Boolean).join(' · ') || 'Details to be announced'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
    </div>
  );
}

export function ClubsPanel({ data, className = '' }: PanelProps) {
  const navigate = useNavigate();
  const { clubs, errors } = data;
  const events = asEvents(data.upcomingEvents).filter((e) => eventStart(e));
  const counts = eventsByClub(events);
  const clubRows = clubs.map((c) => ({ ...c, events: counts.get(c.club._id) ?? 0 }));
  const maxClubEvents = Math.max(...clubRows.map((c) => c.events), 0);
  return (
    <div className="sdx">
          <Card
            title="Your clubs"
            sub="Upcoming events and your role in each"
            action={{ label: 'Browse all clubs →', onClick: () => navigate('/clubs') }}
            className={className}
          >
            {errors.clubs ? (
              <CardError message={errors.clubs} />
            ) : clubRows.length === 0 ? (
              <p className="sdx-empty">You haven&rsquo;t joined a club yet. Browse the directory to find one.</p>
            ) : (
              <div className="sdx-table-wrap">
                <table className="sdx-table">
                  <thead>
                    <tr><th scope="col">#</th><th scope="col">Club</th><th scope="col">Events ahead</th><th scope="col">Role</th></tr>
                  </thead>
                  <tbody>
                    {clubRows.map((row, i) => {
                      const core = row.membership.membershipType === 'core_team';
                      const position = row.membership.position;
                      const role = core ? (position && position.toLowerCase() !== 'member' ? `Core · ${position}` : 'Core team') : 'Member';
                      return (
                        <tr key={row.club._id}>
                          <td>{String(i + 1).padStart(2, '0')}</td>
                          <td>
                            <button type="button" className="sdx-rowlink" onClick={() => navigate(`/clubs/${row.club._id}`)}>
                              {row.club.name}
                            </button>
                          </td>
                          <td>
                            <span className="sdx-metercell">
                              <MeterBar value={row.events} max={maxClubEvents} dark={DARK.dark} light={MID.light} />
                              <b>{row.events}</b>
                            </span>
                          </td>
                          <td><span className={`sdx-pill sdx-pill--${core ? 'info' : 'plain'}`}>{role}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
    </div>
  );
}

export function ProjectsPanel({ data, className = '' }: PanelProps) {
  const navigate = useNavigate();
  const { user, projects, errors } = data;
  const maxMentors = Math.max(...projects.map((p) => p.mentors.length), 0);
  return (
    <div className="sdx">
          <Card
            title="Your projects"
            sub="Mentors assigned and your role in each"
            action={{ label: 'Browse all projects →', onClick: () => navigate('/projects') }}
            className={className}
          >
            {errors.projects ? (
              <CardError message={errors.projects} />
            ) : projects.length === 0 ? (
              <p className="sdx-empty">You aren&rsquo;t on a project yet. Browse projects to request a place.</p>
            ) : (
              <div className="sdx-table-wrap">
                <table className="sdx-table">
                  <thead>
                    <tr><th scope="col">#</th><th scope="col">Project</th><th scope="col">Mentors</th><th scope="col">Status</th><th scope="col">Role</th></tr>
                  </thead>
                  <tbody>
                    {projects.map((project, i) => {
                      const leader = isTeamLeader(project, user._id);
                      return (
                        <tr key={project._id}>
                          <td>{String(i + 1).padStart(2, '0')}</td>
                          <td>
                            <button type="button" className="sdx-rowlink" onClick={() => navigate(`/projects/${project._id}`)}>
                              {project.name}
                            </button>
                          </td>
                          <td>
                            <span className="sdx-metercell">
                              <MeterBar value={project.mentors.length} max={maxMentors} dark={MID.dark} light={LIGHT.dark} />
                              <b>{project.mentors.length}</b>
                            </span>
                          </td>
                          <td>{project.status ? <span className={`sdx-pill sdx-pill--${statusTone(project.status)}`}>{project.status}</span> : <span className="sdx-muted">—</span>}</td>
                          <td><span className={`sdx-pill sdx-pill--${leader ? 'info' : 'plain'}`}>{leader ? 'Leader' : 'Member'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
    </div>
  );
}
