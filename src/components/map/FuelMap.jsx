import React from "react";
import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import { DEFAULT_MAP_CENTER } from "../../utils/geo";
import { formatDistance, formatPrice, formatTimestamp } from "../../utils/stations";
import { fuelMapStyle } from "./mapStyle";

const STATION_SOURCE_ID = "fuel-stations";
const CLUSTER_LAYER_ID = "fuel-station-clusters";
const CLUSTER_COUNT_LAYER_ID = "fuel-station-cluster-count";
const STATION_LAYER_ID = "fuel-station-points";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPopupMarkup(station) {
  return `
    <article class="map-popup-card">
      <p class="map-popup-eyebrow">${escapeHtml(station.brand)}</p>
      <h3>${escapeHtml(station.name)}</h3>
      <dl>
        <div><dt>Price</dt><dd>${formatPrice(station.price)}</dd></div>
        <div><dt>Distance</dt><dd>${formatDistance(station.distanceMiles)}</dd></div>
        <div><dt>Updated</dt><dd>${formatTimestamp(station.updatedAt)}</dd></div>
      </dl>
      <a href="${escapeHtml(station.routeUrl)}" rel="noreferrer" target="_blank">Route in Google Maps</a>
    </article>
  `;
}

function createMarkerElement({ isSelected, label, variant }) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `fuel-marker ${variant} ${isSelected ? "is-selected" : ""}`.trim();
  element.setAttribute("aria-label", label);
  element.innerHTML = '<span class="fuel-marker-core"></span>';
  return element;
}

function createFeatureCollection(stations, selectedStationId) {
  return {
    type: "FeatureCollection",
    features: stations
      .filter((station) => station.id !== selectedStationId)
      .map((station) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [station.longitude, station.latitude],
        },
        properties: {
          id: station.id,
          name: station.name,
          brand: station.brand,
          city: station.city,
          postcode: station.postcode,
          price: station.price,
          priceLabel: formatPrice(station.price),
        },
      })),
  };
}

function addStationLayers(map) {
  map.addSource(STATION_SOURCE_ID, {
    type: "geojson",
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 46,
    data: createFeatureCollection([], null),
  });

  map.addLayer({
    id: CLUSTER_LAYER_ID,
    type: "circle",
    source: STATION_SOURCE_ID,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#d9ff72",
      "circle-radius": ["step", ["get", "point_count"], 18, 12, 24, 32, 30],
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: CLUSTER_COUNT_LAYER_ID,
    type: "symbol",
    source: STATION_SOURCE_ID,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Arial Unicode MS Bold"],
      "text-size": 12,
    },
    paint: {
      "text-color": "#000000",
    },
  });

  map.addLayer({
    id: STATION_LAYER_ID,
    type: "circle",
    source: STATION_SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#d9ff72",
      "circle-radius": 8,
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 2,
    },
  });
}

