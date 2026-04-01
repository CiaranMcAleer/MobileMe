import { parseCsv } from "../utils/csv";

const CSV_PATH = import.meta.env.VITE_FUEL_DATA_PATH || "data/latest-fuelprices.csv";
const CSV_URL = new URL(
  CSV_PATH,
  `${globalThis.location.origin}${import.meta.env.BASE_URL}`,
).toString();

async function getGeolocationPermissionState() {
  if (!navigator.permissions?.query) {
    return "unknown";
  }

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}

export async function getCurrentPosition() {
  if (!("geolocation" in navigator)) {
    throw new Error("Geolocation is not supported in this browser.");
  }

  const permissionState = await getGeolocationPermissionState();
  if (permissionState === "denied") {
    throw new Error(
      "Location access is blocked for this site. Enable it in your browser settings or pick a location on the map instead.",
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        if (error?.code === error.PERMISSION_DENIED) {
          reject(
            new Error(
              "Location access was denied. Allow access when prompted, or pick a location on the map instead.",
            ),
          );
          return;
        }

        if (error?.code === error.POSITION_UNAVAILABLE) {
          reject(
            new Error(
              "Your device could not determine a location. Move somewhere with better signal, or pick a location on the map instead.",
            ),
          );
          return;
        }

        if (error?.code === error.TIMEOUT) {
          reject(
            new Error(
              "Location lookup timed out. Try again, or pick a location on the map instead.",
            ),
          );
          return;
        }

        reject(new Error(error?.message || "Failed to retrieve your location."));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000,
      },
    );
  });
}

export async function fetchLatestFuelRows() {
  const response = await fetch(CSV_URL, {
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`CSV request failed with ${response.status}`);
  }

  const text = await response.text();
  const rows = parseCsv(text);

  if (!rows.length) {
    throw new Error("Fuel price snapshot loaded, but no station rows were parsed.");
  }

  return rows;
}
