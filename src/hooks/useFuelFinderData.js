import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentPosition } from "../services/fuelFinderClient";
import { formatTimestamp } from "../utils/stations";

function createFuelProcessingWorker() {
  return new Worker(new URL("../workers/fuelProcessing.worker.js", import.meta.url), {
    type: "module",
  });
}

export function useFuelFinderData(fuelType) {
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const hasProcessedRef = useRef(false);
  const [stations, setStations] = useState([]);
  const [rowsCount, setRowsCount] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [status, setStatus] = useState("Requesting your location…");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedTimestamp, setLastUpdatedTimestamp] = useState(null);

  useEffect(() => {
    const worker = createFuelProcessingWorker();
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadLocationAndInitialStations() {
      try {
        setIsLoading(true);
        setError("");
        setStatus("Requesting your location…");

        const position = await getCurrentPosition();
        if (!active) {
          return;
        }

        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setUserLocation(coords);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setStations([]);
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load the published fuel data.",
        );
        setStatus("Fuel price snapshot unavailable.");
        setIsLoading(false);
      }
    }

    loadLocationAndInitialStations();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !userLocation) {
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const initialLoad = !hasProcessedRef.current;

    setError("");
    setIsRefreshing(!initialLoad);
    setIsLoading(initialLoad);
    setStatus(
      initialLoad
        ? `Fetching and ranking ${fuelType} stations…`
        : `Refreshing ${fuelType} rankings…`,
    );

    const handleMessage = (messageEvent) => {
      const payload = messageEvent.data;
      if (payload?.requestId !== requestId) {
        return;
      }

      if (payload.status === "error") {
        setStations([]);
        setRowsCount(0);
        setError(payload.error ?? "Failed to process the published fuel data.");
        setStatus("Fuel price snapshot unavailable.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      setStations(payload.stations ?? []);
      setRowsCount(payload.rowsCount ?? 0);
      hasProcessedRef.current = true;
      setLastUpdatedTimestamp(payload.lastUpdatedTimestamp ?? null);
      setStatus(
        `Ranked ${(payload.stations?.length ?? 0).toLocaleString()} ${fuelType} stations from ${(
          payload.rowsCount ?? 0
        ).toLocaleString()} live forecourts.`,
      );
      setIsLoading(false);
      setIsRefreshing(false);
    };

    const handleError = () => {
      setStations([]);
      setRowsCount(0);
      hasProcessedRef.current = false;
      setError("Worker processing failed.");
      setStatus("Fuel price snapshot unavailable.");
      setIsLoading(false);
      setIsRefreshing(false);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ fuelType, requestId, type: "process", userLocation });

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
  }, [fuelType, userLocation]);

  const lastUpdatedLabel = useMemo(
    () => formatTimestamp(lastUpdatedTimestamp),
    [lastUpdatedTimestamp],
  );

  return {
    error,
    isLoading,
    isRefreshing,
    lastUpdatedLabel,
    rowsCount,
    stations,
    status,
    userLocation,
  };
}
