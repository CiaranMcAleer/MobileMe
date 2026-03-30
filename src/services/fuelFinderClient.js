import { parseCsv } from "../utils/csv";

const CSV_URL = "/fuel-finder/latest-fuelprices.csv";

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
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
    throw new Error("Live CSV loaded, but no station rows were parsed.");
  }

  return rows;
}
