export interface LatLng {
  lat: number
  lng: number
}

const R = 6371000

export function haversineMeters(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export function bearingDeg(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180
  const φ2 = (to.lat * Math.PI) / 180
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x)
  return ((θ * 180) / Math.PI + 360) % 360
}

/** Cumulative distance from first vertex to each vertex (same length as coords). */
export function cumulativeLengthsMeters(coords: LatLng[]): number[] {
  const out: number[] = [0]
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + haversineMeters(coords[i - 1], coords[i]))
  }
  return out
}

/**
 * Point at distance along open polyline, looping by total length.
 * Returns position and heading (deg) for the segment containing the point.
 */
export function pointAlongPolyline(
  coords: LatLng[],
  distanceMeters: number
): { lat: number; lng: number; heading_deg: number } {
  if (coords.length === 0) {
    return { lat: 0, lng: 0, heading_deg: 0 }
  }
  if (coords.length === 1) {
    return { lat: coords[0].lat, lng: coords[0].lng, heading_deg: 0 }
  }
  const cum = cumulativeLengthsMeters(coords)
  const total = cum[cum.length - 1] || 1
  let d = distanceMeters % total
  if (d < 0) d += total
  let seg = 0
  while (seg < cum.length - 1 && cum[seg + 1] < d) seg++
  const segStart = cum[seg]
  const segEnd = cum[seg + 1]
  const segLen = segEnd - segStart || 1
  const t = (d - segStart) / segLen
  const a = coords[seg]
  const b = coords[seg + 1]
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    heading_deg: bearingDeg(a, b),
  }
}

/** Distance along polyline from start to the closest point to `target` (forward-only wrap). */
export function distanceToStopAlongRoute(
  coords: LatLng[],
  stopPosition: LatLng,
  vehicleDistanceAlong: number
): { forward_m: number; stop_distance_along_m: number } {
  if (coords.length < 2) {
    return { forward_m: 0, stop_distance_along_m: 0 }
  }
  const cum = cumulativeLengthsMeters(coords)
  const total = cum[cum.length - 1] || 1
  let bestIdx = 0
  let bestD = Infinity
  for (let i = 0; i < coords.length; i++) {
    const d = haversineMeters(coords[i], stopPosition)
    if (d < bestD) {
      bestD = d
      bestIdx = i
    }
  }
  const stopAlong = cum[bestIdx]
  let forward = stopAlong - vehicleDistanceAlong
  if (forward < 0) forward += total
  return { forward_m: forward, stop_distance_along_m: stopAlong }
}
