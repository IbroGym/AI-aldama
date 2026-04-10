import type { SupabaseClient } from "@supabase/supabase-js"
import { ASTANA_CENTER, getMockAstanaTransit } from "./mock-astana"
import {
  ROUTE_10_INBOUND_STOP_IDS,
  ROUTE_10_OUTBOUND_STOP_IDS,
  ROUTE_12_INBOUND_STOP_IDS,
  ROUTE_12_OUTBOUND_STOP_IDS,
  ROUTE_46_INBOUND_STOP_IDS,
  ROUTE_46_OUTBOUND_STOP_IDS,
  normalizeStopCodeForLookup,
  resolveRouteOrderOverrides,
} from "./route-overrides"
import { getRouteShapeOverride } from "./route-shape-overrides"
import {
  ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID,
  ROUTE_10_NU_INBOUND_SIDE_STOP_CODE,
  ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID,
  ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID,
} from "./route10-nu-demo-stops"
import {
  buildArrivalsForStop,
  computeVehicleStates,
  type DbBusLite,
} from "./engine"
import { getSimulationClockSnapshot } from "./sim-clock"
import { vehiclesDtoFromStates } from "./simulation"
import type { EtaResponsePayload, TransitContextDTO, VehicleDTO } from "./types"

type StopJoin = {
  id: string
  stop_code: string
  name: string
  latitude: number
  longitude: number
}

type RouteStopRow = {
  route_id: string
  stop_id: string
  stop_sequence: number
  stop: StopJoin | StopJoin[] | null
}

function pickStopJoin(stop: RouteStopRow["stop"]): StopJoin | null {
  if (!stop) return null
  const s = Array.isArray(stop) ? stop[0] : stop
  if (!s || s.latitude == null || s.longitude == null) return null
  return s
}

type RouteRow = {
  id: string
  route_number: string
  route_name: string
  color: string
}

type StopRow = {
  id: string
  stop_code: string
  name: string
  latitude: number
  longitude: number
}

type BusRow = {
  id: string
  current_route_id: string | null
  is_active: boolean
}

function buildRoute10DebugOverrideManifest(stops: StopRow[]) {
  const byNorm = new Map<string, StopRow[]>()
  const byId = new Map(stops.map((s) => [s.id, s]))
  for (const s of stops) {
    const k = normalizeStopCodeForLookup(s.stop_code)
    const list = byNorm.get(k) ?? []
    list.push(s)
    byNorm.set(k, list)
  }
  const entry = (override_stop_code: string) => {
    const list = byNorm.get(normalizeStopCodeForLookup(override_stop_code)) ?? []
    const first = list[0]
    return {
      override_stop_code,
      matched_by_stop_code: !!first,
      resolved_id: first?.id ?? null,
      resolved_stop_code: first?.stop_code ?? null,
      resolved_name: first?.name ?? null,
    }
  }
  const entryByStopId = (stopId: string) => {
    const row = byId.get(stopId)
    return {
      override_stop_code: stopId,
      matched_by_stop_code: !!row,
      resolved_id: row?.id ?? null,
      resolved_stop_code: row?.stop_code ?? null,
      resolved_name: row?.name ?? null,
    }
  }
  return {
    outbound_entries: ROUTE_10_OUTBOUND_STOP_IDS.map(entryByStopId),
    inbound_entries: ROUTE_10_INBOUND_STOP_IDS.map(entryByStopId),
  }
}

