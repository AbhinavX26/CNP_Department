import type {
  StudentClubMembership,
  StudentJoinRequest,
  StudentProjectWithMentors,
} from '../../../../types/studentDashboard';

/** Everything on the student dashboard is counted from the records the API already returned. */

export interface EventLite {
  _id: string;
  title?: string;
  date?: string;
  eventDate?: string;
  location?: string;
  clubId?: string | { _id?: string; name?: string } | null;
}

export function asEvents(list: unknown[]): EventLite[] {
  return list.filter(
    (item): item is EventLite => typeof item === 'object' && item !== null && '_id' in item,
  );
}

export function eventStart(event: EventLite): Date | null {
  const value = event.eventDate || event.date;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function eventClubId(event: EventLite): string | undefined {
  const club = event.clubId;
  if (!club) return undefined;
  return typeof club === 'object' ? club._id : club;
}

export function eventClubName(event: EventLite): string | undefined {
  const club = event.clubId;
  return club && typeof club === 'object' ? club.name : undefined;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export interface WeekBucket {
  label: string;
  /** First day of the week window, for the tooltip. */
  from: Date;
  count: number;
}

/** Upcoming events counted per 7-day window starting today. */
export function eventsPerWeek(events: EventLite[], weeks = 6, now = new Date()): WeekBucket[] {
  const today = startOfDay(now);
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => {
    const from = new Date(today + i * 7 * 86_400_000);
    return {
      label: from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      from,
      count: 0,
    };
  });
  for (const event of events) {
    const start = eventStart(event);
    if (!start) continue;
    const dayDiff = Math.floor((startOfDay(start) - today) / 86_400_000);
    if (dayDiff < 0) continue;
    const index = Math.floor(dayDiff / 7);
    if (index < weeks) buckets[index].count += 1;
  }
  return buckets;
}

export function eventsByClub(events: EventLite[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const id = eventClubId(event);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export interface RequestGroup {
  label: 'Clubs' | 'Projects';
  pending: number;
  approved: number;
  rejected: number;
}

export function requestBreakdown(requests: StudentJoinRequest[]): RequestGroup[] {
  const groups: RequestGroup[] = [
    { label: 'Clubs', pending: 0, approved: 0, rejected: 0 },
    { label: 'Projects', pending: 0, approved: 0, rejected: 0 },
  ];
  for (const request of requests) {
    const group = request.clubId ? groups[0] : groups[1];
    if (request.status === 'pending') group.pending += 1;
    else if (request.status === 'approved') group.approved += 1;
    else if (request.status === 'rejected') group.rejected += 1;
  }
  return groups;
}

export function isTeamLeader(project: StudentProjectWithMentors, userId: string): boolean {
  const leader = project.teamLeaderId;
  const id = typeof leader === 'object' && leader !== null ? leader._id : leader;
  return Boolean(id && String(id) === String(userId));
}

export interface RoleCounts {
  coreTeam: number;
  clubMembers: number;
  leaders: number;
  projectMembers: number;
}

export function roleBreakdown(
  clubs: StudentClubMembership[],
  projects: StudentProjectWithMentors[],
  userId: string,
): RoleCounts {
  const coreTeam = clubs.filter((c) => c.membership.membershipType === 'core_team').length;
  const leaders = projects.filter((p) => isTeamLeader(p, userId)).length;
  return {
    coreTeam,
    clubMembers: clubs.length - coreTeam,
    leaders,
    projectMembers: projects.length - leaders,
  };
}

export function relativeTime(value?: string, now = Date.now()): string {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.round((now - time) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
