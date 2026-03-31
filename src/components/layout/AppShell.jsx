import React from "react";
export default function AppShell({
  bestStation,
  canRequestLocation,
  children,
  error,
  headerBadge,
  isRequestingLocation,
  locationLabel,
  map,
  onRequestLocation,
  status,
  stationCount,
}) {
  return (
    <div className="app-shell">
      <header className="hero-panel panel-shadow">
        <div>
          <div className="eyebrow">MobileMe</div>
          <h1>Fuel Finder</h1>
        </div>

        <div className="hero-meta">
          <div className="data-badge panel-shadow">
            <span className="eyebrow">Data</span>
            <strong>Published CSV snapshot</strong>
          </div>
          <div className="status-chip">{headerBadge}</div>
        </div>
      </header>

      <section className="summary-grid">
        <article className="summary-card panel-shadow">
          <span className="eyebrow">Near</span>
          <strong>{locationLabel}</strong>
          <p>{status}</p>
          {canRequestLocation ? (
            <button
              className="location-request-button"
              disabled={isRequestingLocation}
              onClick={onRequestLocation}
              type="button"
            >
              {isRequestingLocation ? "Requesting location…" : "Enable my location"}
            </button>
          ) : null}
        </article>

        <article className="summary-card panel-shadow accent-card">
          <span className="eyebrow">Cheapest in range</span>
          <strong>{bestStation?.name ?? "No station selected"}</strong>
          <p>
            {bestStation
              ? `${bestStation.brand} · ${bestStation.price.toFixed(1)}p`
              : error || "Adjust the radius or wait for the next published snapshot."}
          </p>
        </article>

        <article className="summary-card panel-shadow">
          <span className="eyebrow">Stations in view</span>
          <strong>{stationCount.toLocaleString()}</strong>
        </article>
      </section>

      <main className="content-grid">{children(map)}</main>
    </div>
  );
}
