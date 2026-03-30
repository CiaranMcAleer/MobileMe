import { fetchLatestFuelRows } from "../services/fuelFinderClient";
import { processStations } from "../utils/stationProcessing";

const processedCache = new Map();
let latestRows = null;
let latestTimestamp = null;

async function ensureRowsLoaded() {
  if (latestRows) {
    return latestRows;
  }

  latestRows = await fetchLatestFuelRows();
  latestTimestamp =
    latestRows.find((row) => row["forecourt_update_timestamp"])
      ?.["forecourt_update_timestamp"] ?? null;
  processedCache.clear();
  return latestRows;
}

self.onmessage = async (event) => {
  const { fuelType, requestId, type, userLocation } = event.data ?? {};

  try {
    if (type === "reset") {
      latestRows = null;
      latestTimestamp = null;
      processedCache.clear();
      self.postMessage({ requestId, status: "reset-complete", type });
      return;
    }

    const rows = await ensureRowsLoaded();
    const cacheKey = JSON.stringify({
      fuelType,
      latitude: userLocation?.latitude,
      longitude: userLocation?.longitude,
    });

    let stations = processedCache.get(cacheKey);
    if (!stations) {
      stations = processStations(rows, userLocation, fuelType);
      processedCache.set(cacheKey, stations);
    }

    self.postMessage({
      fuelType,
      lastUpdatedTimestamp: latestTimestamp,
      requestId,
      rowsCount: rows.length,
      stations,
      status: "success",
      type,
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Failed to process the published fuel data.",
      requestId,
      status: "error",
      type,
    });
  }
};