export async function loadTransitFromSupabase(
  supabase: SupabaseClient
): Promise<TransitContextDTO | null> {
  const [{ data: routesData }, { data: stopsData }, { data: rsData }] =
    await Promise.all([
      supabase
        .from("bus_routes")
        .select("id, route_number, route_name, color")
        .eq("is_active", true),
      supabase
        .from("bus_stops")
        .select("id, stop_code, name, latitude, longitude")
        .eq("is_active", true),
      supabase
        .from("route_stops")
        .select(
          "route_id, stop_id, stop_sequence, stop:bus_stops(id, stop_code, name, latitude, longitude)"
        )
        .order("stop_sequence"),
    ])

  const activeStops = (stopsData ?? []) as StopRow[]
  const activeNormCodes = new Set(
    activeStops.map((s) => normalizeStopCodeForLookup(s.stop_code))
  )
  const activeStopIds = new Set(activeStops.map((s) => s.id))
  const missingRoute10OutboundIds = ROUTE_10_OUTBOUND_STOP_IDS.filter(
    (id) => !activeStopIds.has(id)
  )
  const missingRoute10InboundIds = ROUTE_10_INBOUND_STOP_IDS.filter(
    (id) => !activeStopIds.has(id)
  )
  const route12ReferencedStopIds = Array.from(
    new Set([...ROUTE_12_OUTBOUND_STOP_IDS, ...ROUTE_12_INBOUND_STOP_IDS]),
  )
  const missingRoute12StopIds = route12ReferencedStopIds.filter(
    (id) => !activeStopIds.has(id),
  )
  const route46ReferencedStopIds = Array.from(
    new Set([...ROUTE_46_OUTBOUND_STOP_IDS, ...ROUTE_46_INBOUND_STOP_IDS]),
  )
  const missingRoute46StopIds = route46ReferencedStopIds.filter(
    (id) => !activeStopIds.has(id),
  )
  const missingReferencedStopIds = Array.from(
    new Set([...missingRoute12StopIds, ...missingRoute46StopIds]),
  )
  let route10OutboundIdStops: StopRow[] = []
  if (missingRoute10OutboundIds.length > 0) {
    const { data: outboundIdStopsData } = await supabase
      .from("bus_stops")
      .select("id, stop_code, name, latitude, longitude")
      .in("id", missingRoute10OutboundIds)
    route10OutboundIdStops = (outboundIdStopsData ?? []) as StopRow[]
  }
  let route10InboundIdStops: StopRow[] = []
  if (missingRoute10InboundIds.length > 0) {
    const { data: inboundIdStopsData } = await supabase
      .from("bus_stops")
      .select("id, stop_code, name, latitude, longitude")
      .in("id", missingRoute10InboundIds)
    route10InboundIdStops = (inboundIdStopsData ?? []) as StopRow[]
  }
  let routeReferencedIdSupplementStops: StopRow[] = []
  if (missingReferencedStopIds.length > 0) {
    const { data: referencedIdSupplementData } = await supabase
      .from("bus_stops")
      .select("id, stop_code, name, latitude, longitude")
      .in("id", missingReferencedStopIds)
    routeReferencedIdSupplementStops = (referencedIdSupplementData ??
      []) as StopRow[]
  }

  /** Both NU platforms must be in transit for opposite-side ETA; include inactive rows by stop_code. */
  let nazarbayevPairSupplementStops: StopRow[] = []
  const mergedForNuCheck = [
    ...activeStops,
    ...route10OutboundIdStops,
    ...route10InboundIdStops,
    ...routeReferencedIdSupplementStops,
  ]
  const loadedNuCodes = new Set(
    mergedForNuCheck.map((s) => normalizeStopCodeForLookup(s.stop_code)),
  )
  const nuRequiredCodes = [
    ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID,
    ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID,
    ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID,
    ROUTE_10_NU_INBOUND_SIDE_STOP_CODE,
  ]
  const missingNuByCode = nuRequiredCodes.filter(
    (c) => !loadedNuCodes.has(normalizeStopCodeForLookup(c)),
  )
  if (missingNuByCode.length > 0) {
    const { data: nuPairData } = await supabase
      .from("bus_stops")
      .select("id, stop_code, name, latitude, longitude")
      .in("stop_code", missingNuByCode)
    nazarbayevPairSupplementStops = (nuPairData ?? []) as StopRow[]
  }

  if (!routesData?.length || !stopsData?.length) {
    return null
  }

  const stopByIdForMerge = new Map<string, StopRow>()
  for (const s of [
    ...activeStops,
    ...route10OutboundIdStops,
    ...route10InboundIdStops,
    ...routeReferencedIdSupplementStops,
    ...nazarbayevPairSupplementStops,
  ]) {
    stopByIdForMerge.set(s.id, s)
  }
  const stops = Array.from(stopByIdForMerge.values()).map((s) => ({
    id: s.id,
    stop_code: s.stop_code,
    name: s.name,
    lat: s.latitude,
    lng: s.longitude,
  }))

  const stopMap = new Map(stops.map((s) => [s.id, s]))
  const byRoute = new Map<string, RouteStopRow[]>()
  for (const row of (rsData ?? []) as RouteStopRow[]) {
    const list = byRoute.get(row.route_id) ?? []
    list.push(row)
    byRoute.set(row.route_id, list)
  }

  const overrideResult = resolveRouteOrderOverrides({
    routes: routesData as RouteRow[],
    stops: stops.map((s) => ({
      id: s.id,
      name: s.name,
      stop_code: s.stop_code,
    })),
    routeStopsByRouteId: new Map(
      Array.from(byRoute.entries()).map(([routeId, rows]) => [
        routeId,
        rows.map((r) => ({ stop_id: r.stop_id, stop_sequence: r.stop_sequence })),
      ])
    ),
  })
  const diagnosticsByRouteId = new Map(
    overrideResult.diagnostics.map((d) => [d.route_id, d])
  )

  const routes: TransitContextDTO["routes"] = []
  for (const r of routesData as RouteRow[]) {
    const seq = (byRoute.get(r.id) ?? []).slice().sort(
      (a, b) => a.stop_sequence - b.stop_sequence
    )
    const dbOrderedStops: TransitContextDTO["stops"] = []
    for (const row of seq) {
      const fromJoin = pickStopJoin(row.stop)
      const s = fromJoin
        ? {
            id: fromJoin.id,
            stop_code: fromJoin.stop_code,
            name: fromJoin.name,
            lat: fromJoin.latitude,
            lng: fromJoin.longitude,
          }
        : stopMap.get(row.stop_id)
      if (s) dbOrderedStops.push(s)
    }

    const overrideIds = overrideResult.orderedStopIdsByRouteId.get(r.id)
    const orderedStops =
      overrideIds && overrideIds.length > 1
        ? overrideIds
            .map((sid) => stopMap.get(sid))
            .filter(
              (s): s is TransitContextDTO["stops"][number] => s != null
            )
        : dbOrderedStops
    const routeDiag = diagnosticsByRouteId.get(r.id)

    if (orderedStops.length < 2) continue

    const stopPolyline: [number, number][] = orderedStops.map((s) => [
      s.lat,
      s.lng,
    ])
    stopPolyline.push([orderedStops[0].lat, orderedStops[0].lng])

    const outboundOverrideShape = getRouteShapeOverride({
      route_number: r.route_number,
      direction: "outbound",
    })
    const inboundOverrideShape = getRouteShapeOverride({
      route_number: r.route_number,
      direction: "inbound",
    })

    const hasDirectionalGeometry =
      outboundOverrideShape != null || inboundOverrideShape != null

    const coordinates_by_direction: TransitContextDTO["routes"][number]["coordinates_by_direction"] =
      hasDirectionalGeometry
        ? {
            outbound: outboundOverrideShape ?? stopPolyline,
            inbound: inboundOverrideShape ?? stopPolyline,
          }
        : undefined

    const geometry_source_by_direction:
      | TransitContextDTO["routes"][number]["geometry_source_by_direction"]
      | undefined = hasDirectionalGeometry
        ? {
            outbound: outboundOverrideShape ? "shape_override" : "stop_polyline",
            inbound: inboundOverrideShape ? "shape_override" : "stop_polyline",
          }
        : undefined

    const geometry_point_count_by_direction:
      | TransitContextDTO["routes"][number]["geometry_point_count_by_direction"]
      | undefined = hasDirectionalGeometry
        ? {
            outbound: (outboundOverrideShape ?? stopPolyline).length,
            inbound: (inboundOverrideShape ?? stopPolyline).length,
          }
        : undefined

    const coordinates: [number, number][] =
      outboundOverrideShape ?? stopPolyline

    const geometry_source = outboundOverrideShape ? "shape_override" : "stop_polyline"

    routes.push({
      id: r.id,
      route_number: r.route_number,
      route_name: r.route_name,
      color:
        r.route_number === "12"
          ? "#16a34a"
          : r.route_number === "46"
            ? "#a855f7"
            : r.color || "#3b82f6",
      coordinates,
      geometry_source,
      geometry_point_count: coordinates.length,
      coordinates_by_direction,
      geometry_source_by_direction,
      geometry_point_count_by_direction,
      stop_ids_ordered: orderedStops.map((s) => s.id),
      order_source: routeDiag?.order_source ?? "db",
      direction: routeDiag?.direction,
      override_warnings: routeDiag?.warnings ?? [],
    })
  }

  if (!routes.length) {
    return null
  }

  const lats = stops.map((s) => s.lat)
  const lngs = stops.map((s) => s.lng)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }

  return {
    center,
    stops,
    routes,
    data_source: "supabase",
    route_order_diagnostics: overrideResult.diagnostics,
    route_override_resolution_report: overrideResult.resolutionReports,
    route_direction_debug: Array.from(overrideResult.directionDebugByRouteId.values()),
    bus_stops_loaded_count: stops.length,
    bus_stops_active_query_count: activeStops.length,
    bus_stops_debug_code_supplement_count:
      route10OutboundIdStops.length +
      route10InboundIdStops.length +
      routeReferencedIdSupplementStops.length +
      nazarbayevPairSupplementStops.length,
    bus_stops_load_scope:
      "Active bus_stops only (is_active=true) plus route-10 outbound/inbound id, route-12/46 referenced stop id, and NU pair supplement lookups",
    route10_debug_override_manifest: buildRoute10DebugOverrideManifest(
      Array.from(stopByIdForMerge.values())
    ),
  }
}

