import { haversineMiles } from "./geo";

const LOCAL_AVERAGE_RADIUS_MILES = 5;
const RANGE_SLIDER_INFINITE_VALUE = 26;
const STALE_UPDATE_HOURS = 24;
const GRID_CELL_SIZE_MILES = LOCAL_AVERAGE_RADIUS_MILES / 2;
const PRICE_COLUMNS = {
  petrol: [
    "forecourts.fuel_price.E10",
    "forecourts.fuel_price.E5",
    "fuel_prices.E10.amount",
    "fuel_prices.E5.amount",
    "fuel_prices.petrol.amount",
  ],
  diesel: [
    "forecourts.fuel_price.B7S",
    "forecourts.fuel_price.B7P",
    "forecourts.fuel_price.B10",
    "forecourts.fuel_price.HVO",
    "fuel_prices.B7.amount",
    "fuel_prices.SDV.amount",
    "fuel_prices.diesel.amount",
  ],
};

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normaliseBoolean(value) {
  return String(value).trim().toUpperCase() === "TRUE";
}

function normaliseFuelPrice(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  // Some live rows appear to mix pounds-per-litre and tenths-of-pence encodings.
  // Normalize obvious outliers back into pence-per-litre before ranking.
  if (value < 10) {
    return value * 100;
  }

  if (value >= 1000) {
    return value / 10;
  }

  return value;
}

