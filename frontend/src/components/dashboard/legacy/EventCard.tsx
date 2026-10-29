import { isEventPast } from '../../../eventDate';

export interface EventCardProps {
  event: any;
  canManage?: boolean;
  onEdit?: (event: any) => void;
  onDelete?: (eventId: string) => void;
  isPast?: boolean;
  compact?: boolean;
}

export function EventCard({
  event,
  canManage = false,
  onEdit,
  onDelete,
  isPast,
  compact = false,
}: EventCardProps) {
  const club = typeof event.clubId === 'object' && event.clubId !== null ? event.clubId : null;
  const clubName = club?.name || 'Department Club';
  const clubLogo = club?.logo || null;

  const rawDate = event.eventDate || event.date;
  const eventIsPast = isPast ?? isEventPast(rawDate);
  const eventDateObj = rawDate ? new Date(rawDate) : null;
  const isValidDate = eventDateObj && !isNaN(eventDateObj.getTime());

  const formattedDate = isValidDate
    ? eventDateObj.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Date TBD';

  const formattedTime = isValidDate
    ? eventDateObj.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const dateTimeDisplay = formattedTime ? `${formattedDate} · ${formattedTime}` : formattedDate;

  return (
    <div
      id={`event-${event._id}`}
      className={`card event-card${eventIsPast ? ' past' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: eventIsPast ? 'var(--bg-card-2)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: compact ? '16px' : '20px',
        opacity: 1,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header: Club Info & Optional Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {clubLogo ? (
            <img
              src={clubLogo}
              alt={clubName}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                objectFit: 'cover',
                border: '1px solid var(--border)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--primary-glow)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
              }}
            >
              {clubName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
              Organized by
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={clubName}
            >
              {clubName}
            </div>
          </div>
        </div>

        {eventIsPast ? (
          <span
            className="badge"
            style={{
              background: '#ffedd5',
              color: '#9a3412',
              border: '1px solid #fdba74',
              fontSize: '11px',
              padding: '3px 8px',
            }}
          >
            Past
          </span>
        ) : (
          <span
            className="badge badge-success"
            style={{
              fontSize: '11px',
              padding: '3px 8px',
            }}
          >
            Upcoming
          </span>
        )}
      </div>

      {/* Main Content: Title & Details */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3
          style={{
            margin: '0 0 10px 0',
            fontSize: compact ? '16px' : '18px',
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.3,
          }}
        >
          {event.title}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>
              <strong style={{ color: 'var(--text)' }}>Date:</strong> {dateTimeDisplay}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>
              <strong style={{ color: 'var(--text)' }}>Location:</strong> {event.location}
            </span>
          </div>
        </div>

        {event.description && (
          <p
            style={{
              margin: '0 0 14px 0',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--text-faint)',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {event.description}
          </p>
        )}

        {/* Links: Event Link & Related Document */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', marginBottom: canManage ? '14px' : '0' }}>
          {event.eventLink && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <a
                href={event.eventLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--primary)',
                  textDecoration: 'underline',
                  wordBreak: 'break-all',
                }}
              >
                {event.eventLinkName?.trim() || 'Open Event Link'}
              </a>
            </div>
          )}

          {event.relatedDocument?.url && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <a
                href={event.relatedDocument.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--success)',
                  textDecoration: 'underline',
                  wordBreak: 'break-all',
                }}
              >
                {event.relatedDocumentName?.trim() || event.relatedDocument.originalName || 'Open Related Document'}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Manage Actions */}
      {canManage && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border)',
            marginTop: '12px',
          }}
        >
          {onEdit && (
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => onEdit(event)}
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{
                color: 'var(--danger)',
                borderColor: 'var(--danger-soft)',
                background: 'var(--danger-soft)',
              }}
              onClick={() => onDelete(event._id)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
