import {
  fetchFuelFinderAccessToken,
  getFuelFinderConfigFromEnv,
} from "../lib/fuelSnapshot.js";

export async function GET() {
  try {
    const { apiBaseUrl, clientId, clientSecret, environment } = getFuelFinderConfigFromEnv(process.env);
    const startedAt = Date.now();
    await fetchFuelFinderAccessToken({
      fetchImpl: fetch,
      apiBaseUrl,
      clientId,
      clientSecret,
    });

    return Response.json({
      environment,
      ok: true,
      probe: "token-endpoint",
      responseTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Fuel Finder probe failed.",
        ok: false,
        probe: "token-endpoint",
      },
      { status: 502 },
    );
  }
}
