import React from "react";
import { getRadiusMilesLabel, isInfiniteRadius } from "../../utils/stationProcessing";

const RANGE_SLIDER_MIN = 1;
const RANGE_SLIDER_MAX = 26;

export default function FuelFilters({
  fuelType,
  isLoading,
  lastUpdatedLabel,
  onFuelTypeChange,
  onRadiusChange,
  radiusValue,
}) {
  const isOpenEnded = isInfiniteRadius(radiusValue);

  return (
    <section className="panel controls-panel panel-shadow">
      <div className="controls-heading">
        <div>
          <div className="eyebrow">Controls</div>
          <h2>Live filters</h2>
        </div>
        <div className="last-updated">CSV updated {lastUpdatedLabel}</div>
      </div>

      <div className="toggle-row" role="tablist" aria-label="Fuel type">
        <button
          className={fuelType === "petrol" ? "toggle-button active" : "toggle-button"}
          onClick={() => onFuelTypeChange("petrol")}
          type="button"
        >
          Petrol
        </button>
        <button
          className={fuelType === "diesel" ? "toggle-button active" : "toggle-button"}
          onClick={() => onFuelTypeChange("diesel")}
          type="button"
        >
          Diesel
        </button>
      </div>

      <label className="range-control">
        <div className="range-labels">
          <span className="eyebrow">Radius</span>
          <strong>{getRadiusMilesLabel(radiusValue)}</strong>
        </div>
        <input
          type="range"
          min={RANGE_SLIDER_MIN}
          max={RANGE_SLIDER_MAX}
          step="1"
          value={radiusValue}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
          disabled={isLoading}
        />
        <div className="range-scale-labels" aria-hidden="true">
          <span>1 mile</span>
          <span>{isOpenEnded ? "∞ selected" : "∞"}</span>
        </div>
      </label>
    </section>
  );
}