function getFirstNumericValue(row, keys) {
  for (const key of keys) {
    const value = normaliseFuelPrice(Number(row[key]));
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function getTimestampAgeHours(timestamp, nowMs) {
  if (!timestamp) {
    return STALE_UPDATE_HOURS * 3;
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return STALE_UPDATE_HOURS * 3;
  }

  return Math.max(0, (nowMs - parsed) / 3_600_000);
}

function getGridCoordinates(latitude, longitude, cosineLatitude) {
  return {
    x: (longitude * 69.172 * cosineLatitude) / GRID_CELL_SIZE_MILES,
    y: (latitude * 69.0) / GRID_CELL_SIZE_MILES,
  };
}

function buildSpatialBuckets(stations) {
  const averageLatitude =
    stations.reduce((sum, station) => sum + station.latitude, 0) / stations.length;
  const cosineLatitude = Math.max(
    Math.cos((averageLatitude * Math.PI) / 180),
    0.2,
  );

  const buckets = new Map();

  stations.forEach((station) => {
    const grid = getGridCoordinates(
      station.latitude,
      station.longitude,
      cosineLatitude,
    );
    const bucketX = Math.floor(grid.x);
    const bucketY = Math.floor(grid.y);
    const bucketKey = `${bucketX}:${bucketY}`;

    station._grid = { bucketX, bucketY };

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }

    buckets.get(bucketKey).push(station);
  });

  return { buckets, cosineLatitude };
}

function getNearbyAveragePrice(station, spatialIndex) {
  const { bucketX, bucketY } = station._grid;
  let totalPrice = 0;
  let stationCount = 0;

  for (let xOffset = -2; xOffset <= 2; xOffset += 1) {
    for (let yOffset = -2; yOffset <= 2; yOffset += 1) {
      const bucket = spatialIndex.buckets.get(
        `${bucketX + xOffset}:${bucketY + yOffset}`,
      );

      if (!bucket) {
        continue;
      }

      bucket.forEach((candidate) => {
        const candidateDistance = haversineMiles(
          station.latitude,
          station.longitude,
          candidate.latitude,
          candidate.longitude,
        );

        if (candidateDistance <= LOCAL_AVERAGE_RADIUS_MILES) {
          totalPrice += candidate.price;
          stationCount += 1;
        }
      });
    }
  }

  if (!stationCount) {
    return station.price;
  }

  return totalPrice / stationCount;
}

function getPriceComponent(station, minimumPrice, maximumPrice) {
  if (maximumPrice === minimumPrice) {
    return 1;
  }

  const normalized = (station.price - minimumPrice) / (maximumPrice - minimumPrice);
  return clamp(1 - normalized, 0, 1);
}

function getFreshnessComponent(station, nowMs) {
  const ageHours = getTimestampAgeHours(station.updatedAt, nowMs);
  return clamp(1 - ageHours / STALE_UPDATE_HOURS, 0, 1);
}

function getLocalValueComponent(station, spatialIndex) {
  const nearbyAveragePrice = getNearbyAveragePrice(station, spatialIndex);
  const deltaFromLocalAverage = nearbyAveragePrice - station.price;

  return {
    deltaFromLocalAverage,
    localAveragePrice: nearbyAveragePrice,
    component: clamp(0.5 + deltaFromLocalAverage / 8, 0, 1),
  };
}

function withRanking(station, context) {
  const { maximumPrice, minimumPrice, nowMs, spatialIndex } = context;
  const priceComponent = getPriceComponent(station, minimumPrice, maximumPrice);
  const freshnessComponent = getFreshnessComponent(station, nowMs);
  const localValue = getLocalValueComponent(station, spatialIndex);
  const rating =
    priceComponent * 0.8 + freshnessComponent * 0.12 + localValue.component * 0.08;

  return {
    ...station,
    ranking: {
      deltaFromLocalAverage: localValue.deltaFromLocalAverage,
      freshnessComponent,
      localAveragePrice: localValue.localAveragePrice,
      localValueComponent: localValue.component,
      priceComponent,
      score: rating,
    },
  };
}

export function getRadiusMilesLabel(radiusValue) {
  return radiusValue >= RANGE_SLIDER_INFINITE_VALUE ? "∞" : `${radiusValue} miles`;
}

export function isInfiniteRadius(radiusValue) {
  return radiusValue >= RANGE_SLIDER_INFINITE_VALUE;
}

export function filterStationsByRadius(stations, radiusValue) {
  if (isInfiniteRadius(radiusValue)) {
    return stations;
  }

  return stations.filter((station) => station.distanceMiles <= radiusValue);
}

export function buildGoogleMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export function normaliseStation(row, userLocation, fuelType) {
  const latitude = Number(row["forecourts.location.latitude"]);
  const longitude = Number(row["forecourts.location.longitude"]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (normaliseBoolean(row["forecourts.temporary_closure"])) {
    return null;
  }

  if (normaliseBoolean(row["forecourts.permanent_closure"])) {
    return null;
  }

  const price = getFirstNumericValue(row, PRICE_COLUMNS[fuelType] ?? []);
  if (!Number.isFinite(price)) {
    return null;
  }

  return {
    id: row["forecourts.node_id"] || `${latitude}-${longitude}`,
    name:
      row["forecourts.trading_name"] ||
      row["forecourts.brand_name"] ||
      "Unnamed forecourt",
    brand: row["forecourts.brand_name"] || "Unknown",
    city: row["forecourts.location.city"] || "",
    postcode: row["forecourts.location.postcode"] || "",
    latitude,
    longitude,
    price,
    fuelType,
    updatedAt: row["forecourt_update_timestamp"] || "",
    distanceMiles: haversineMiles(
      userLocation.latitude,
      userLocation.longitude,
      latitude,
      longitude,
    ),
    routeUrl: buildGoogleMapsUrl(latitude, longitude),
  };
}

export function rankStations(stations) {
  if (!stations.length) {
    return [];
  }

  const prices = stations.map((station) => station.price);
  const spatialIndex = buildSpatialBuckets(stations);
  const context = {
    maximumPrice: Math.max(...prices),
    minimumPrice: Math.min(...prices),
    nowMs: Date.now(),
    spatialIndex,
  };

  return stations
    .map((station) => withRanking(station, context))
    .sort((left, right) => {
      if (right.ranking.score !== left.ranking.score) {
        return right.ranking.score - left.ranking.score;
      }

      if (left.price !== right.price) {
        return left.price - right.price;
      }

      return left.distanceMiles - right.distanceMiles;
    })
    .map((station) => {
      delete station._grid;
      return station;
    });
}

export function processStations(rows, userLocation, fuelType) {
  return rankStations(
    rows
      .map((row) => normaliseStation(row, userLocation, fuelType))
      .filter(Boolean),
  );
}
