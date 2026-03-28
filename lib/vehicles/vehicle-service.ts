import type { SupabaseClient } from "@supabase/supabase-js"
import { ASTANA_CENTER, getMockAstanaTransit } from "./mock-astana"
import { simulateVehicles, type DbBusLite } from "./simulation"
import type { MapRouteDTO, MapStopDTO, TransitContextDTO, VehicleDTO } from "./types"

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

  if (!routesData?.length || !stopsData?.length) {
    return null
  }

  const stops: MapStopDTO[] = (stopsData as StopRow[]).map((s) => ({
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

  const routes: MapRouteDTO[] = []
  for (const r of routesData as RouteRow[]) {
    const seq = (byRoute.get(r.id) ?? []).sort(
      (a, b) => a.stop_sequence - b.stop_sequence
    )
    const orderedStops: MapStopDTO[] = []
    for (const row of seq) {
      const sid = row.stop_id
      const fromJoin = pickStopJoin(row.stop)
      const s = fromJoin
        ? {
            id: fromJoin.id,
            stop_code: fromJoin.stop_code,
            name: fromJoin.name,
            lat: fromJoin.latitude,
            lng: fromJoin.longitude,
          }
        : stopMap.get(sid)
      if (s) orderedStops.push(s)
    }
    if (orderedStops.length < 2) continue

    const coordinates: [number, number][] = orderedStops.map((s) => [
      s.lat,
      s.lng,
    ])
    coordinates.push([orderedStops[0].lat, orderedStops[0].lng])

    routes.push({
      id: r.id,
      route_number: r.route_number,
      route_name: r.route_name,
      color: r.color || "#3b82f6",
      coordinates,
      stop_ids_ordered: orderedStops.map((s) => s.id),
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

export interface VehiclesResponsePayload {
  vehicles: VehicleDTO[]
  highlighted_route_ids: string[]
  focus_stop_id: string | null
  filter_stop_only: boolean
  vehicle_data_source: "simulated" | "gtfs_rt" | "database"
  server_time_ms: number
}

export async function getVehiclesPayload(
  supabase: SupabaseClient | null,
  params: {
    focus_stop_id?: string | null
    filter_stop_only?: boolean
  }
): Promise<VehiclesResponsePayload> {
  const transit = await getTransitContext(supabase)
  const dbBuses = supabase ? await loadDbBuses(supabase) : []
  const now = Date.now()
  const { vehicles, highlighted_route_ids } = simulateVehicles(
    transit,
    now,
    dbBuses,
    {
      focus_stop_id: params.focus_stop_id ?? null,
      filter_stop_only: params.filter_stop_only ?? false,
    }
  )

  return {
    vehicles,
    highlighted_route_ids,
    focus_stop_id: params.focus_stop_id ?? null,
    filter_stop_only: params.filter_stop_only ?? false,
    vehicle_data_source: "simulated",
    server_time_ms: now,
  }
}

export { ASTANA_CENTER }
