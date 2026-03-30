import React from "react";
export default function AppShell({
  bestStation,
  children,
  error,
  headerBadge,
  locationLabel,
  map,
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
            <strong>Live CSV</strong>
          </div>
          <div className="status-chip">{headerBadge}</div>
        </div>
      </header>

      <section className="summary-grid">
        <article className="summary-card panel-shadow">
          <span className="eyebrow">Near</span>
          <strong>{locationLabel}</strong>
          <p>{status}</p>
        </article>

        <article className="summary-card panel-shadow accent-card">
          <span className="eyebrow">Cheapest in range</span>
          <strong>{bestStation?.name ?? "No station selected"}</strong>
          <p>
            {bestStation
              ? `${bestStation.brand} · ${bestStation.price.toFixed(1)}p`
              : error || "Adjust the radius or wait for live data."}
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
