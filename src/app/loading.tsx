export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="route-loading">
      <span className="sr-only">Loading page</span>
      <aside aria-hidden="true" className="route-loading-sidebar">
        <div className="route-skeleton route-loading-brand" />
        <div className="route-skeleton route-loading-nav" />
        <div className="route-skeleton route-loading-nav" />
        <div className="route-skeleton route-loading-nav" />
        <div className="route-skeleton route-loading-nav" />
        <div className="route-skeleton route-loading-account" />
      </aside>
      <div className="route-loading-main">
        <header className="route-loading-header">
          <div className="route-skeleton route-loading-menu" />
          <div className="route-skeleton route-loading-title" />
        </header>
        <div aria-hidden="true" className="route-loading-content">
          <div className="route-skeleton route-loading-eyebrow" />
          <div className="route-skeleton route-loading-heading" />
          <div className="route-skeleton route-loading-description" />
          <div className="route-loading-cards">
            <div className="route-skeleton route-loading-card" />
            <div className="route-skeleton route-loading-card" />
            <div className="route-skeleton route-loading-card" />
          </div>
          <div className="route-skeleton route-loading-panel" />
        </div>
      </div>
    </div>
  );
}
