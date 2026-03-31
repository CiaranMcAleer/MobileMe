import {
  buildFuelSnapshotCsv,
  buildSnapshotManifest,
  buildSnapshotStoragePlan,
  fetchFuelFinderSnapshot,
  getFuelFinderConfigFromEnv,
  LATEST_MANIFEST_KEY,
  LATEST_SNAPSHOT_KEY,
} from "../lib/fuelSnapshot.js";

const DUBLIN_TIME_ZONE = "Europe/Dublin";
const EIGHT_AM_HOUR = "08";
const CSV_CACHE_CONTROL = "public, max-age=300, s-maxage=300";
const JSON_CACHE_CONTROL = "public, max-age=60, s-maxage=60";

function isScheduledForDublinEightAm(scheduledTime) {
  const dublinHour = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: DUBLIN_TIME_ZONE,
  }).format(new Date(scheduledTime));

  return dublinHour === EIGHT_AM_HOUR;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": JSON_CACHE_CONTROL,
    },
  });
}

async function readBucketObject(bucket, key, cacheControl) {
  const object = await bucket.get(key);
  if (!object) {
    return null;
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", cacheControl);
  headers.set("x-mobileme-snapshot-key", key);

  return new Response(object.body, { headers });
}

async function writeSnapshotObject(bucket, key, body, httpMetadata, customMetadata) {
  await bucket.put(key, body, {
    customMetadata,
    httpMetadata,
  });
}

export async function refreshFuelData(env, options = {}) {
  const currentTime = options.currentTime ?? new Date();
  const { apiBaseUrl, clientId, clientSecret, environment } = getFuelFinderConfigFromEnv(env);
  const { prices, forecourts } = await fetchFuelFinderSnapshot({
    fetchImpl: options.fetchImpl ?? fetch,
    apiBaseUrl,
    clientId,
    clientSecret,
  });

  const csvText = buildFuelSnapshotCsv({ prices, forecourts });
  const storagePlan = buildSnapshotStoragePlan(currentTime);
  const manifest = buildSnapshotManifest({
    storagePlan,
    environment,
    pricesCount: prices.length,
    forecourtsCount: forecourts.length,
  });
  const manifestText = JSON.stringify(manifest, null, 2);
  const customMetadata = {
    environment,
    generatedAt: storagePlan.generatedAt,
    kind: "fuel-finder-snapshot",
  };

  await Promise.all([
    writeSnapshotObject(
      env.FUEL_DATA_BUCKET,
      storagePlan.latestCsvKey,
      csvText,
      {
        cacheControl: CSV_CACHE_CONTROL,
        contentDisposition: "inline; filename=latest-fuelprices.csv",
        contentType: "text/csv; charset=utf-8",
      },
      {
        ...customMetadata,
        role: "latest",
      },
    ),
    writeSnapshotObject(
      env.FUEL_DATA_BUCKET,
      storagePlan.dailyCsvKey,
      csvText,
      {
        cacheControl: CSV_CACHE_CONTROL,
        contentDisposition: "inline; filename=latest-fuelprices.csv",
        contentType: "text/csv; charset=utf-8",
      },
      {
        ...customMetadata,
        role: "daily",
      },
    ),
    // Immutable per-run snapshots preserve historical prices for later analytics.
    writeSnapshotObject(
      env.FUEL_DATA_BUCKET,
      storagePlan.versionedCsvKey,
      csvText,
      {
        contentDisposition: "inline; filename=latest-fuelprices.csv",
        contentType: "text/csv; charset=utf-8",
      },
      {
        ...customMetadata,
        role: "versioned",
      },
    ),
    writeSnapshotObject(
      env.FUEL_DATA_BUCKET,
      storagePlan.latestManifestKey,
      manifestText,
      {
        cacheControl: JSON_CACHE_CONTROL,
        contentDisposition: "inline; filename=latest-fuelprices.json",
        contentType: "application/json; charset=utf-8",
      },
      {
        ...customMetadata,
        role: "latest-manifest",
      },
    ),
    writeSnapshotObject(
      env.FUEL_DATA_BUCKET,
      storagePlan.dailyManifestKey,
      manifestText,
      {
        contentDisposition: "inline; filename=manifest.json",
        contentType: "application/json; charset=utf-8",
      },
      {
        ...customMetadata,
        role: "daily-manifest",
      },
    ),
    writeSnapshotObject(
      env.FUEL_DATA_BUCKET,
      storagePlan.versionedManifestKey,
      manifestText,
      {
        contentDisposition: "inline; filename=manifest.json",
        contentType: "application/json; charset=utf-8",
      },
      {
        ...customMetadata,
        role: "versioned-manifest",
      },
    ),
  ]);

  return manifest;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    if (url.pathname === "/data/latest-fuelprices.csv") {
      const response = await readBucketObject(env.FUEL_DATA_BUCKET, LATEST_SNAPSHOT_KEY, CSV_CACHE_CONTROL);
      return response ?? new Response("Fuel snapshot not found.", { status: 404 });
    }

    if (url.pathname === "/data/latest-fuelprices.json") {
      const response = await readBucketObject(env.FUEL_DATA_BUCKET, LATEST_MANIFEST_KEY, JSON_CACHE_CONTROL);
      return response ?? jsonResponse({ error: "Fuel snapshot manifest not found." }, 404);
    }

    if (url.pathname === "/api/health/fuel-data") {
      const snapshotHead = await env.FUEL_DATA_BUCKET.head(LATEST_SNAPSHOT_KEY);
      return jsonResponse({
        bucketConfigured: Boolean(env.FUEL_DATA_BUCKET),
        latestSnapshotKey: LATEST_SNAPSHOT_KEY,
        latestSnapshotUploadedAt: snapshotHead?.uploaded?.toISOString() ?? null,
      });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(controller, env, ctx) {
    if (!isScheduledForDublinEightAm(controller.scheduledTime)) {
      return;
    }

    ctx.waitUntil(refreshFuelData(env, { currentTime: new Date(controller.scheduledTime) }));
  },
};
