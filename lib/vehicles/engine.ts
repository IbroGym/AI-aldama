/**
 * Unified time-based transit simulation (stateless, deterministic).
 * Replace computeVehicleStates + ETA helpers with GTFS-Realtime adapters later
 * without changing API DTOs.
 */
import {
  cumulativeLengthsMeters,
  closestPointAlongPolyline,
  bearingDeg,
  distanceToStopAlongRoute,
  pointAlongPolyline,
  type LatLng,
} from "./geo"
import {
  isRoute10NazarbaevDemoStopId,
  isRoute10NuInboundSideStopId,
  isRoute10NuOutboundSideStopId,
} from "./route10-nu-demo-stops"
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
  /** Metres along the active geometry polyline. */
  distance_along_m: number
  route_total_m: number
  /** Effective speed along route (m/s), time-integrated */
  speed_mps: number
  speed_kmh: number
  coordinates: LatLng[]
  // Route 10 demo: direction-aware two-phase movement.
  direction?: "outbound" | "inbound"
  terminal_pause_until_ms?: number | null
}

type VehicleTrackState = {
  last_now_ms: number
  last_distance_along_m: number
  direction?: "outbound" | "inbound"
  terminal_pause_until_ms?: number | null
}

const vehicleTrackByKey = new Map<string, VehicleTrackState>()
const MAX_INTEGRATION_DT_S = 6
const JUMP_WARN_METERS = 250
const ROUTE10_TERMINAL_DWELL_MS = 25_000

export function strSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i)
  return Math.abs(h)
}

