import {
  etaMinutesAndConfidence,
  routesServingStop,
  type VehicleRuntimeState,
} from "./engine"
import type { MapStopDTO, TransitContextDTO, VehicleDTO } from "./types"

/**
 * Map + vehicles API: DTOs from a precomputed snapshot (same snapshot as /api/eta).
 */
export function vehiclesDtoFromStates(
  transit: TransitContextDTO,
  states: VehicleRuntimeState[],
  options: {
    focus_stop_id?: string | null
    filter_stop_only?: boolean
    include_debug?: boolean
  }
): { vehicles: VehicleDTO[]; highlighted_route_ids: string[] } {
  const focusStopId = options.focus_stop_id ?? null
  const filterStopOnly = options.filter_stop_only ?? false
  const includeDebug = options.include_debug ?? false

  const stopById = new Map(transit.stops.map((s) => [s.id, s]))
  const highlighted_route_ids = focusStopId
    ? routesServingStop(transit.routes, focusStopId).map((r) => r.id)
    : []

  let filtered = states

  if (filterStopOnly && focusStopId) {
    const serving = new Set(
      routesServingStop(transit.routes, focusStopId).map((r) => r.id)
    )
    filtered = states.filter((s) => serving.has(s.route_id))
  }

  const focusStop: MapStopDTO | undefined = focusStopId
    ? stopById.get(focusStopId)
    : undefined

  const vehicles: VehicleDTO[] = filtered.map((state) => {
    const route = transit.routes.find((r) => r.id === state.route_id)
    const servesFocus =
      !!focusStop &&
      !!route &&
      route.stop_ids_ordered.includes(focusStopId!)

    let eta_minutes: number | undefined
    let eta_confidence_pct: number | undefined

    if (focusStop && servesFocus) {
      const e = etaMinutesAndConfidence(
        state.coordinates,
        state.distance_along_m,
        state.speed_mps,
        { lat: focusStop.lat, lng: focusStop.lng }
      )
      const likelyJustPassed =
        e.forward_m > state.route_total_m * 0.85 && e.lateral_m < 45
      if (!likelyJustPassed && e.eta_minutes <= 35) {
        eta_minutes = e.eta_minutes
        eta_confidence_pct = e.confidence_pct
      }
    }

    return {
      id: state.id,
      route_id: state.route_id,
      route_number: state.route_number,
      route_name: state.route_name,
      route_color: state.route_color,
      lat: state.lat,
      lng: state.lng,
      heading_deg: state.heading_deg,
      speed_kmh: state.speed_kmh,
      eta_minutes,
      eta_confidence_pct,
      debug: includeDebug
        ? {
            distance_along_m: Math.round(state.distance_along_m),
            speed_mps: Number(state.speed_mps.toFixed(2)),
            stop_id_for_eta: focusStopId ?? undefined,
          }
        : undefined,
    }
  })

  return { vehicles, highlighted_route_ids }
}

export type { DbBusLite } from "./engine"
export { buildArrivalsForStop, computeVehicleStates } from "./engine"