export async function loadDbBuses(
  supabase: SupabaseClient
): Promise<DbBusLite[]> {
  const { data } = await supabase
    .from("buses")
    .select("id, current_route_id, is_active")
    .eq("is_active", true)

  return ((data ?? []) as BusRow[])
    .filter((b) => b.current_route_id)
    .map((b) => ({ id: b.id, current_route_id: b.current_route_id }))
}

export async function getTransitContext(
  supabase: SupabaseClient | null
): Promise<TransitContextDTO> {
  if (supabase) {
    const fromDb = await loadTransitFromSupabase(supabase)
    if (fromDb) return fromDb
  }
  return getMockAstanaTransit()
}

/** One simulation tick: shared by /api/vehicles and /api/eta. */
export async function getSimulationSnapshot(supabase: SupabaseClient | null) {
  const transit = await getTransitContext(supabase)
  const dbBuses = supabase ? await loadDbBuses(supabase) : []
  const clock = getSimulationClockSnapshot()
  const server_time_ms = clock.real_now_ms
  const sim_time_ms = clock.sim_now_ms
  console.info(
    `[sim-speed] snapshot multiplier=${clock.simulation_speed_multiplier} real_now_ms=${server_time_ms} sim_now_ms=${Math.round(sim_time_ms)}`,
  )
  const states = computeVehicleStates(
    transit,
    server_time_ms,
    dbBuses,
    clock.simulation_speed_multiplier
  )
  return { transit, states, server_time_ms, sim_time_ms, simulation_speed_multiplier: clock.simulation_speed_multiplier }
}

