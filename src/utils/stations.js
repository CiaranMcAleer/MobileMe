export function formatPrice(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(1)}p`;
}

export function formatDistance(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(1)} mi`;
}

export function getLocationLabel(coords) {
  return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
}

export function formatTimestamp(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRankingDelta(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const rounded = Math.abs(value).toFixed(1);
  return value >= 0 ? `-${rounded}p vs local avg` : `+${rounded}p vs local avg`;
}
