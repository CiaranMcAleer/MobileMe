export const DEFAULT_MAP_CENTER = [-1.6, 54.7];

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function haversineMiles(lat1, lon1, lat2, lon2) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = toRadians(lat2 - lat1);
  const longitudeDelta = toRadians(lon2 - lon1);
  const chordLength =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(chordLength), Math.sqrt(1 - chordLength));
}
