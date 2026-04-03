import {
  etaMinutesAndConfidence,
  etaMinutesAndConfidenceNoWrap,
  routesServingStop,
  stateServesStop,
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
    server_time_ms?: number
  }
): { vehicles: VehicleDTO[]; highlighted_route_ids: string[] } {
  const focusStopId = options.focus_stop_id ?? null
  const filterStopOnly = options.filter_stop_only ?? false
  const includeDebug = options.include_debug ?? false
  const serverTimeMs = options.server_time_ms ?? Date.now()

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
      stateServesStop(transit, state, route, focusStopId!)

    let eta_minutes: number | undefined
    let eta_confidence_pct: number | undefined

    if (route && focusStop && servesFocus) {
      if (state.speed_mps > 0) {
        const e =
          route.route_number === "10"
            ? etaMinutesAndConfidenceNoWrap(
                state.coordinates,
                state.distance_along_m,
                state.speed_mps,
                { lat: focusStop.lat, lng: focusStop.lng },
              )
            : etaMinutesAndConfidence(
                state.coordinates,
                state.distance_along_m,
                state.speed_mps,
                { lat: focusStop.lat, lng: focusStop.lng },
              )

        const likelyJustPassed =
          route.route_number !== "10"
            ? e.forward_m > state.route_total_m * 0.85 && e.lateral_m < 45
            : false

        if (!likelyJustPassed && e.eta_minutes <= 35) {
          eta_minutes = e.eta_minutes
          eta_confidence_pct = e.confidence_pct
        }
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
      direction: state.direction,
      terminal_pause_active:
        state.terminal_pause_until_ms != null &&
          serverTimeMs < state.terminal_pause_until_ms,
      distance_along_m: state.distance_along_m,
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
