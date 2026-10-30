export function DashboardSkeleton() {
  return (
    <div className="student-dash student-dash--loading" aria-busy="true" aria-label="Loading dashboard">
      <div className="student-dash-skeleton-hero">
        <div className="student-dash-skeleton-line student-dash-skeleton-line--sm" />
        <div className="student-dash-skeleton-line student-dash-skeleton-line--lg" />
        <div className="student-dash-skeleton-line student-dash-skeleton-line--md" />
      </div>
      <div className="student-dash-layout">
        <div className="student-dash-main">
          <div className="student-dash-skeleton-panel" />
          <div className="student-dash-skeleton-panel student-dash-skeleton-panel--tall" />
        </div>
        <aside className="student-dash-aside">
          <div className="student-dash-skeleton-panel" />
          <div className="student-dash-skeleton-panel" />
        </aside>
      </div>
    </div>
  );
}
