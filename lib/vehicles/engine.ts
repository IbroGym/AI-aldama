/**
 * Unified time-based transit simulation (stateless, deterministic).
 * Replace computeVehicleStates + ETA helpers with GTFS-Realtime adapters later
 * without changing API DTOs.
 */
import {
  cumulativeLengthsMeters,
  distanceToStopAlongRoute,
  pointAlongPolyline,
  type LatLng,
} from "./geo"
import type {
  EtaArrivalDTO,
  MapRouteDTO,
  MapStopDTO,
  TransitContextDTO,
} from "./types"

export interface DbBusLite {
  id: string
  current_route_id: string | null
}

export interface VehicleRuntimeState {
  id: string
  route_id: string
  route_number: string
  route_name: string
  route_color: string
  lat: number
  lng: number
  heading_deg: number
  /** Metres along the loop polyline [0, totalLen) */
  distance_along_m: number
  route_total_m: number
  /** Effective speed along route (m/s), time-integrated */
  speed_mps: number
  speed_kmh: number
  coordinates: LatLng[]
}

export function strSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i)
  return Math.abs(h)
}

export function routesServingStop(
  routes: MapRouteDTO[],
  stopId: string
): MapRouteDTO[] {
  return routes.filter((r) => r.stop_ids_ordered.includes(stopId))
}

/** Base speed (m/s) from vehicle id — stable per bus. */
function baseSpeedMps(vehicleId: string): number {
  const seed = strSeed(vehicleId)
  return 6.2 + (seed % 80) / 100 // ~22–31 km/h
}

/**
 * Slight speed variation over time (smooth, no discrete jumps).
 */
function effectiveSpeedMps(vehicleId: string, nowMs: number): number {
  const base = baseSpeedMps(vehicleId)
  const wobble = 0.04 * Math.sin(nowMs / 38_000 + strSeed(vehicleId) * 0.02)
  return Math.max(4.5, base * (1 + wobble))
}

function distanceAlongAtTime(
  totalLen: number,
  vehicleId: string,
  nowMs: number
): number {
  const speed = effectiveSpeedMps(vehicleId, nowMs)
  const seed = strSeed(vehicleId)
  const offset = ((seed % 10_000) / 10_000) * totalLen
  const travelled = (nowMs / 1000) * speed + offset
  let d = travelled % totalLen
  if (d < 0) d += totalLen
  return d
}

export function etaMinutesAndConfidence(
  coords: LatLng[],
  distanceAlongM: number,
  speedMps: number,
  stopPosition: LatLng
): { eta_minutes: number; confidence_pct: number; forward_m: number; lateral_m: number } {
  const { forward_m, lateral_m } = distanceToStopAlongRoute(
    coords,
    stopPosition,
    distanceAlongM
  )
  const minutes = Math.max(0, Math.round(forward_m / speedMps / 60))
  const distStability = Math.exp(-forward_m / 2800)
  const timePenalty = Math.min(18, minutes * 0.55)
  const confidence_pct = Math.round(
    Math.min(96, Math.max(52, 58 + 38 * distStability - timePenalty))
  )
  return { eta_minutes: minutes, confidence_pct, forward_m, lateral_m }
}

/**
 * Full fleet snapshot at `nowMs` — single source for map + /api/eta.
 */
export function computeVehicleStates(
  transit: TransitContextDTO,
  nowMs: number,
  dbBuses: DbBusLite[]
): VehicleRuntimeState[] {
  const busesByRoute = new Map<string, DbBusLite[]>()
  for (const b of dbBuses) {
    if (!b.current_route_id) continue
    const list = busesByRoute.get(b.current_route_id) ?? []
    list.push(b)
    busesByRoute.set(b.current_route_id, list)
  }

  const out: VehicleRuntimeState[] = []

  for (const route of transit.routes) {
    const coords: LatLng[] = route.coordinates.map(([lat, lng]) => ({
      lat,
      lng,
    }))
    if (coords.length < 2) continue

    const cum = cumulativeLengthsMeters(coords)
    const totalLen = cum[cum.length - 1] || 1
    const onRoute = busesByRoute.get(route.id) ?? []
    const unitIds =
      onRoute.length > 0
        ? onRoute.map((b) => b.id)
        : [`sim:${route.id}:a`, `sim:${route.id}:b`]

    for (const id of unitIds) {
      const speed_mps = effectiveSpeedMps(id, nowMs)
      const distance_along_m = distanceAlongAtTime(totalLen, id, nowMs)
      const pos = pointAlongPolyline(coords, distance_along_m)

      out.push({
        id,
        route_id: route.id,
        route_number: route.route_number,
        route_name: route.route_name,
        route_color: route.color,
        lat: pos.lat,
        lng: pos.lng,
        heading_deg: pos.heading_deg,
        distance_along_m,
        route_total_m: totalLen,
        speed_mps,
        speed_kmh: speed_mps * 3.6,
        coordinates: coords,
      })
    }
  }

  return out
}

export function stateServesStop(
  state: VehicleRuntimeState,
  route: MapRouteDTO,
  stopId: string
): boolean {
  return route.stop_ids_ordered.includes(stopId)
}

export function buildArrivalsForStop(
  transit: TransitContextDTO,
  states: VehicleRuntimeState[],
  stopId: string,
  stopById: Map<string, MapStopDTO>,
  serverTimeMs: number,
  includeDebug = false
): EtaArrivalDTO[] {
  const stop = stopById.get(stopId)
  if (!stop) return []

  const routeById = new Map(transit.routes.map((r) => [r.id, r]))
  const arrivals: EtaArrivalDTO[] = []

  for (const state of states) {
    const route = routeById.get(state.route_id)
    if (!route || !stateServesStop(state, route, stopId)) continue

    const eta = etaMinutesAndConfidence(
      state.coordinates,
      state.distance_along_m,
      state.speed_mps,
      { lat: stop.lat, lng: stop.lng }
    )

    // Wrap-around guard for loop routes:
    // after passing the stop we temporarily drop this vehicle instead of
    // showing "next full loop ETA" as the immediate arrival.
    const likelyJustPassed =
      eta.forward_m > state.route_total_m * 0.85 && eta.lateral_m < 45
    if (likelyJustPassed) continue

    // Kiosk/display horizon: hide very far next-loop arrivals.
    if (eta.eta_minutes > 35) continue

    const predicted = new Date(serverTimeMs + eta.eta_minutes * 60_000)

    arrivals.push({
      vehicle_id: state.id,
      route_id: state.route_id,
      route_number: state.route_number,
      route_name: state.route_name,
      route_color: state.route_color,
      bus_label: formatBusLabel(state.id, state.route_number),
      eta_minutes: eta.eta_minutes,
      confidence_pct: eta.confidence_pct,
      predicted_arrival_iso: predicted.toISOString(),
      debug: includeDebug
        ? {
            route_id: state.route_id,
            stop_id: stopId,
            distance_along_m: Math.round(state.distance_along_m),
            speed_mps: Number(state.speed_mps.toFixed(2)),
            forward_m: Math.round(eta.forward_m),
          }
        : undefined,
    })
  }

  arrivals.sort((a, b) => a.eta_minutes - b.eta_minutes)
  return arrivals
}

function formatBusLabel(vehicleId: string, routeNumber: string): string {
  const h = strSeed(vehicleId) % 900 + 100
  return `B${routeNumber}-${h}`
}
