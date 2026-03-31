import React from "react";
import { useEffect, useMemo, useState } from "react";
import FuelFilters from "../components/controls/FuelFilters";
import AppShell from "../components/layout/AppShell";
import FuelMap from "../components/map/FuelMap";
import StationList from "../components/stations/StationList";
import { useFuelFinderData } from "../hooks/useFuelFinderData";
import {
  filterStationsByRadius,
  getRadiusMilesLabel,
  isInfiniteRadius,
} from "../utils/stationProcessing";
import { getLocationLabel } from "../utils/stations";

const DEFAULT_RADIUS_VALUE = 6;

export default function HomeRoute() {
  const [fuelType, setFuelType] = useState("petrol");
  const [radiusValue, setRadiusValue] = useState(DEFAULT_RADIUS_VALUE);
  const [selectedStationId, setSelectedStationId] = useState(null);
  const {
    error,
    hasRequestedLocation,
    isLoading,
    isRefreshing,
    lastUpdatedLabel,
    requestLocation,
    rowsCount,
    stations,
    status,
    userLocation,
  } = useFuelFinderData(fuelType);

  const stationsInRange = useMemo(
    () => filterStationsByRadius(stations, radiusValue),
    [radiusValue, stations],
  );
  const listedStations = useMemo(() => stationsInRange.slice(0, 12), [stationsInRange]);
  const bestStation = stationsInRange[0] ?? null;

  useEffect(() => {
    if (!stationsInRange.length) {
      setSelectedStationId(null);
      return;
    }

    if (!stationsInRange.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(stationsInRange[0].id);
    }
  }, [selectedStationId, stationsInRange]);

  const locationLabel = userLocation
    ? getLocationLabel(userLocation)
    : hasRequestedLocation
      ? "Location access still needed"
      : "Location access required";

  const headerBadge = isLoading ? "Loading" : error ? "Failed" : isRefreshing ? "Updating" : "Live";
  const emptyMessage = error
    ? error
    : hasRequestedLocation
      ? isInfiniteRadius(radiusValue)
        ? `No ${fuelType} stations are available in the published snapshot.`
        : `No ranked ${fuelType} stations were found within ${getRadiusMilesLabel(radiusValue)}.`
      : "Enable location access to see nearby stations.";
  const appStatus = isRefreshing ? `${status} Rendering updated results when ready.` : status;

  return (
    <AppShell
      bestStation={bestStation}
      canRequestLocation={!userLocation}
      error={error}
      headerBadge={headerBadge}
      isRequestingLocation={isLoading && !userLocation}
      locationLabel={locationLabel}
      map={
        <FuelMap
          onSelectStation={setSelectedStationId}
          selectedStationId={selectedStationId}
          stations={stationsInRange}
          userLocation={userLocation}
        />
      }
      onRequestLocation={requestLocation}
      stationCount={stationsInRange.length || rowsCount}
      status={appStatus}
    >
      {(map) => (
        <>
          <div className="map-column">
            <FuelFilters
              fuelType={fuelType}
              isLoading={isLoading}
              lastUpdatedLabel={lastUpdatedLabel}
              onFuelTypeChange={setFuelType}
              onRadiusChange={setRadiusValue}
              radiusValue={radiusValue}
            />
            {map}
          </div>

          <div className="results-column">
            <StationList
              emptyMessage={emptyMessage}
              onSelectStation={setSelectedStationId}
              selectedStationId={selectedStationId}
              stations={listedStations}
            />
          </div>
        </>
      )}
    </AppShell>
  );
}
