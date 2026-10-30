import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type RefObject,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { User } from '../../types';
import { Tooltip } from '../../components/ui/Tooltip';
import { initialsOf, roleLabel } from './labels';
import {
  AlertIcon,
  CameraIcon,
  CheckIcon,
  CopyIcon,
  FieldGlyph,
  LockIcon,
  PencilIcon,
  type FieldKind,
} from './icons';
import './profile.css';
import './profile-page.css';

type ProfileUser = User & { createdAt?: string };

/** The fields that can be missing, and therefore can be focused from the plate. */
type EditField = 'name' | 'department' | 'phone' | 'universityId' | 'semester' | 'bio';

interface CompletenessField {
  key: EditField;
  label: string;
  done: boolean;
}

const stagger = (i: number) => ({ '--prf-i': i } as CSSProperties);

const TONES = ['deep', 'blue', 'sky', 'mist'] as const;

export default function Profile() {
  const { user, updateUser } = useAuth();
  const profileUser = user as ProfileUser | null;

  const isStudent = user?.role === 'student';
  const hasDept = !!(user?.department && user.department.trim());
  const hasPhone = !!(user?.phone && user.phone.trim());
  const hasUniId = !!(user?.universityId && user.universityId.trim());
  const hasSemester = !!user?.semester;
  const hasName = !!(user?.name && user.name.trim());
  // The exact predicate behind isProfileComplete() in AuthContext.
  const isProfileComplete = hasName && hasDept && hasPhone && (isStudent ? (hasUniId && hasSemester) : true);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    department: user?.department || '',
    universityId: user?.universityId || '',
    enrollmentNumber: user?.enrollmentNumber || '',
    semester: user?.semester || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState<'email' | 'phone' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const departmentInputRef = useRef<HTMLInputElement>(null);
  const universityIdInputRef = useRef<HTMLInputElement>(null);
  const semesterInputRef = useRef<HTMLInputElement>(null);
  const bioInputRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const focusEditRef = useRef(false);
  const focusReadRef = useRef(false);
  const focusFieldRef = useRef<EditField>('name');
  const copyTimer = useRef<number | null>(null);

  const fieldRefs: Record<EditField, RefObject<HTMLElement | null>> = {
    name: nameInputRef,
    department: departmentInputRef,
    phone: phoneInputRef,
    universityId: universityIdInputRef,
    semester: semesterInputRef,
    bio: bioInputRef,
  };

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (isEditing && focusEditRef.current) {
      focusEditRef.current = false;
      fieldRefs[focusFieldRef.current].current?.focus();
    } else if (!isEditing && focusReadRef.current) {
      focusReadRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [isEditing]);

  if (!user) return null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api<any>('PATCH', '/users/profile', formData);
      updateUser(res.data);
      setSuccess('Profile updated');
      focusReadRef.current = true;
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const fd = new FormData();
    fd.append('image', file);

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const res = await api<any>('POST', '/users/profile-image', fd);
      updateUser({ ...user, profileImage: res.data.profileImage });
      setSuccess('Profile image updated');
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    focusReadRef.current = true;
    setIsEditing(false);
    setFormData({
      name: user.name || '',
      department: user.department || '',
      universityId: user.universityId || '',
      enrollmentNumber: user.enrollmentNumber || '',
      semester: user.semester || '',
      phone: user.phone || '',
      bio: user.bio || '',
    });
    setError('');
    setSuccess('');
  };

  const handleStartEdit = (field: EditField = 'name') => {
    setError('');
    setSuccess('');
    focusFieldRef.current = field;
    focusEditRef.current = true;
    setIsEditing(true);
  };

  const copyValue = async (value: string, kind: 'email' | 'phone') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* Clipboard is unavailable outside a secure context; the mailto/tel link remains. */
    }
  };

  // MOCK: no completeness field exists — the percentage is derived client-side
  // from the same required-field predicate as isProfileComplete(). While editing
  // it previews the unsaved form so the gauge answers the fields above it.
  const source = isEditing
    ? {
        name: formData.name,
        department: formData.department,
        phone: formData.phone,
        universityId: formData.universityId,
        semester: formData.semester as string | number | undefined,
      }
    : {
        name: user.name,
        department: user.department,
        phone: user.phone,
        universityId: user.universityId,
        semester: user.semester as string | number | undefined,
      };

  const completeness: CompletenessField[] = [
    { key: 'name', label: 'Name', done: !!(source.name && source.name.trim()) },
    { key: 'department', label: 'Department', done: !!(source.department && source.department.trim()) },
    { key: 'phone', label: 'Phone number', done: !!(source.phone && source.phone.trim()) },
    ...(isStudent
      ? [
          {
            key: 'universityId' as const,
            label: 'University ID',
            done: !!(source.universityId && source.universityId.trim()),
          },
          { key: 'semester' as const, label: 'Semester', done: !!source.semester },
        ]
      : []),
  ];
  const doneCount = completeness.filter(field => field.done).length;
  const percent = Math.round((doneCount / completeness.length) * 100);
  const missing = completeness.filter(field => !field.done);

  // MOCK: createdAt is returned by Mongoose but is not part of the documented
  // User shape; the tile is omitted when the field is absent.
  const rawCreatedAt = profileUser?.createdAt;
  const createdAtDate = rawCreatedAt ? new Date(rawCreatedAt) : null;
  const memberSince = createdAtDate && !Number.isNaN(createdAtDate.getTime()) ? createdAtDate : null;

  const identityName = (isEditing ? formData.name.trim() : user.name) || user.name;
  const identityDepartment = (isEditing ? formData.department : user.department) || user.department;
  const identitySemester = (isEditing ? formData.semester : user.semester) || user.semester;
  const identityUniversityId = (isEditing ? formData.universityId : user.universityId) || user.universityId;
  const identityEnrollment = (isEditing ? formData.enrollmentNumber : user.enrollmentNumber) || user.enrollmentNumber;

  const facts: { kind: FieldKind; label: string; value: string }[] = [];
  if (identityDepartment) facts.push({ kind: 'department', label: 'Department', value: identityDepartment });
  if (isStudent && identitySemester) {
    facts.push({ kind: 'semester', label: 'Semester', value: String(identitySemester) });
  }
  if (isStudent && identityUniversityId) {
    facts.push({ kind: 'universityId', label: 'University ID', value: identityUniversityId });
  }
  if (isStudent && identityEnrollment) {
    facts.push({ kind: 'enrollmentNumber', label: 'Enrollment', value: identityEnrollment });
  }

  const memberSinceText = memberSince
    ? memberSince.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="prf-page pfx">
      <header className="pfx-head">
        <div>
          <h1 className="pfx-title">Profile</h1>
          <p className="pfx-sub">
            {isEditing ? 'Update your details. Fields marked * are required.' : 'Your identity across clubs, projects and events.'}
          </p>
        </div>
        <div className="pfx-actions">
          {isEditing ? (
            <>
              {isProfileComplete && (
                <button type="button" className="pfx-btn pfx-btn--quiet" onClick={handleCancel} disabled={loading}>
                  Cancel
                </button>
              )}
              <button type="submit" form="prf-profile-form" className="pfx-btn pfx-btn--solid" disabled={loading}>
                {loading ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <button ref={editButtonRef} type="button" className="pfx-btn pfx-btn--solid" onClick={() => handleStartEdit('name')}>
              <PencilIcon />
              Edit profile
            </button>
          )}
        </div>
      </header>

      {(error || success) && (
        <div className="prf-notices">
          {error && (
            <div className="pfx-notice pfx-notice--error" role="alert">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="pfx-notice pfx-notice--ok" role="status">
              <CheckIcon />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      {/* Identity hero */}
      <section className={`pfx-hero prf-enter${isEditing ? ' is-editing' : ''}`} style={stagger(0)} aria-labelledby="prf-name">
        <div className="pfx-hero-body">
          <div className="pfx-portrait">
            <span className="pfx-portrait-face">
              {user.profileImage ? <img src={user.profileImage} alt="" /> : <span aria-hidden="true">{initialsOf(identityName)}</span>}
            </span>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="ui-visually-hidden" tabIndex={-1} />
            <Tooltip label={user.profileImage ? 'Replace photo' : 'Add a photo'}>
              <button
                type="button"
                className="pfx-portrait-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                aria-label={user.profileImage ? 'Replace profile photo' : 'Upload profile photo'}
              >
                <CameraIcon />
              </button>
            </Tooltip>
          </div>

          <div className="pfx-id">
            <p className="pfx-eyebrow">{roleLabel(user.role)}</p>
            <h2 className="pfx-name" id="prf-name">{identityName}</h2>
            <p className="pfx-email">{user.email}</p>
            <div className="pfx-chips">
              {identityDepartment ? <span className="pfx-chip">{identityDepartment}</span> : null}
              {isStudent && identitySemester ? <span className="pfx-chip">Semester {identitySemester}</span> : null}
              {memberSinceText ? <span className="pfx-chip pfx-chip--soft">Member since {memberSinceText}</span> : null}
            </div>
          </div>
        </div>
      </section>

      {facts.length > 0 && (
        <ul className="pfx-tiles prf-enter" style={stagger(1)} aria-label="Academic details">
          {facts.map((fact, i) => (
            <li key={fact.label} className={`pfx-tile pfx-tile--${TONES[i % TONES.length]}`}>
              <span className="pfx-tile-icon" aria-hidden="true"><FieldGlyph kind={fact.kind} size={17} /></span>
              <span className="pfx-tile-value">{fact.value}</span>
              <span className="pfx-tile-label">{fact.label}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="pfx-layout">
        <div className="pfx-main">
          {!isEditing && (
            <>
              <section className="pfx-card prf-enter" style={stagger(2)} aria-labelledby="prf-about">
                <header className="pfx-card-head">
                  <div>
                    <h2 className="pfx-card-title" id="prf-about">About</h2>
                    <p className="pfx-card-sub">A short note others see on your profile</p>
                  </div>
                  {user.bio && (
                    <button type="button" className="pfx-btn pfx-btn--quiet pfx-btn--sm" onClick={() => handleStartEdit('bio')}>
                      <PencilIcon size={13} />
                      Edit
                    </button>
                  )}
                </header>
                {user.bio ? (
                  <p className="pfx-bio">{user.bio}</p>
                ) : (
                  <div className="pfx-empty">
                    <p className="pfx-empty-title">No bio yet</p>
                    <p className="pfx-empty-text">Say a line about your interests or responsibilities.</p>
                    <button type="button" className="pfx-btn pfx-btn--quiet pfx-btn--sm" onClick={() => handleStartEdit('bio')}>
                      Add a bio
                    </button>
                  </div>
                )}
              </section>

              <section className="pfx-card prf-enter" style={stagger(3)} aria-labelledby="prf-contact">
                <header className="pfx-card-head">
                  <div>
                    <h2 className="pfx-card-title" id="prf-contact">Contact</h2>
                    <p className="pfx-card-sub">How teammates and mentors reach you</p>
                  </div>
                </header>
                <ul className="pfx-contact">
                  <li>
                    <span className="pfx-contact-mark" aria-hidden="true"><FieldGlyph kind="email" size={17} /></span>
                    <span className="pfx-contact-text">
                      <small>Email</small>
                      <a href={`mailto:${user.email}`}>{user.email}</a>
                    </span>
                    <Tooltip label={copied === 'email' ? 'Copied' : 'Copy email'}>
                      <button type="button" className="pfx-icon-btn" onClick={() => copyValue(user.email, 'email')} aria-label="Copy email address">
                        {copied === 'email' ? <CheckIcon /> : <CopyIcon />}
                      </button>
                    </Tooltip>
                  </li>
                  <li>
                    <span className="pfx-contact-mark" aria-hidden="true"><FieldGlyph kind="phone" size={17} /></span>
                    <span className="pfx-contact-text">
                      <small>Phone</small>
                      {user.phone ? <a href={`tel:${user.phone}`}>{user.phone}</a> : <span className="pfx-none">Not provided</span>}
                    </span>
                    {user.phone ? (
                      <Tooltip label={copied === 'phone' ? 'Copied' : 'Copy phone'}>
                        <button type="button" className="pfx-icon-btn" onClick={() => copyValue(user.phone as string, 'phone')} aria-label="Copy phone number">
                          {copied === 'phone' ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      </Tooltip>
                    ) : null}
                  </li>
                </ul>
              </section>
            </>
          )}

          {isEditing && (
            <form className="pfx-card pfx-sheet prf-enter" id="prf-profile-form" style={stagger(2)} onSubmit={handleSave}>
              <div className="prf-sheet__cols">
                <div className="prf-sheet__col">
                  <section className="prf-sheet__section">
                    <h2 className="prf-sheet__title">Identity</h2>
                    <div className="ui-form-row ui-form-row--2">
                      <div className="prf-field">
                        <label className="ui-label" htmlFor="prf-full-name">
                          Full name <span className="prf-req" aria-hidden="true">*</span>
                        </label>
                        <input id="prf-full-name" ref={nameInputRef} className="ui-field" type="text" autoComplete="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required disabled={loading} />
                      </div>
                      <div className="prf-field">
                        <div className="prf-field__labelrow">
                          <label className="ui-label" htmlFor="prf-email">Email address</label>
                          <Tooltip label="Managed by your college account">
                            <span className="prf-field__note" role="img" aria-label="Managed by your college account" tabIndex={0}>
                              <LockIcon />
                            </span>
                          </Tooltip>
                        </div>
                        <input id="prf-email" className="ui-field" type="email" value={user.email} disabled />
                      </div>
                    </div>
                  </section>

                  <section className="prf-sheet__section">
                    <h2 className="prf-sheet__title">Contact</h2>
                    <div className="prf-field">
                      <label className="ui-label" htmlFor="prf-phone">
                        Phone number <span className="prf-req" aria-hidden="true">*</span>
                      </label>
                      <input id="prf-phone" ref={phoneInputRef} className="ui-field" type="tel" autoComplete="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required disabled={loading} />
                    </div>
                  </section>
                </div>

                <div className="prf-sheet__col">
                  <section className="prf-sheet__section">
                    <h2 className="prf-sheet__title">{isStudent ? 'Academic record' : 'Department'}</h2>
                    {isStudent ? (
                      <>
                        <div className="ui-form-row ui-form-row--2">
                          <div className="prf-field">
                            <label className="ui-label" htmlFor="prf-department">Department <span className="prf-req" aria-hidden="true">*</span></label>
                            <input id="prf-department" ref={departmentInputRef} className="ui-field" type="text" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} required disabled={loading} />
                          </div>
                          <div className="prf-field">
                            <label className="ui-label" htmlFor="prf-semester">Semester <span className="prf-req" aria-hidden="true">*</span></label>
                            <input id="prf-semester" ref={semesterInputRef} className="ui-field" type="number" min="1" max="10" value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })} required disabled={loading} />
                          </div>
                        </div>
                        <div className="ui-form-row ui-form-row--2">
                          <div className="prf-field">
                            <label className="ui-label" htmlFor="prf-university-id">University ID <span className="prf-req" aria-hidden="true">*</span></label>
                            <input id="prf-university-id" ref={universityIdInputRef} className="ui-field" type="text" value={formData.universityId} onChange={e => setFormData({ ...formData, universityId: e.target.value })} required disabled={loading} />
                          </div>
                          <div className="prf-field">
                            <label className="ui-label" htmlFor="prf-enrollment">Enrollment number</label>
                            <input id="prf-enrollment" className="ui-field" type="text" value={formData.enrollmentNumber} onChange={e => setFormData({ ...formData, enrollmentNumber: e.target.value })} disabled={loading} placeholder="e.g. 0901CS201045" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="prf-field">
                        <label className="ui-label" htmlFor="prf-department">Department <span className="prf-req" aria-hidden="true">*</span></label>
                        <input id="prf-department" ref={departmentInputRef} className="ui-field" type="text" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} required disabled={loading} />
                      </div>
                    )}
                  </section>

                  <section className="prf-sheet__section">
                    <h2 className="prf-sheet__title">About</h2>
                    <div className="prf-field">
                      <label className="ui-label" htmlFor="prf-bio">Bio</label>
                      <textarea id="prf-bio" ref={bioInputRef} className="ui-field ui-field--area" rows={3} value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} disabled={loading} placeholder="Research, interests, responsibilities" />
                    </div>
                  </section>
                </div>
              </div>

              <footer className="prf-sheet__foot">
                {isProfileComplete && (
                  <button type="button" className="pfx-btn pfx-btn--quiet" onClick={handleCancel} disabled={loading}>Cancel</button>
                )}
                <button type="submit" className="pfx-btn pfx-btn--solid" disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</button>
              </footer>
            </form>
          )}
        </div>

        <aside className="pfx-side" aria-label="Profile summary">
          <section className="pfx-card pfx-card--dark prf-enter" style={stagger(2)} aria-labelledby="prf-strength">
            <header className="pfx-card-head">
              <div>
                <h2 className="pfx-card-title" id="prf-strength">Profile strength</h2>
                <p className="pfx-card-sub">{doneCount} of {completeness.length} details on file</p>
              </div>
              <span className="pfx-pct">{percent}%</span>
            </header>
            <span className="pfx-meter" role="img" aria-label={`Profile strength ${percent} percent`}>
              <i style={{ width: `${percent}%` }} />
            </span>
            {missing.length > 0 ? (
              <ul className="pfx-missing">
                {missing.map(field => (
                  <li key={field.key}>
                    <button
                      type="button"
                      className="pfx-miss"
                      onClick={() => (isEditing ? fieldRefs[field.key].current?.focus() : handleStartEdit(field.key))}
                      aria-label={isEditing ? `Go to ${field.label.toLowerCase()}` : `Add ${field.label.toLowerCase()}`}
                    >
                      <FieldGlyph kind={field.key as FieldKind} size={13} />
                      {field.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pfx-done"><CheckIcon size={14} /> Profile complete</p>
            )}
          </section>

          <section className="pfx-card prf-enter" style={stagger(3)} aria-labelledby="prf-account">
            <header className="pfx-card-head">
              <div>
                <h2 className="pfx-card-title" id="prf-account">Account</h2>
                <p className="pfx-card-sub">Set by your college account</p>
              </div>
            </header>
            <dl className="pfx-facts">
              <div><dt>Role</dt><dd>{roleLabel(user.role)}</dd></div>
              <div><dt>Photo</dt><dd>{user.profileImage ? 'Uploaded' : 'Monogram'}</dd></div>
              {memberSinceText ? <div><dt>Joined</dt><dd>{memberSinceText}</dd></div> : null}
            </dl>
          </section>
        </aside>
      </div>

      <span className="ui-visually-hidden" aria-live="polite">
        {copied === 'email' ? 'Email address copied' : copied === 'phone' ? 'Phone number copied' : ''}
      </span>
    </div>
  );
}
