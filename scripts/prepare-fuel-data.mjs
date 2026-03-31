import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFuelSnapshotCsv,
  fetchFuelFinderSnapshot,
  getFuelFinderConfigFromEnv,
} from "../lib/fuelSnapshot.js";

const OUTPUT_RELATIVE_PATH = ["public", "data", "latest-fuelprices.csv"];

async function main() {
  const { apiBaseUrl, clientId, clientSecret, environment } = getFuelFinderConfigFromEnv(process.env);
  const { prices, forecourts } = await fetchFuelFinderSnapshot({
    fetchImpl: fetch,
    apiBaseUrl,
    clientId,
    clientSecret,
  });

  const csvText = buildFuelSnapshotCsv({ prices, forecourts });
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
