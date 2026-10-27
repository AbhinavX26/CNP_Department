import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ProjectMentors } from '../../components/projects/ProjectMentors';
import { ProjectMaterials } from '../../components/projects/ProjectMaterials';
import { ProjectMaterialRequests } from '../../components/projects/ProjectMaterialRequests';
import { ProjectUpdates } from '../../components/projects/ProjectUpdates';
import { ProjectManagement } from '../../components/projects/ProjectManagement';
import { ProjectJoinRequests } from '../../components/projects/ProjectJoinRequests';
import { usePageLoading } from '../../context/LoadingContext';
import './projects.css';
import './project-details.css';

interface ProjectPerson {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  semester?: number | null;
  profileImage?: string | null;
}

interface ProjectMember {
  _id: string;
  studentId?: ProjectPerson;
  joinedAt?: string;
}

interface MentorAssignment {
  _id?: string;
  assignmentId?: string;
  isPrimary?: boolean;
  mentorId?: ProjectPerson;
}

interface ProjectRecord {
  _id: string;
  name: string;
  description?: string;
  status?: string;
  image?: string | null;
  teamLeaderId?: ProjectPerson | string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface MaterialSummary {
  total: number;
  guitar: number;
  purchased: number;
  owned: number;
}

interface RequestStats {
  total: number;
  approved: number;
  pending: number;
}

function initialOf(name?: string): string {
  return (name || '?').replace(/^Dr\.\s*/i, '').trim().charAt(0).toUpperCase() || '?';
}

function monogram(name?: string): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function fullDate(value?: string): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusText(status?: string): string {
  if (!status) return 'Active';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusKey(status?: string): 'active' | 'completed' | 'inactive' {
  return status === 'completed' || status === 'inactive' ? status : 'active';
}

const ArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CameraMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 8.5h3l1.4-2h6.2l1.4 2H20v9H4v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="12" cy="12.6" r="2.6" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const LockMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="5" y="10" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);


const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const PeopleIcon = () => <Icon><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6" /></Icon>;
const CapIcon = () => <Icon><path d="m2 9 10-5 10 5-10 5L2 9Zm5 3v4c0 1.5 2.5 3 5 3s5-1.5 5-3v-4" /></Icon>;
const BoxIcon = () => <Icon><path d="m4 8 8-4 8 4-8 4-8-4Zm0 0v8l8 4m8-12v8l-8 4m0-8v8" /></Icon>;
const CheckIcon = () => <Icon><path d="m5 12.5 4.5 4.5L19 7" /></Icon>;
const CalIcon = () => <Icon><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10.5h16M8 3.5v4M16 3.5v4" /></Icon>;
const ClockIcon = () => <Icon><path d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></Icon>;

function Face({ person, size = 40 }: { person?: ProjectPerson | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  return person?.profileImage ? (
    <img className="pdx-face" src={person.profileImage} alt="" style={style} />
  ) : (
    <span className="pdx-face" style={style} aria-hidden="true">{initialOf(person?.name)}</span>
  );
}

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setPageLoading } = usePageLoading();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [mentors, setMentors] = useState<MentorAssignment[]>([]);
  const [joinStatus, setJoinStatus] = useState<string>('none');
  const [pendingRequests, setPendingRequests] = useState<number | null>(null);
  const [materials, setMaterials] = useState<MaterialSummary | null>(null);
  const [requests, setRequests] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = async () => {
    setPageLoading(true);
    try {
      setError(null);
      const res = await api<any>('GET', `/projects/${id}`);
      if (!res.data) throw new Error('Project not found');
      setProject(res.data);

      const [mems, ments] = await Promise.all([
        api<any>('GET', `/projects/${id}/members`).then((r) => r.data).catch(() => []),
        api<any>('GET', `/projects/${id}/mentors`).then((r) => r.data).catch(() => []),
      ]);
      setMembers(mems || []);
      setMentors(ments || []);

      if (user?.role === 'student') {
        const reqs = await api<any>('GET', '/join-requests/student').then((r) => r.data).catch(() => []);
        const tlId = typeof res.data.teamLeaderId === 'object' ? res.data.teamLeaderId?._id : res.data.teamLeaderId;
        const isTL = tlId && user?._id && tlId === user._id;
        // `myRelation` is the API's own answer (leading | member | mentor | none),
        // so the page no longer re-derives it from the roster.
        const relation = res.data.myRelation;
        const isMember =
          relation === 'leading' ||
          relation === 'member' ||
          isTL ||
          (mems || []).some((m: any) => {
            const sId = typeof m.studentId === 'object' ? m.studentId?._id : m.studentId;
            return sId && user?._id && sId === user._id;
          });
        const hasPending = (reqs || []).some(
          (r: any) => (r.projectId?._id || r.projectId) === id && r.status === 'pending',
        );
        if (isMember) setJoinStatus('member');
        else if (hasPending) setJoinStatus('pending');
        else setJoinStatus('none');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load project details');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, user?._id]);

  useEffect(() => {
    if (!loading && window.location.hash) {
      setTimeout(() => {
        const el = document.querySelector(window.location.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [loading]);

  const handleJoin = async () => {
    try {
      await api('POST', `/projects/${id}/join`);
      setJoinStatus('pending');
      alert('Join request sent successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to join');
    }
  };

  /* The Team Leader cannot leave their own project — the API answers 409 — so the
     action is only offered to ordinary members. */
  const handleLeave = async () => {
    try {
      setLeaving(true);
      await api('DELETE', `/projects/${id}/join`);
      setJoinStatus('none');
      setConfirmLeave(false);
      await load();
    } catch (e: any) {
      alert(e.message || 'Could not leave the project');
    } finally {
      setLeaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      setLoading(true);
      await api('POST', `/projects/${id}/image`, formData);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to upload project image');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="prj-page prj-detail pdx" aria-busy="true" aria-label="Loading project">
        <span className="pdx-skel pdx-skel--hero" />
        <div className="pdx-tiles">{[0, 1, 2, 3].map((i) => <span key={i} className="pdx-skel pdx-skel--tile" />)}</div>
        <span className="pdx-skel pdx-skel--card" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="prj-page prj-detail pdx">
        <Link className="pdx-back" to="/projects"><ArrowLeft />Projects</Link>
        <div className="pdx-state" role="alert">
          <p className="pdx-state-title">This project could not be loaded</p>
          <p className="pdx-state-text">{error}</p>
          <div className="pdx-state-actions">
            <button type="button" className="pdx-btn pdx-btn--solid" onClick={load}>Try again</button>
            <button type="button" className="pdx-btn pdx-btn--quiet" onClick={() => navigate('/projects')}>Back to projects</button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const isTL = (m: ProjectMember) => {
    const tlId = typeof project.teamLeaderId === 'object' ? project.teamLeaderId?._id : project.teamLeaderId;
    const sId = typeof m.studentId === 'object' ? m.studentId?._id : m.studentId;
    return Boolean(tlId && sId && tlId === sId);
  };

  const projectTLId = typeof project.teamLeaderId === 'object' ? project.teamLeaderId?._id : project.teamLeaderId;
  const currentUserIsTL = Boolean(projectTLId && user?._id && projectTLId === user._id);
  const teamLeader = typeof project.teamLeaderId === 'object' ? project.teamLeaderId : null;

  const isMember =
    (members || []).some((m: any) => {
      const sId = typeof m.studentId === 'object' ? m.studentId?._id : m.studentId;
      return sId && user?._id && sId === user._id;
    }) || currentUserIsTL;

  const isAssignedMentor =
    user?.role === 'faculty_mentor' &&
    (mentors || []).some((m: any) => {
      const mId = typeof m.mentorId === 'object' ? m.mentorId?._id : m.mentorId;
      return mId && user?._id && mId === user._id;
    });

  const isProjectAdmin = user?.role === 'project_admin';
  const canAccessProjectContent = isProjectAdmin || isAssignedMentor || isMember;

  const relation = isProjectAdmin
    ? 'Project admin'
    : isAssignedMentor
      ? 'Mentor'
      : currentUserIsTL
        ? 'Team leader'
        : isMember
          ? 'Team member'
          : user?.role === 'student'
            ? joinStatus === 'pending'
              ? 'Request pending'
              : 'Not a member'
            : null;

  const pillKind = isProjectAdmin || isAssignedMentor ? 'staff' : currentUserIsTL ? 'core' : isMember ? 'member' : joinStatus === 'pending' ? 'pending' : 'member';

  const sortedMembers = [...(members || [])].sort((a, b) => {
    if (isTL(a)) return -1;
    if (isTL(b)) return 1;
    return (a.studentId?.name || '').localeCompare(b.studentId?.name || '');
  });

  const mentorPeople = (mentors || [])
    .map((assignment) => assignment.mentorId)
    .filter((person): person is ProjectPerson => Boolean(person));

  const status = statusKey(project.status);
  // MOCK: coverage is approved material requests over all requests, counted from
  // the rows ProjectMaterialRequests already fetched. Suggested API: an approval
  // summary on GET /projects/:id.
  const requestsTotal = requests?.total ?? 0;
  const requestsApproved = requests?.approved ?? 0;
  const coverPct = requestsTotal > 0 ? Math.round((requestsApproved / requestsTotal) * 100) : 0;

  const tiles = canAccessProjectContent
    ? [
        { label: members.length === 1 ? 'Member' : 'Members', value: members.length, note: teamLeader ? `Led by ${teamLeader.name}` : 'No team leader yet', tone: 'deep', Icon: PeopleIcon },
        { label: mentorPeople.length === 1 ? 'Mentor' : 'Mentors', value: mentorPeople.length, note: mentorPeople.length ? 'Faculty guidance' : 'None assigned', tone: 'blue', Icon: CapIcon },
        { label: 'Materials', value: materials?.total ?? 0, note: materials ? `${materials.purchased} purchased · ${materials.owned} owned` : 'Items tracked', tone: 'sky', Icon: BoxIcon },
        { label: 'Requests approved', value: requestsApproved, note: requestsTotal ? `of ${requestsTotal} material requests` : 'No requests yet', tone: 'mist', Icon: CheckIcon },
      ]
    : [
        { label: members.length === 1 ? 'Member' : 'Members', value: members.length, note: teamLeader ? `Led by ${teamLeader.name}` : 'No team leader yet', tone: 'deep', Icon: PeopleIcon },
        { label: mentorPeople.length === 1 ? 'Mentor' : 'Mentors', value: mentorPeople.length, note: mentorPeople.length ? 'Faculty guidance' : 'None assigned', tone: 'blue', Icon: CapIcon },
        { label: 'Created', value: project.createdAt ? new Date(project.createdAt).getDate() : 0, note: fullDate(project.createdAt), tone: 'sky', Icon: CalIcon },
        { label: 'Status', value: 0, note: statusText(project.status), tone: 'mist', Icon: ClockIcon },
      ];
  const visibleTiles = canAccessProjectContent ? tiles : tiles.slice(0, 2);

  return (
    <div className="prj-page prj-detail pdx">
      <Link className="pdx-back" to="/projects">
        <ArrowLeft />
        All projects
      </Link>

      {/* Hero */}
      <section className="pdx-hero" aria-labelledby="project-name">
        <div className="pdx-hero-body">
          <div className="pdx-logo-wrap">
            <span className={`pdx-logo is-${status}`} aria-hidden="true">
              {project.image ? <img src={project.image} alt="" /> : monogram(project.name)}
            </span>
            {isProjectAdmin && (
              <label className="pdx-logo-edit" title="Change project image">
                <CameraMark />
                <span className="ui-visually-hidden">Change project image</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} />
              </label>
            )}
          </div>

          <div className="pdx-hero-text">
            <p className="pdx-eyebrow">GUIITAR project</p>
            <div className="pdx-hero-title">
              <h1 id="project-name">{project.name}</h1>
              <span className={`pdx-status pdx-status--${status}`}>{statusText(project.status)}</span>
              {relation && !(user?.role === 'student' && joinStatus === 'none') ? (
                <span className={`pdx-pill pdx-pill--${pillKind}`}>{relation}</span>
              ) : null}
            </div>
            <p className="pdx-hero-desc">{project.description?.trim() || 'This project has not added a description yet.'}</p>

            <div className="pdx-hero-facts">
              <span className="pdx-fact">
                {teamLeader ? <Face person={teamLeader} size={32} /> : null}
                <span>
                  <small>Team leader</small>
                  <strong>{teamLeader?.name || 'Not assigned yet'}</strong>
                </span>
              </span>
              <span className="pdx-fact">
                <span>
                  <small>{members.length === 1 ? 'Member' : 'Members'}</small>
                  <strong>{members.length}</strong>
                </span>
              </span>
              <span className="pdx-fact">
                <span>
                  <small>{mentorPeople.length === 1 ? 'Mentor' : 'Mentors'}</small>
                  <strong>{mentorPeople.length ? mentorPeople.map((p) => p.name).filter(Boolean).slice(0, 2).join(', ') + (mentorPeople.length > 2 ? ` +${mentorPeople.length - 2}` : '') : 'Not assigned yet'}</strong>
                </span>
              </span>
            </div>
          </div>

          <div className="pdx-hero-actions">
            {user?.role === 'student' && joinStatus === 'none' ? (
              <button type="button" className="pdx-btn pdx-btn--light" onClick={handleJoin}>Join project</button>
            ) : null}
            {user?.role === 'student' && joinStatus === 'pending' ? (
              <span className="pdx-hint">Waiting for the team to review your request.</span>
            ) : null}
            {user?.role === 'student' && joinStatus === 'member' && !currentUserIsTL ? (
              confirmLeave ? (
                <span className="pdx-leave" role="group" aria-label="Confirm leaving this project">
                  <button type="button" className="pdx-btn pdx-btn--danger" onClick={handleLeave} disabled={leaving}>
                    {leaving ? 'Leaving…' : 'Confirm leave'}
                  </button>
                  <button type="button" className="pdx-btn pdx-btn--ghost" onClick={() => setConfirmLeave(false)} disabled={leaving}>Stay</button>
                </span>
              ) : (
                <button type="button" className="pdx-btn pdx-btn--ghost" onClick={() => setConfirmLeave(true)} title="Leave this project; you can request to join again">
                  Leave project
                </button>
              )
            ) : null}
            {isProjectAdmin && (
              <a className="pdx-btn pdx-btn--ghost" href="#manage" title="Project settings">Manage project</a>
            )}
          </div>
        </div>
      </section>

      <section className={`pdx-tiles${visibleTiles.length === 2 ? ' pdx-tiles--2' : ''}`} aria-label="Project at a glance">
        {visibleTiles.map(({ label, value, note, tone, Icon: TileIcon }) => (
          <div key={label} className={`pdx-tile pdx-tile--${tone}`}>
            <span className="pdx-tile-icon"><TileIcon /></span>
            <span className="pdx-tile-value">{label === 'Status' ? statusText(project.status) : value}</span>
            <span className="pdx-tile-label">{label}</span>
            <span className="pdx-tile-note">{note}</span>
          </div>
        ))}
      </section>

      <div className="pdx-layout">
        <div className="pdx-main">
          {isProjectAdmin || user?.role === 'faculty_mentor' ? (
            <ProjectJoinRequests projectId={project._id} onUpdate={load} onCountChange={setPendingRequests} />
          ) : null}

          {canAccessProjectContent ? (
            <ProjectUpdates projectId={project._id} projectName={project.name} isTL={currentUserIsTL} mentors={mentors} />
          ) : (
            <section className="pdx-card pdx-restricted" aria-labelledby="prj-restricted-title">
              <span className="pdx-empty-mark"><LockMark /></span>
              <h2 className="pdx-card-title" id="prj-restricted-title">Project work is restricted</h2>
              <p className="pdx-card-sub">
                {user?.role === 'student'
                  ? joinStatus === 'pending'
                    ? 'Updates and materials open when the team accepts your request.'
                    : 'Send a join request to open updates, materials and requests.'
                  : 'Open to the team, its mentors and project admins.'}
              </p>
            </section>
          )}

          <section className="pdx-card" aria-labelledby="prj-team-title">
            <header className="pdx-card-head">
              <div>
                <h2 className="pdx-card-title" id="prj-team-title">Team</h2>
                <p className="pdx-card-sub">{members.length} {members.length === 1 ? 'member' : 'members'}, team leader first</p>
              </div>
            </header>
            {members.length ? (
              <ul className="pdx-people">
                {sortedMembers.map((member) => (
                  <li key={member._id}>
                    <Face person={member.studentId} size={40} />
                    <span className="pdx-person-text">
                      <strong>{member.studentId?.name || 'Unknown student'}</strong>
                      <span>
                        {[member.studentId?.department, member.studentId?.semester ? `Semester ${member.studentId.semester}` : null]
                          .filter(Boolean)
                          .join(' · ') || 'Student'}
                      </span>
                    </span>
                    {isTL(member) ? <span className="pdx-pill pdx-pill--core">Team leader</span> : <span className="pdx-pill pdx-pill--member">Member</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="pdx-empty">
                <span className="pdx-empty-mark"><PeopleIcon /></span>
                <p className="pdx-empty-title">No members yet</p>
                <p className="pdx-empty-text">Members appear here once they join.</p>
              </div>
            )}
          </section>

          {canAccessProjectContent && (
            <>
              <ProjectMaterials projectId={project._id} isTL={currentUserIsTL} onSummaryChange={setMaterials} />
              <ProjectMaterialRequests projectId={project._id} isTL={currentUserIsTL} onStatsChange={setRequests} />
            </>
          )}

          <ProjectMentors
            projectId={project._id}
            mentors={mentors}
            onMentorsChange={(updatedMentors) => setMentors(updatedMentors)}
          />

          {isProjectAdmin && <ProjectManagement project={project} onUpdate={load} />}
        </div>

        <aside className="pdx-side" aria-label="Project facts">
          <section className="pdx-card pdx-card--dark">
            <header className="pdx-card-head">
              <div>
                <h2 className="pdx-card-title">Your access</h2>
                <p className="pdx-card-sub">What you can do here</p>
              </div>
            </header>
            <p className="pdx-access">{relation || 'Viewing'}</p>
            <p className="pdx-access-note">
              {canAccessProjectContent
                ? 'You can open updates, materials and requests.'
                : 'Updates and materials open to the team, its mentors and project admins.'}
            </p>
            {(isProjectAdmin || isAssignedMentor) && (
              <p className="pdx-access-note">
                {pendingRequests === null ? 'Loading join requests…' : `${pendingRequests} join ${pendingRequests === 1 ? 'request' : 'requests'} waiting.`}
              </p>
            )}
          </section>

          {canAccessProjectContent && (materials !== null || requests !== null) && (
            <section className="pdx-card" aria-labelledby="prj-cover-title">
              <header className="pdx-card-head">
                <div>
                  <h2 className="pdx-card-title" id="prj-cover-title">Materials</h2>
                  <p className="pdx-card-sub">{requestsTotal > 0 ? `${requestsApproved} of ${requestsTotal} requests approved` : 'No material requests yet'}</p>
                </div>
                <span className="pdx-count">{materials?.total ?? 0}</span>
              </header>
              <span className="pdx-meter" role="img" aria-label={`${requestsApproved} of ${requestsTotal} material requests approved`}>
                <i style={{ width: `${coverPct}%` }} />
              </span>
              <dl className="pdx-facts">
                <div><dt>Items</dt><dd>{materials?.total ?? 0}</dd></div>
                <div><dt>Approved</dt><dd>{requestsApproved}</dd></div>
                <div><dt>Requests</dt><dd>{requestsTotal}</dd></div>
              </dl>
            </section>
          )}

          <section className="pdx-card" aria-labelledby="prj-record-title">
            <header className="pdx-card-head">
              <div>
                <h2 className="pdx-card-title" id="prj-record-title">Record</h2>
                <p className="pdx-card-sub">When this project changed</p>
              </div>
            </header>
            <dl className="pdx-facts">
              <div><dt>Created</dt><dd><time dateTime={project.createdAt}>{fullDate(project.createdAt)}</time></dd></div>
              <div><dt>Last updated</dt><dd><time dateTime={project.updatedAt}>{fullDate(project.updatedAt)}</time></dd></div>
              <div><dt>Status</dt><dd>{statusText(project.status)}</dd></div>
            </dl>
            {isProjectAdmin && <a className="pdx-link" href="#manage">Edit project settings</a>}
          </section>
        </aside>
      </div>
    </div>
  );
}
