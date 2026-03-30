import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT_RELATIVE_PATH = ["public", "data", "latest-fuelprices.csv"];
const DEFAULT_ENVIRONMENT = "production";
const BATCH_SIZE = 500;
const CSV_COLUMNS = [
  "forecourt_update_timestamp",
  "forecourts.node_id",
  "forecourts.trading_name",
  "forecourts.brand_name",
  "forecourts.is_motorway_service_station",
  "forecourts.is_supermarket_service_station",
  "forecourts.public_phone_number",
  "forecourts.temporary_closure",
  "forecourts.permanent_closure",
  "forecourts.permanent_closure_date",
  "forecourts.location.postcode",
  "forecourts.location.address_line_1",
  "forecourts.location.address_line_2",
  "forecourts.location.city",
  "forecourts.location.county",
  "forecourts.location.country",
  "forecourts.location.latitude",
  "forecourts.location.longitude",
  "forecourts.fuel_price.E5",
  "forecourts.price_submission_timestamp.E5",
  "forecourts.price_change_effective_timestamp.E5",
  "forecourts.fuel_price.E10",
  "forecourts.price_submission_timestamp.E10",
  "forecourts.price_change_effective_timestamp.E10",
  "forecourts.fuel_price.B7S",
  "forecourts.price_submission_timestamp.B7S",
  "forecourts.price_change_effective_timestamp.B7S",
  "forecourts.fuel_price.B7P",
  "forecourts.price_submission_timestamp.B7P",
  "forecourts.price_change_effective_timestamp.B7P",
  "forecourts.fuel_price.B10",
  "forecourts.price_submission_timestamp.B10",
  "forecourts.price_change_effective_timestamp.B10",
  "forecourts.fuel_price.HVO",
  "forecourts.price_submission_timestamp.HVO",
  "forecourts.price_change_effective_timestamp.HVO",
  "forecourts.opening_times.usual_days.monday.open_time",
  "forecourts.opening_times.usual_days.monday.close_time",
  "forecourts.opening_times.usual_days.monday.is_24_hours",
  "forecourts.opening_times.usual_days.tuesday.open_time",
  "forecourts.opening_times.usual_days.tuesday.close_time",
  "forecourts.opening_times.usual_days.tuesday.is_24_hours",
  "forecourts.opening_times.usual_days.wednesday.open_time",
  "forecourts.opening_times.usual_days.wednesday.close_time",
  "forecourts.opening_times.usual_days.wednesday.is_24_hours",
  "forecourts.opening_times.usual_days.thursday.open_time",
  "forecourts.opening_times.usual_days.thursday.close_time",
  "forecourts.opening_times.usual_days.thursday.is_24_hours",
  "forecourts.opening_times.usual_days.friday.open_time",
  "forecourts.opening_times.usual_days.friday.close_time",
  "forecourts.opening_times.usual_days.friday.is_24_hours",
  "forecourts.opening_times.usual_days.saturday.open_time",
  "forecourts.opening_times.usual_days.saturday.close_time",
  "forecourts.opening_times.usual_days.saturday.is_24_hours",
  "forecourts.opening_times.usual_days.sunday.open_time",
  "forecourts.opening_times.usual_days.sunday.close_time",
  "forecourts.opening_times.usual_days.sunday.is_24_hours",
  "forecourts.opening_times.bank_holiday.standard.open_time",
  "forecourts.opening_times.bank_holiday.standard.close_time",
  "forecourts.opening_times.bank_holiday.standard.is_24_hours",
  "forecourts.amenities.fuel_and_energy_services.adblue_pumps",
  "forecourts.amenities.fuel_and_energy_services.adblue_packaged",
  "forecourts.amenities.fuel_and_energy_services.lpg_pumps",
  "forecourts.amenities.vehicle_services.car_wash",
  "forecourts.amenities.air_pump_or_screenwash",
  "forecourts.amenities.water_filling",
  "forecourts.amenities.twenty_four_hour_fuel",
  "forecourts.amenities.customer_toilets",
];
const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const CSV_FUEL_CODES = ["E5", "E10", "B7S", "B7P", "B10", "HVO"];
const API_FUEL_CODE_ALIASES = {
  E5: ["E5"],
  E10: ["E10"],
  B7S: ["B7_STANDARD", "B7S", "B7"],
  B7P: ["B7_PREMIUM", "B7P"],
  B10: ["B10"],
  HVO: ["HVO"],
};
const AMENITY_COLUMN_TO_KEYS = {
  "forecourts.amenities.fuel_and_energy_services.adblue_pumps": ["adblue_pumps"],
  "forecourts.amenities.fuel_and_energy_services.adblue_packaged": ["adblue_packaged"],
  "forecourts.amenities.fuel_and_energy_services.lpg_pumps": ["lpg_pumps"],
  "forecourts.amenities.vehicle_services.car_wash": ["car_wash"],
  "forecourts.amenities.air_pump_or_screenwash": ["air_pump_or_screenwash"],
  "forecourts.amenities.water_filling": ["water_filling"],
  "forecourts.amenities.twenty_four_hour_fuel": ["twenty_four_hour_fuel", "24_hour_fuel"],
  "forecourts.amenities.customer_toilets": ["customer_toilets"],
};