export default function FuelMap({ onSelectStation, selectedStationId, stations, userLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const selectedMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const stationLookupRef = useRef(new Map());
  const previousSelectionRef = useRef(null);

  const mapCenter = useMemo(() => {
    if (!userLocation) {
      return DEFAULT_MAP_CENTER;
    }

    return [userLocation.longitude, userLocation.latitude];
  }, [userLocation]);

  useEffect(() => {
    stationLookupRef.current = new Map(stations.map((station) => [station.id, station]));
  }, [stations]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = new maplibregl.Map({
      attributionControl: true,
      center: mapCenter,
      container: containerRef.current,
      dragRotate: false,
      pitchWithRotate: false,
      style: fuelMapStyle,
      zoom: userLocation ? 10.8 : 5.4,
    });

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnMove: false,
      maxWidth: "280px",
      offset: 18,
      className: "fuel-map-popup",
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.touchZoomRotate.disableRotation();

    map.on("load", () => {
      addStationLayers(map);
    });

    map.on("click", CLUSTER_LAYER_ID, (event) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: [CLUSTER_LAYER_ID] })[0];
      const clusterId = feature?.properties?.cluster_id;
      const source = map.getSource(STATION_SOURCE_ID);

      if (!source || clusterId == null) {
        return;
      }

      source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error) {
          return;
        }

        map.easeTo({ center: feature.geometry.coordinates, zoom });
      });
    });

    map.on("click", STATION_LAYER_ID, (event) => {
      const feature = event.features?.[0];
      const stationId = feature?.properties?.id;
      const station = stationLookupRef.current.get(stationId);

      if (!station) {
        return;
      }

      popupRef.current
        ?.setLngLat([station.longitude, station.latitude])
        .setHTML(buildPopupMarkup(station))
        .addTo(map);

      onSelectStation(station.id);
    });

    const setPointerCursor = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const clearPointerCursor = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("mouseenter", CLUSTER_LAYER_ID, setPointerCursor);
    map.on("mouseleave", CLUSTER_LAYER_ID, clearPointerCursor);
    map.on("mouseenter", STATION_LAYER_ID, setPointerCursor);
    map.on("mouseleave", STATION_LAYER_ID, clearPointerCursor);

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(containerRef.current);
    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      popupRef.current?.remove();
      selectedMarkerRef.current?.remove();
      userMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      popupRef.current = null;
      selectedMarkerRef.current = null;
      userMarkerRef.current = null;
    };
  }, [mapCenter, onSelectStation, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource(STATION_SOURCE_ID);

    if (!map || !source) {
      return;
    }

    source.setData(createFeatureCollection(stations, selectedStationId));

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      userMarkerRef.current = new maplibregl.Marker({
        element: createMarkerElement({
          isSelected: false,
          label: "Your current location",
          variant: "is-user",
        }),
      })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);
    }

    const bounds = new maplibregl.LngLatBounds();
    let hasBounds = false;

    if (userLocation) {
      bounds.extend([userLocation.longitude, userLocation.latitude]);
      hasBounds = true;
    }

    stations.forEach((station) => {
      bounds.extend([station.longitude, station.latitude]);
      hasBounds = true;
    });

    if (hasBounds) {
      map.fitBounds(bounds, {
        animate: false,
        maxZoom: userLocation && stations.length <= 1 ? 13 : 12.5,
        padding: { bottom: 68, left: 48, right: 48, top: 48 },
      });
    } else {
      map.jumpTo({ center: DEFAULT_MAP_CENTER, zoom: 5.4 });
    }
  }, [stations, userLocation]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const selectedStation = stations.find((station) => station.id === selectedStationId) ?? null;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }

    if (!selectedStation) {
      return;
    }

    const markerElement = createMarkerElement({
      isSelected: true,
      label: `${selectedStation.name} selected`,
      variant: "is-station",
    });

    markerElement.addEventListener("click", () => {
      popupRef.current
        ?.setLngLat([selectedStation.longitude, selectedStation.latitude])
        .setHTML(buildPopupMarkup(selectedStation))
        .addTo(map);
    });

    selectedMarkerRef.current = new maplibregl.Marker({ element: markerElement })
      .setLngLat([selectedStation.longitude, selectedStation.latitude])
      .addTo(map);
  }, [selectedStationId, stations]);

  useEffect(() => {
    const map = mapRef.current;
    const selectedStation = stations.find((station) => station.id === selectedStationId);

    if (!map || !selectedStation || previousSelectionRef.current === selectedStationId) {
      previousSelectionRef.current = selectedStationId;
      return;
    }

    map.flyTo({
      center: [selectedStation.longitude, selectedStation.latitude],
      duration: 600,
      essential: true,
      zoom: Math.max(map.getZoom(), 11.5),
    });

    popupRef.current
      ?.setLngLat([selectedStation.longitude, selectedStation.latitude])
      .setHTML(buildPopupMarkup(selectedStation))
      .addTo(map);

    previousSelectionRef.current = selectedStationId;
  }, [selectedStationId, stations]);

  return (
    <section className="panel map-panel panel-shadow">
      <div className="map-panel-header">
        <div>
          <div className="eyebrow">Live map</div>
          <h2>Nearby forecourts</h2>
        </div>
      </div>
      <div className="map-frame">
        <div className="map-overlay-grid" aria-hidden="true" />
        <div className="map-canvas" ref={containerRef} />
      </div>
    </section>
  );
}
