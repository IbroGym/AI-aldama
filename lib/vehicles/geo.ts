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

type XY = { x: number; y: number }

function toLocalMeters(origin: LatLng, p: LatLng): XY {
  const latRad = (origin.lat * Math.PI) / 180
  const mPerDegLat = 111_320
  const mPerDegLng = 111_320 * Math.cos(latRad)
  return {
    x: (p.lng - origin.lng) * mPerDegLng,
    y: (p.lat - origin.lat) * mPerDegLat,
  }
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

/**
 * Distance along polyline from start to closest projected point to `target`.
 * Uses segment projection (continuous) instead of nearest vertex (discrete).
 */
export function closestPointAlongPolyline(
  coords: LatLng[],
  target: LatLng
): { along_m: number; lateral_m: number } {
  if (coords.length < 2) return { along_m: 0, lateral_m: Infinity }
  const cum = cumulativeLengthsMeters(coords)
  let bestAlong = 0
  let bestLateral = Infinity

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]
    const b = coords[i + 1]
    const axy = toLocalMeters(target, a)
    const bxy = toLocalMeters(target, b)
    const abx = bxy.x - axy.x
    const aby = bxy.y - axy.y
    const ab2 = abx * abx + aby * aby
    const t = ab2 > 0 ? Math.max(0, Math.min(1, -(axy.x * abx + axy.y * aby) / ab2)) : 0
    const px = axy.x + abx * t
    const py = axy.y + aby * t
    const lateral = Math.hypot(px, py)
    if (lateral < bestLateral) {
      const segLen = cum[i + 1] - cum[i]
      bestLateral = lateral
      bestAlong = cum[i] + segLen * t
    }
  }

  return { along_m: bestAlong, lateral_m: bestLateral }
}

/** Distance along polyline from start to the closest point to `target` (forward-only wrap). */
export function distanceToStopAlongRoute(
  coords: LatLng[],
  stopPosition: LatLng,
  vehicleDistanceAlong: number
): { forward_m: number; stop_distance_along_m: number; lateral_m: number } {
  if (coords.length < 2) {
    return { forward_m: 0, stop_distance_along_m: 0, lateral_m: Infinity }
  }
  const cum = cumulativeLengthsMeters(coords)
  const total = cum[cum.length - 1] || 1
  const { along_m: stopAlong, lateral_m } = closestPointAlongPolyline(
    coords,
    stopPosition
  )
  let forward = stopAlong - vehicleDistanceAlong
  if (forward < 0) forward += total
  return { forward_m: forward, stop_distance_along_m: stopAlong, lateral_m }
}