export function routesServingStop(
  routes: MapRouteDTO[],
  stopId: string
): MapRouteDTO[] {
  return routes.filter((r) => {
    if (r.route_number === "10" && isRoute10NazarbaevDemoStopId(stopId)) {
      return true
    }
    return r.stop_ids_ordered.includes(stopId)
  })
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

function distanceToStopAlongRouteNoWrap(
  coords: LatLng[],
  stopPosition: LatLng,
  vehicleDistanceAlong: number
): { forward_m: number; stop_distance_along_m: number; lateral_m: number } {
  if (coords.length < 2) {
    return { forward_m: Infinity, stop_distance_along_m: 0, lateral_m: Infinity }
  }
  const { along_m: stopAlong, lateral_m } = closestPointAlongPolyline(
    coords,
    stopPosition
  )
  const forward = stopAlong - vehicleDistanceAlong
  return {
    forward_m: forward < 0 ? Infinity : forward,
    stop_distance_along_m: stopAlong,
    lateral_m,
  }
}

export function etaMinutesAndConfidenceNoWrap(
  coords: LatLng[],
  distanceAlongM: number,
  speedMps: number,
  stopPosition: LatLng
): { eta_minutes: number; confidence_pct: number; forward_m: number; lateral_m: number } {
  if (speedMps <= 0) {
    return { eta_minutes: 999, confidence_pct: 0, forward_m: Infinity, lateral_m: Infinity }
  }
  const { forward_m, lateral_m } = distanceToStopAlongRouteNoWrap(
    coords,
    stopPosition,
    distanceAlongM
  )
  if (!Number.isFinite(forward_m) || !Number.isFinite(lateral_m)) {
    return { eta_minutes: 999, confidence_pct: 0, forward_m, lateral_m }
  }
  const minutes = Math.max(0, Math.round(forward_m / speedMps / 60))
  const distStability = Math.exp(-forward_m / 2800)
  const timePenalty = Math.min(18, minutes * 0.55)
  const confidence_pct = Math.round(
    Math.min(96, Math.max(52, 58 + 38 * distStability - timePenalty))
  )
  return { eta_minutes: minutes, confidence_pct, forward_m, lateral_m }
}

function pointAlongOpenPolyline(
  coords: LatLng[],
  distanceMeters: number
): { lat: number; lng: number; heading_deg: number } {
  if (coords.length === 0) return { lat: 0, lng: 0, heading_deg: 0 }
  if (coords.length === 1) {
    return { lat: coords[0].lat, lng: coords[0].lng, heading_deg: 0 }
  }
  const cum = cumulativeLengthsMeters(coords)
  const total = cum[cum.length - 1] || 1
  const d = Math.max(0, Math.min(distanceMeters, total))

  if (d <= 0) {
    const a = coords[0]
    const b = coords[1]
    return { lat: a.lat, lng: a.lng, heading_deg: bearingDeg(a, b) }
  }
  if (d >= total) {
    const a = coords[coords.length - 2]
    const b = coords[coords.length - 1]
    return { lat: b.lat, lng: b.lng, heading_deg: bearingDeg(a, b) }
  }

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
 * Full fleet snapshot at `nowMs` — single source for map + /api/eta.
 */
export function computeVehicleStates(
  transit: TransitContextDTO,
  nowMs: number,
  dbBuses: DbBusLite[],
  simulationSpeedMultiplier = 1,
): VehicleRuntimeState[] {
  const busesByRoute = new Map<string, DbBusLite[]>()
  for (const b of dbBuses) {
    if (!b.current_route_id) continue
    const list = busesByRoute.get(b.current_route_id) ?? []
    list.push(b)
    busesByRoute.set(b.current_route_id, list)
  }

  const out: VehicleRuntimeState[] = []

  const seenKeys = new Set<string>()

  for (const route of transit.routes) {
    if (route.route_number === "10") {
      const outboundCoords: LatLng[] = (
        route.coordinates_by_direction?.outbound ?? route.coordinates
      ).map(([lat, lng]) => ({ lat, lng }))
      const inboundCoords: LatLng[] = (
        route.coordinates_by_direction?.inbound ?? route.coordinates
      ).map(([lat, lng]) => ({ lat, lng }))

      if (outboundCoords.length < 2 || inboundCoords.length < 2) continue

      const outCum = cumulativeLengthsMeters(outboundCoords)
      const inCum = cumulativeLengthsMeters(inboundCoords)
      const outTotalLen = outCum[outCum.length - 1] || 1
      const inTotalLen = inCum[inCum.length - 1] || 1

      const onRoute = busesByRoute.get(route.id) ?? []
      const unitIds =
        onRoute.length > 0 ? onRoute.map((b) => b.id) : [`sim:${route.id}:a`, `sim:${route.id}:b`]

      for (const id of unitIds) {
        const trackKey = `${route.id}::${id}`
        seenKeys.add(trackKey)

        const previous = vehicleTrackByKey.get(trackKey)
        const seed = strSeed(id)
        const baseSpeed = baseSpeedMps(id)

        let direction: "outbound" | "inbound" = previous?.direction ?? "outbound"
        let terminal_pause_until_ms: number | null =
          previous?.terminal_pause_until_ms ?? null
        let distance_along_m = previous?.last_distance_along_m ?? 0

        const outTravel_s = outTotalLen / Math.max(0.1, baseSpeed)
        const inTravel_s = inTotalLen / Math.max(0.1, baseSpeed)
        const dwell_s = ROUTE10_TERMINAL_DWELL_MS / 1000
        const cycle_s = outTravel_s + inTravel_s + 2 * dwell_s

        if (!previous) {
          const phaseOffset_s = ((seed % 10_000) / 10_000) * cycle_s
            const t = (((nowMs / 1000) * simulationSpeedMultiplier + phaseOffset_s) % cycle_s) as number

          if (t < outTravel_s) {
            direction = "outbound"
            distance_along_m = (t / outTravel_s) * outTotalLen
            terminal_pause_until_ms = null
          } else if (t < outTravel_s + dwell_s) {
            direction = "outbound"
            distance_along_m = outTotalLen
            const remaining = outTravel_s + dwell_s - t
            terminal_pause_until_ms = nowMs + remaining * 1000
          } else if (t < outTravel_s + dwell_s + inTravel_s) {
            direction = "inbound"
            const tIn = t - outTravel_s - dwell_s
            distance_along_m = (tIn / inTravel_s) * inTotalLen
            terminal_pause_until_ms = null
          } else {
            direction = "inbound"
            distance_along_m = inTotalLen
            const remaining = cycle_s - t
            terminal_pause_until_ms = nowMs + remaining * 1000
          }

          distance_along_m = Math.max(
            0,
            Math.min(
              direction === "outbound" ? outTotalLen : inTotalLen,
              distance_along_m,
            ),
          )

          vehicleTrackByKey.set(trackKey, {
            last_now_ms: nowMs,
            last_distance_along_m: distance_along_m,
            direction,
            terminal_pause_until_ms,
          })
        } else {
          // Paused at terminal: hold position until dwell time ends.
          const paused = terminal_pause_until_ms != null && nowMs < terminal_pause_until_ms
          if (paused) {
            distance_along_m = direction === "outbound" ? outTotalLen : inTotalLen
          } else if (terminal_pause_until_ms != null && nowMs >= terminal_pause_until_ms) {
            const prevDirection = direction
            direction = prevDirection === "outbound" ? "inbound" : "outbound"
            terminal_pause_until_ms = null
            distance_along_m = 0
            console.info(
              `[route10-phase] vehicle_id=${id} ${prevDirection} -> ${direction}`,
            )
            // Reset time so we don't advance during this tick after a phase switch.
            vehicleTrackByKey.set(trackKey, {
              last_now_ms: nowMs,
              last_distance_along_m: distance_along_m,
              direction,
              terminal_pause_until_ms,
            })
          } else {
            const base_speed_mps = effectiveSpeedMps(id, nowMs)
            const dt_real_s = Math.max(
              0,
              Math.min(
                MAX_INTEGRATION_DT_S,
                (nowMs - previous.last_now_ms) / 1000,
              ),
            )
            const dt_s = dt_real_s * simulationSpeedMultiplier
            const totalLen = direction === "outbound" ? outTotalLen : inTotalLen
            const rawDistance = previous.last_distance_along_m + base_speed_mps * dt_s
            distance_along_m = Math.max(0, Math.min(totalLen, rawDistance))

            if (distance_along_m >= totalLen) {
              terminal_pause_until_ms =
                nowMs + ROUTE10_TERMINAL_DWELL_MS / simulationSpeedMultiplier
              distance_along_m = totalLen
            }

            vehicleTrackByKey.set(trackKey, {
              last_now_ms: nowMs,
              last_distance_along_m: distance_along_m,
              direction,
              terminal_pause_until_ms,
            })
          }
        }

        const pausedNow = terminal_pause_until_ms != null && nowMs < terminal_pause_until_ms
        const speed_mps = pausedNow
          ? 0
          : effectiveSpeedMps(id, nowMs) * simulationSpeedMultiplier

        const activeCoords = direction === "outbound" ? outboundCoords : inboundCoords
        const totalLen = direction === "outbound" ? outTotalLen : inTotalLen
        distance_along_m = Math.max(0, Math.min(totalLen, distance_along_m))

        const pos = pointAlongOpenPolyline(activeCoords, distance_along_m)

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
          coordinates: activeCoords,
          direction,
          terminal_pause_until_ms,
        })
      }

      continue
    }

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
      const trackKey = `${route.id}::${id}`
      seenKeys.add(trackKey)
      const speed_mps = effectiveSpeedMps(id, nowMs) * simulationSpeedMultiplier
      const base_speed_mps = speed_mps / simulationSpeedMultiplier
      const previous = vehicleTrackByKey.get(trackKey)
      const seededDistance = distanceAlongAtTime(
        totalLen,
        id,
        nowMs * simulationSpeedMultiplier,
      )
      let distance_along_m = seededDistance
      let previousDistance = seededDistance

      if (previous) {
        previousDistance = previous.last_distance_along_m
        const dt_real_s = Math.max(
          0,
          Math.min(MAX_INTEGRATION_DT_S, (nowMs - previous.last_now_ms) / 1000)
        )
        const dt_s = dt_real_s * simulationSpeedMultiplier
        const rawDistance = previous.last_distance_along_m + base_speed_mps * dt_s
        distance_along_m = rawDistance % totalLen
        if (distance_along_m < 0) distance_along_m += totalLen
      }

      vehicleTrackByKey.set(trackKey, {
        last_now_ms: nowMs,
        last_distance_along_m: distance_along_m,
      })

      const expectedDelta =
        previous != null
          ? base_speed_mps *
            Math.max(
              0,
              Math.min(MAX_INTEGRATION_DT_S, (nowMs - previous.last_now_ms) / 1000) *
                simulationSpeedMultiplier
            )
          : 0
      const actualDelta =
        previous != null
          ? forwardDistanceDelta(
              previous.last_distance_along_m,
              distance_along_m,
              totalLen
            )
          : 0
      if (previous != null) {
        console.debug(
          `[vehicle-motion] vehicle_id=${id} prev_distance_along_m=${previousDistance.toFixed(1)} new_distance_along_m=${distance_along_m.toFixed(1)}`
        )
      }
      if (previous != null && Math.abs(actualDelta - expectedDelta) > JUMP_WARN_METERS) {
        console.warn(
          `[vehicle-motion] jump-detected vehicle_id=${id} route_id=${route.id} prev_distance_along_m=${previous.last_distance_along_m.toFixed(1)} new_distance_along_m=${distance_along_m.toFixed(1)} expected_delta_m=${expectedDelta.toFixed(1)} actual_delta_m=${actualDelta.toFixed(1)}`
        )
      }

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

  for (const key of vehicleTrackByKey.keys()) {
    if (!seenKeys.has(key)) {
      vehicleTrackByKey.delete(key)
    }
  }

  return out
}

function forwardDistanceDelta(prev: number, next: number, total: number): number {
  let delta = next - prev
  if (delta < 0) delta += total
  return delta
}

export function stateServesStop(
  transit: TransitContextDTO,
  state: VehicleRuntimeState,
  route: MapRouteDTO,
  stopId: string
): boolean {
  if (route.route_number !== "10") {
    return route.stop_ids_ordered.includes(stopId)
  }

  if (isRoute10NuInboundSideStopId(stopId)) {
    return (state.direction ?? "outbound") === "inbound"
  }
  if (isRoute10NuOutboundSideStopId(stopId)) {
    return (state.direction ?? "outbound") === "outbound"
  }

  const dbg = transit.route_direction_debug?.find(
    (d) => d.route_id === state.route_id,
  )
  const dir = state.direction ?? "outbound"
  const ids =
    dir === "outbound" ? dbg?.outbound_stop_ids : dbg?.inbound_stop_ids
  if (ids && ids.length) return ids.includes(stopId)
  return route.stop_ids_ordered.includes(stopId)
}

export function buildArrivalsForStop(
  transit: TransitContextDTO,
  states: VehicleRuntimeState[],
  stopId: string,
  stopById: Map<string, MapStopDTO>,
  serverTimeMs: number,
  includeDebug = false,
  enableTraceLogs = false
): EtaArrivalDTO[] {
  const stop = stopById.get(stopId)
  if (!stop) return []

  const routeById = new Map(transit.routes.map((r) => [r.id, r]))
  const arrivals: EtaArrivalDTO[] = []

  const trace = (message: string) => {
    if (!enableTraceLogs) return
    console.info(`[eta-trace] stop_id=${stopId} ${message}`)
  }

  trace(`candidates_total=${states.length}`)

  for (const state of states) {
    const route = routeById.get(state.route_id)
    if (!route) {
      trace(`vehicle_id=${state.id} excluded=missing_route route_id=${state.route_id}`)
      continue
    }

    const servesStop = stateServesStop(transit, state, route, stopId)
    if (!servesStop) {
      trace(
        `vehicle_id=${state.id} route_id=${state.route_id} route_number=${state.route_number} direction=${state.direction ?? "n/a"} distance_along_m=${Math.round(state.distance_along_m)} excluded=missing_stop_match`,
      )
      continue
    }

    if (route.route_number === "10") {
      const paused =
        state.terminal_pause_until_ms != null &&
        serverTimeMs < state.terminal_pause_until_ms
      if (paused) {
        trace(
          `vehicle_id=${state.id} route_id=${state.route_id} route_number=10 direction=${state.direction ?? "n/a"} distance_along_m=${Math.round(state.distance_along_m)} excluded=terminal_dwell`,
        )
        continue
      }
    }

    const eta =
      route.route_number === "10"
        ? etaMinutesAndConfidenceNoWrap(
            state.coordinates,
            state.distance_along_m,
            state.speed_mps,
            { lat: stop.lat, lng: stop.lng },
          )
        : etaMinutesAndConfidence(
            state.coordinates,
            state.distance_along_m,
            state.speed_mps,
            { lat: stop.lat, lng: stop.lng },
          )

    if (route.route_number !== "10") {
      // Wrap-around guard for loop routes:
      // after passing the stop we temporarily drop this vehicle instead of
      // showing "next full loop ETA" as the immediate arrival.
      const likelyJustPassed =
        eta.forward_m > state.route_total_m * 0.85 && eta.lateral_m < 45
      if (likelyJustPassed) {
        trace(
          `vehicle_id=${state.id} route_id=${state.route_id} route_number=${state.route_number} direction=${state.direction ?? "n/a"} distance_along_m=${Math.round(state.distance_along_m)} excluded=no_wrap_filter forward_m=${Math.round(eta.forward_m)} lateral_m=${Math.round(eta.lateral_m)}`,
        )
        continue
      }
    } else if (!Number.isFinite(eta.forward_m)) {
      trace(
        `vehicle_id=${state.id} route_id=${state.route_id} route_number=10 direction=${state.direction ?? "n/a"} distance_along_m=${Math.round(state.distance_along_m)} excluded=stop_behind_vehicle`,
      )
      continue
    }

    // Kiosk/display horizon: hide very far next-loop arrivals.
    if (eta.eta_minutes > 35) {
      trace(
        `vehicle_id=${state.id} route_id=${state.route_id} route_number=${state.route_number} direction=${state.direction ?? "n/a"} distance_along_m=${Math.round(state.distance_along_m)} excluded=too_far_horizon eta_minutes=${eta.eta_minutes}`,
      )
      continue
    }

    const predicted = new Date(serverTimeMs + eta.eta_minutes * 60_000)
    trace(
      `vehicle_id=${state.id} route_id=${state.route_id} route_number=${state.route_number} direction=${state.direction ?? "n/a"} distance_along_m=${Math.round(state.distance_along_m)} included eta_minutes=${eta.eta_minutes} confidence_pct=${eta.confidence_pct}`,
    )

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
  trace(`arrivals_total=${arrivals.length}`)
  return arrivals
}

function formatBusLabel(vehicleId: string, routeNumber: string): string {
  const h = strSeed(vehicleId) % 900 + 100
  return `B${routeNumber}-${h}`
}
