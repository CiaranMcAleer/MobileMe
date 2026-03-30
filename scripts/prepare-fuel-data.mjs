import { createDecipheriv, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SECRET_KEY =
  "8762dae892591b98df04f6badb39550ded3aec52e1227f816367af8d3064ba22";
const API_BASE = "https://www.fuel-finder.service.gov.uk";
const PRESIGNED_URL_PATH = "/internal/v1.0.2/csv/generate-presigned-url";

function decryptPayload(payload) {
  const key = createHash("sha256").update(SECRET_KEY.trim()).digest();
  const decipher = createDecipheriv(
    "aes-256-cbc",
    key,
    Buffer.from(payload.iv, "hex"),
  );

  let decoded = decipher.update(payload.nxhex, "hex", "utf8");
  decoded += decipher.final("utf8");
  return JSON.parse(decoded);
}

async function downloadFuelData() {
  const presignedResponse = await fetch(`${API_BASE}${PRESIGNED_URL_PATH}`);
  if (!presignedResponse.ok) {
    throw new Error(`Fuel Finder presigned URL request failed with ${presignedResponse.status}.`);
  }

  const encryptedPayload = await presignedResponse.json();
  const decryptedPayload = decryptPayload(encryptedPayload);
  const redirectUrl = decryptedPayload?.data?.redirectUrl;

  if (!redirectUrl) {
    throw new Error("Fuel Finder did not return a CSV download URL.");
  }

  const csvResponse = await fetch(redirectUrl, { redirect: "follow" });
  if (!csvResponse.ok) {
    throw new Error(`Fuel Finder CSV download failed with ${csvResponse.status}.`);
  }

  const contentType = csvResponse.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/csv")) {
    throw new Error(`Fuel Finder returned unexpected content type: ${contentType || "unknown"}.`);
  }

  const csvText = await csvResponse.text();
  if (!csvText.startsWith("forecourt_update_timestamp,")) {
    throw new Error("Fuel Finder snapshot did not contain the expected CSV header.");
  }

  return csvText;
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const outputDirectory = path.resolve(scriptDirectory, "..", "public", "data");
  const outputFile = path.join(outputDirectory, "latest-fuelprices.csv");

  const csvText = await downloadFuelData();

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, csvText, "utf8");

  const rowCount = Math.max(csvText.split("\n").length - 1, 0);
  console.log(`Saved fuel price snapshot to ${outputFile} (${rowCount.toLocaleString()} rows).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