export interface VehiclesResponsePayload {
  vehicles: VehicleDTO[]
  highlighted_route_ids: string[]
  focus_stop_id: string | null
  filter_stop_only: boolean
  vehicle_data_source: "simulated" | "gtfs_rt" | "database"
  server_time_ms: number
  sim_time_ms: number
  simulation_speed_multiplier: number
}

export async function getVehiclesPayload(
  supabase: SupabaseClient | null,
  params: {
    focus_stop_id?: string | null
    filter_stop_only?: boolean
    include_debug?: boolean
  }
): Promise<VehiclesResponsePayload> {
  const { transit, states, server_time_ms, sim_time_ms, simulation_speed_multiplier } = await getSimulationSnapshot(
    supabase
  )
  const { vehicles, highlighted_route_ids } = vehiclesDtoFromStates(
    transit,
    states,
    {
      focus_stop_id: params.focus_stop_id ?? null,
      filter_stop_only: params.filter_stop_only ?? false,
      include_debug: params.include_debug ?? false,
      server_time_ms,
    }
  )

  return {
    vehicles,
    highlighted_route_ids,
    focus_stop_id: params.focus_stop_id ?? null,
    filter_stop_only: params.filter_stop_only ?? false,
    vehicle_data_source: "simulated",
    server_time_ms,
    sim_time_ms,
    simulation_speed_multiplier,
  }
}

export async function getEtaPayload(
  supabase: SupabaseClient | null,
  stopId: string,
  includeDebug = false,
  enableTraceLogs = false
): Promise<EtaResponsePayload> {
  const { transit, states, server_time_ms, sim_time_ms, simulation_speed_multiplier } = await getSimulationSnapshot(
    supabase
  )
  const stopById = new Map(transit.stops.map((s) => [s.id, s]))
  const arrivals = buildArrivalsForStop(
    transit,
    states,
    stopId,
    stopById,
    server_time_ms,
    includeDebug,
    enableTraceLogs
  )

  return {
    stop_id: stopId,
    arrivals,
    server_time_ms,
    sim_time_ms,
    simulation_speed_multiplier,
    data_source: "simulated",
    transit_data_source: transit.data_source,
  }
}

export { ASTANA_CENTER }
