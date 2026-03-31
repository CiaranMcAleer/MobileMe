import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFuelSnapshotCsv,
  buildSnapshotManifest,
  buildSnapshotStoragePlan,
  fetchFuelFinderSnapshot,
  getFuelFinderConfigFromEnv,
} from "../lib/fuelSnapshot.js";

const PUBLIC_DIRECTORY_SEGMENTS = ["public"];

function resolvePublicPath(scriptDirectory, snapshotKey) {
  return path.resolve(scriptDirectory, "..", ...PUBLIC_DIRECTORY_SEGMENTS, ...snapshotKey.split("/"));
}

async function writeSnapshotFile(scriptDirectory, snapshotKey, contents) {
  const outputFile = resolvePublicPath(scriptDirectory, snapshotKey);
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, contents, "utf8");
  return outputFile;
}

async function main() {
  const currentTime = new Date();
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const { apiBaseUrl, clientId, clientSecret, environment } = getFuelFinderConfigFromEnv(process.env);
  const { prices, forecourts } = await fetchFuelFinderSnapshot({
    fetchImpl: fetch,
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
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;

  const writtenFiles = await Promise.all([
    writeSnapshotFile(scriptDirectory, storagePlan.latestCsvKey, csvText),
    writeSnapshotFile(scriptDirectory, storagePlan.latestManifestKey, manifestText),
    writeSnapshotFile(scriptDirectory, storagePlan.dailyCsvKey, csvText),
    writeSnapshotFile(scriptDirectory, storagePlan.dailyManifestKey, manifestText),
    // Immutable per-run snapshots keep history for future analytics instead of overwriting it.
    writeSnapshotFile(scriptDirectory, storagePlan.versionedCsvKey, csvText),
    writeSnapshotFile(scriptDirectory, storagePlan.versionedManifestKey, manifestText),
  ]);

  console.log(
    [
      `Saved Fuel Finder ${environment} snapshot set (${prices.length.toLocaleString()} priced forecourts, ${forecourts.length.toLocaleString()} forecourt records).`,
      ...writtenFiles.map((filePath) => `- ${filePath}`),
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