function getEnvironmentConfig() {
  const clientId = process.env.FUEL_FINDER_CLIENT_ID?.trim();
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET?.trim();
  const environment = process.env.FUEL_FINDER_ENVIRONMENT?.trim() || DEFAULT_ENVIRONMENT;

  if (!clientId || !clientSecret) {
    throw new Error(
      "FUEL_FINDER_CLIENT_ID and FUEL_FINDER_CLIENT_SECRET environment variables must be set.",
    );
  }

  if (environment !== "production" && environment !== "test") {
    throw new Error(`Unsupported FUEL_FINDER_ENVIRONMENT: ${environment}`);
  }

  const host =
    environment === "test"
      ? "https://test.fuel-finder.service.gov.uk"
      : "https://www.fuel-finder.service.gov.uk";

  return {
    apiBaseUrl: `${host}/api/v1`,
    clientId,
    clientSecret,
    environment,
  };
}

async function postJson(url, body, extraHeaders = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${extractErrorMessage(payload)}`);
  }

  return unwrapApiPayload(payload);
}

async function getJson(url, token, params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });

  const targetUrl = `${url}?${search.toString()}`;
  const response = await fetch(targetUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(`${targetUrl} returned ${response.status}: ${extractErrorMessage(payload)}`);
  }

  return unwrapApiPayload(payload);
}

async function parseJsonResponse(response) {
  const responseText = await response.text();

  try {
    return responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    throw new Error(
      `Expected JSON from ${response.url}, received ${responseText.slice(0, 200) || "empty response"}.`,
    );
  }
}

function extractErrorMessage(payload) {
  if (!payload) {
    return "Empty response body";
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (payload.data) {
    return extractErrorMessage(payload.data);
  }

  if (payload.error?.details) {
    return extractErrorMessage(payload.error.details);
  }

  return JSON.stringify(payload);
}

function unwrapApiPayload(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }

  return payload;
}

async function fetchAccessToken(apiBaseUrl, clientId, clientSecret) {
  const tokenPayload = await postJson(`${apiBaseUrl}/oauth/generate_access_token`, {
    client_id: clientId,
    client_secret: clientSecret,
  });

  const accessToken = tokenPayload?.access_token;
  if (!accessToken) {
    throw new Error("Fuel Finder token response did not include access_token.");
  }

  return accessToken;
}

async function fetchPaginatedCollection(apiBaseUrl, token, endpoint) {
  const rows = [];

  for (let batchNumber = 1; ; batchNumber += 1) {
    const batch = await getJson(`${apiBaseUrl}${endpoint}`, token, {
      "batch-number": batchNumber,
    });

    if (!Array.isArray(batch)) {
      throw new Error(`${endpoint} batch ${batchNumber} did not return an array.`);
    }

    if (!batch.length) {
      break;
    }

    rows.push(...batch);

    if (batch.length < BATCH_SIZE) {
      break;
    }
  }

  return rows;
}

function formatBoolean(value) {
  return value === true ? "true" : value === false ? "false" : "";
}

function formatNullable(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function formatCoordinate(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(7) : "";
}

function formatPrice(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(4) : "";
}

function escapeCsvCell(value) {
  const text = formatNullable(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function extractFuelPriceFields(fuelPrices) {
  const fields = {};

  for (const csvFuelCode of CSV_FUEL_CODES) {
    const aliases = API_FUEL_CODE_ALIASES[csvFuelCode] ?? [csvFuelCode];
    const priceRecord = fuelPrices.find((candidate) => aliases.includes(candidate?.fuel_type));

    fields[`forecourts.fuel_price.${csvFuelCode}`] = formatPrice(priceRecord?.price);
    fields[`forecourts.price_submission_timestamp.${csvFuelCode}`] = formatNullable(
      priceRecord?.price_last_updated,
    );
    fields[`forecourts.price_change_effective_timestamp.${csvFuelCode}`] = formatNullable(
      priceRecord?.price_change_effective_timestamp,
    );
  }

  return fields;
}

function extractLatestUpdateTimestamp(fuelPrices) {
  const timestamps = fuelPrices
    .flatMap((fuelPrice) => [fuelPrice?.price_change_effective_timestamp, fuelPrice?.price_last_updated])
    .filter(Boolean)
    .map((timestamp) => Date.parse(timestamp))
    .filter((parsedTimestamp) => !Number.isNaN(parsedTimestamp));

  if (!timestamps.length) {
    return "";
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function extractDayHours(dayOpening) {
  if (!dayOpening || typeof dayOpening !== "object") {
    return {
      closeTime: "",
      is24Hours: "",
      openTime: "",
    };
  }

  return {
    openTime: formatNullable(dayOpening.open_time ?? dayOpening.open),
    closeTime: formatNullable(dayOpening.close_time ?? dayOpening.close),
    is24Hours: formatBoolean(dayOpening.is_24_hours),
  };
}

function extractOpeningTimeFields(openingTimes) {
  const fields = {};
  const usualDays = openingTimes?.usual_days ?? {};

  for (const weekday of WEEKDAYS) {
    const day = extractDayHours(usualDays?.[weekday]);
    fields[`forecourts.opening_times.usual_days.${weekday}.open_time`] = day.openTime;
    fields[`forecourts.opening_times.usual_days.${weekday}.close_time`] = day.closeTime;
    fields[`forecourts.opening_times.usual_days.${weekday}.is_24_hours`] = day.is24Hours;
  }

  const bankHolidayHours = extractDayHours(
    openingTimes?.bank_holiday?.standard ?? openingTimes?.bank_holiday,
  );
  fields["forecourts.opening_times.bank_holiday.standard.open_time"] = bankHolidayHours.openTime;
  fields["forecourts.opening_times.bank_holiday.standard.close_time"] = bankHolidayHours.closeTime;
  fields["forecourts.opening_times.bank_holiday.standard.is_24_hours"] = bankHolidayHours.is24Hours;

  return fields;
}

function extractAmenityFields(amenities) {
  const amenitySet = new Set();

  if (Array.isArray(amenities)) {
    amenities
      .filter((amenity) => typeof amenity === "string")
      .map((amenity) => amenity.trim())
      .filter(Boolean)
      .forEach((amenity) => amenitySet.add(amenity));
  } else if (amenities && typeof amenities === "object") {
    for (const [groupKey, groupValue] of Object.entries(amenities)) {
      if (!groupValue || typeof groupValue !== "object") {
        continue;
      }

      for (const [amenityKey, isPresent] of Object.entries(groupValue)) {
        if (isPresent === true) {
          amenitySet.add(amenityKey);
          amenitySet.add(`${groupKey}.${amenityKey}`);
        }
      }
    }
  }

  const fields = {};
  for (const [column, keys] of Object.entries(AMENITY_COLUMN_TO_KEYS)) {
    fields[column] = formatBoolean(keys.some((key) => amenitySet.has(key)));
  }

  return fields;
}

function buildCsvRow(priceRecord, forecourtRecord) {
  const fuelPrices = Array.isArray(priceRecord?.fuel_prices) ? priceRecord.fuel_prices : [];
  const location = forecourtRecord?.location ?? {};

  const row = {
    "forecourt_update_timestamp": extractLatestUpdateTimestamp(fuelPrices),
    "forecourts.node_id": formatNullable(priceRecord?.node_id ?? forecourtRecord?.node_id),
    "forecourts.trading_name": formatNullable(
      forecourtRecord?.trading_name ?? priceRecord?.trading_name,
    ),
    "forecourts.brand_name": formatNullable(forecourtRecord?.brand_name),
    "forecourts.is_motorway_service_station": formatBoolean(
      forecourtRecord?.is_motorway_service_station,
    ),
    "forecourts.is_supermarket_service_station": formatBoolean(
      forecourtRecord?.is_supermarket_service_station,
    ),
    "forecourts.public_phone_number": formatNullable(
      forecourtRecord?.public_phone_number ?? priceRecord?.public_phone_number,
    ),
    "forecourts.temporary_closure": formatBoolean(forecourtRecord?.temporary_closure),
    "forecourts.permanent_closure": formatBoolean(forecourtRecord?.permanent_closure),
    "forecourts.permanent_closure_date": formatNullable(forecourtRecord?.permanent_closure_date),
    "forecourts.location.postcode": formatNullable(location.postcode),
    "forecourts.location.address_line_1": formatNullable(location.address_line_1),
    "forecourts.location.address_line_2": formatNullable(location.address_line_2),
    "forecourts.location.city": formatNullable(location.city),
    "forecourts.location.county": formatNullable(location.county),
    "forecourts.location.country": formatNullable(location.country),
    "forecourts.location.latitude": formatCoordinate(location.latitude),
    "forecourts.location.longitude": formatCoordinate(location.longitude),
    ...extractFuelPriceFields(fuelPrices),
    ...extractOpeningTimeFields(forecourtRecord?.opening_times),
    ...extractAmenityFields(forecourtRecord?.amenities),
  };

  return CSV_COLUMNS.map((column) => escapeCsvCell(row[column] ?? "")).join(",");
}

function buildCsv(prices, forecourts) {
  const forecourtByNodeId = new Map(
    forecourts
      .filter((forecourt) => forecourt?.node_id)
      .map((forecourt) => [forecourt.node_id, forecourt]),
  );

  const mergedRows = prices
    .filter((priceRecord) => priceRecord?.node_id)
    .map((priceRecord) => ({
      priceRecord,
      forecourtRecord: forecourtByNodeId.get(priceRecord.node_id) ?? null,
    }))
    .sort((left, right) => left.priceRecord.node_id.localeCompare(right.priceRecord.node_id));

  const csvLines = [CSV_COLUMNS.join(",")];
  mergedRows.forEach(({ priceRecord, forecourtRecord }) => {
    csvLines.push(buildCsvRow(priceRecord, forecourtRecord));
  });

  return `${csvLines.join("\n")}\n`;
}

async function main() {
  const { apiBaseUrl, clientId, clientSecret, environment } = getEnvironmentConfig();
  const accessToken = await fetchAccessToken(apiBaseUrl, clientId, clientSecret);
  const [prices, forecourts] = await Promise.all([
    fetchPaginatedCollection(apiBaseUrl, accessToken, "/pfs/fuel-prices"),
    fetchPaginatedCollection(apiBaseUrl, accessToken, "/pfs"),
  ]);

  if (!prices.length) {
    throw new Error("Fuel Finder price API returned no rows.");
  }

  if (!forecourts.length) {
    throw new Error("Fuel Finder forecourt API returned no rows.");
  }

  const csvText = buildCsv(prices, forecourts);
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const outputDirectory = path.resolve(scriptDirectory, "..", ...OUTPUT_RELATIVE_PATH.slice(0, -1));
  const outputFile = path.join(outputDirectory, OUTPUT_RELATIVE_PATH.at(-1));

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, csvText, "utf8");

  console.log(
    `Saved Fuel Finder ${environment} snapshot to ${outputFile} (${prices.length.toLocaleString()} priced forecourts, ${forecourts.length.toLocaleString()} forecourt records).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
