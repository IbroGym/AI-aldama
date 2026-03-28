import {
  cumulativeLengthsMeters,
  distanceToStopAlongRoute,
  pointAlongPolyline,
  type LatLng,
} from "./geo"
import type { MapRouteDTO, MapStopDTO, TransitContextDTO, VehicleDTO } from "./types"

export interface DbBusLite {
  id: string
  current_route_id: string | null
}

function strSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i)
  return Math.abs(h)
}

function routesServingStop(
  routes: MapRouteDTO[],
  stopId: string
): MapRouteDTO[] {
  return routes.filter((r) => r.stop_ids_ordered.includes(stopId))
}

/**
 * Deterministic vehicle positions (serverless-safe). Replace internals with
 * GTFS-RT positions when a feed is wired in.
 */
export function simulateVehicles(
  transit: TransitContextDTO,
  nowMs: number,
  dbBuses: DbBusLite[],
  options: { focus_stop_id?: string | null; filter_stop_only?: boolean }
): { vehicles: VehicleDTO[]; highlighted_route_ids: string[] } {
  const focusStopId = options.focus_stop_id ?? null
  const filterStopOnly = options.filter_stop_only ?? false

  const stopById = new Map(transit.stops.map((s) => [s.id, s]))
  const highlighted_route_ids = focusStopId
    ? routesServingStop(transit.routes, focusStopId).map((r) => r.id)
    : []

  const routesToUse =
    filterStopOnly && focusStopId
      ? routesServingStop(transit.routes, focusStopId)
      : transit.routes

  const busesByRoute = new Map<string, DbBusLite[]>()
  for (const b of dbBuses) {
    if (!b.current_route_id) continue
    const list = busesByRoute.get(b.current_route_id) ?? []
    list.push(b)
    busesByRoute.set(b.current_route_id, list)
  }

  const vehicles: VehicleDTO[] = []

  for (const route of routesToUse) {
    const coords: LatLng[] = route.coordinates.map(([lat, lng]) => ({
      lat,
      lng,
    }))
    if (coords.length < 2) continue

    const cum = cumulativeLengthsMeters(coords)
    const totalLen = cum[cum.length - 1] || 1
    const cycleMs = 200_000 + strSeed(route.id) % 80_000
    const onRoute = busesByRoute.get(route.id) ?? []
    const unitIds =
      onRoute.length > 0
        ? onRoute.map((b) => b.id)
        : [`sim:${route.id}:a`, `sim:${route.id}:b`]

    const focusStop: MapStopDTO | undefined = focusStopId
      ? stopById.get(focusStopId)
      : undefined
    const focusOnThisRoute =
      !!focusStopId && route.stop_ids_ordered.includes(focusStopId)

    for (let i = 0; i < unitIds.length; i++) {
      const id = unitIds[i]
      const seed = strSeed(id)
      const phase = ((nowMs + seed * 997) % cycleMs) / cycleMs
      const distanceAlong = phase * totalLen
      const pos = pointAlongPolyline(coords, distanceAlong)
      const speedKmh = 22 + (seed % 12)

      let eta_minutes: number | undefined
      let eta_confidence_pct: number | undefined
      if (focusStop && focusOnThisRoute) {
        const { forward_m } = distanceToStopAlongRoute(
          coords,
          { lat: focusStop.lat, lng: focusStop.lng },
          distanceAlong
        )
        const mps = (speedKmh / 3.6) * 0.85
        const minutes = Math.max(1, Math.round(forward_m / mps / 60))
        eta_minutes = minutes
        eta_confidence_pct = Math.round(
          Math.min(96, Math.max(62, 94 - minutes * 1.2))
        )
      }

      vehicles.push({
        id,
        route_id: route.id,
        route_number: route.route_number,
        route_name: route.route_name,
        route_color: route.color,
        lat: pos.lat,
        lng: pos.lng,
        heading_deg: pos.heading_deg,
        speed_kmh: speedKmh,
        eta_minutes,
        eta_confidence_pct,
      })
    }
  }

  return { vehicles, highlighted_route_ids }
}
