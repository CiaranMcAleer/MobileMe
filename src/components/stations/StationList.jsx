import React from "react";
import {
  formatDistance,
  formatPrice,
  formatRankingDelta,
  formatTimestamp,
} from "../../utils/stations";

function StationCard({ isSelected, onSelect, station }) {
  const localPriceDelta = station.price - station.ranking.localAveragePrice;

  return (
    <article
      className={isSelected ? "station-card panel-shadow selected" : "station-card panel-shadow"}
    >
      <button className="station-card-button" onClick={onSelect} type="button">
        <div className="station-card-top">
          <div>
            <div className="eyebrow">{station.brand}</div>
            <h3>{station.name}</h3>
            <p>
              {station.city} {station.postcode}
            </p>
          </div>
          <div className="price-pill">{formatPrice(station.price)}</div>
        </div>

        <dl className="station-metrics">
          <div>
            <dt>Distance</dt>
            <dd>{formatDistance(station.distanceMiles)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatTimestamp(station.updatedAt)}</dd>
          </div>
          <div>
            <dt>Local value</dt>
            <dd>{formatRankingDelta(localPriceDelta)}</dd>
          </div>
          <div>
            <dt>Rank score</dt>
            <dd>{station.ranking.score.toFixed(2)}</dd>
          </div>
        </dl>
      </button>

      <a
        className="route-link"
        href={station.routeUrl}
        rel="noreferrer"
        target="_blank"
      >
        Route in Google Maps
      </a>
    </article>
  );
}

export default function StationList({
  emptyMessage,
  onSelectStation,
  selectedStationId,
  stations,
}) {
  if (!stations.length) {
    return (
      <section className="panel results-panel panel-shadow">
        <div className="results-heading">
          <div>
            <div className="eyebrow">Closest cheap fuel</div>
            <h2>No stations in range</h2>
          </div>
        </div>
        <p className="empty-copy">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="panel results-panel panel-shadow">
      <div className="results-heading">
        <div>
          <div className="eyebrow">Closest cheap fuel</div>
          <h2>{stations.length} ranked stations shown</h2>
        </div>
      </div>

      <div className="station-list">
        {stations.map((station) => (
          <StationCard
            isSelected={station.id === selectedStationId}
            key={station.id}
            onSelect={() => onSelectStation(station.id)}
            station={station}
          />
        ))}
      </div>
    </section>
  );
}
