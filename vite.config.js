import { createDecipheriv, createHash } from "node:crypto";
import { defineConfig } from "vite";

const SECRET_KEY =
  "8762dae892591b98df04f6badb39550ded3aec52e1227f816367af8d3064ba22";
const FUEL_FINDER_API_BASE = "https://www.fuel-finder.service.gov.uk";
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

async function fetchLatestCsv() {
  const presignedResponse = await fetch(
    `${FUEL_FINDER_API_BASE}${PRESIGNED_URL_PATH}`,
  );

  if (!presignedResponse.ok) {
    throw new Error(
      `Presigned URL request failed with ${presignedResponse.status}`,
    );
  }

  const encryptedPayload = await presignedResponse.json();
  const decryptedPayload = decryptPayload(encryptedPayload);
  const redirectUrl = decryptedPayload?.data?.redirectUrl;

  if (!redirectUrl) {
    throw new Error("Fuel Finder did not return a CSV download URL.");
  }

  const csvResponse = await fetch(redirectUrl);

  if (!csvResponse.ok) {
    throw new Error(`CSV download failed with ${csvResponse.status}`);
  }

  return csvResponse.text();
}

export default defineConfig({
  plugins: [
    {
      name: "mobileme-fuel-finder-csv-proxy",
      configureServer(server) {
        server.middlewares.use(
          "/fuel-finder/latest-fuelprices.csv",
          async (_req, res) => {
            try {
              const csvText = await fetchLatestCsv();
              res.statusCode = 200;
              res.setHeader("Content-Type", "text/csv; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(csvText);
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Failed to fetch latest Fuel Finder CSV.";

              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: message }));
            }
          },
        );
      },
    },
  ],
  server: {
    fs: {
      allow: [".."],
    },
  },
});
