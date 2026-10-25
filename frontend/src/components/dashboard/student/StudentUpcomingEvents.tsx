import { useNavigate } from 'react-router-dom';
import { EventCard } from '../legacy/EventCard';
import { DashboardSection } from './DashboardSection';

interface StudentUpcomingEventsProps {
  events: unknown[];
  error?: string;
}

function isEventRecord(value: unknown): value is { _id: string; eventDate?: string; date?: string } {
  return typeof value === 'object' && value !== null && '_id' in value;
}

export function StudentUpcomingEvents({ events, error }: StudentUpcomingEventsProps) {
  const navigate = useNavigate();
  const upcoming = events.filter(isEventRecord).slice(0, 4);

  return (
    <DashboardSection
      id="student-events"
      eyebrow="Campus calendar"
      title="Upcoming events"
      count={upcoming.length > 0 ? upcoming.length : undefined}
      actionLabel="Full calendar →"
      onAction={() => navigate('/events')}
    >
      {error ? (
        <div className="student-dash-inline-error" role="alert">
          {error}
        </div>
      ) : upcoming.length === 0 ? (
        !error && (
          <p className="student-dash-aside-empty">
            No upcoming events scheduled. Check back as clubs publish new activities.
          </p>
        )
      ) : (
        <div className="student-dash-event-stack">
          {upcoming.map((event) => (
            <EventCard key={event._id} event={event} compact />
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
