/**
 * DTOs for map + vehicle APIs. Designed so GTFS-Realtime can replace `simulated`
 * without changing the client contract.
 */
export type VehicleDataSource = "simulated" | "gtfs_rt" | "database"

export interface MapStopDTO {
  id: string
  stop_code: string
  name: string
  lat: number
  lng: number
}

export interface MapRouteDTO {
  id: string
  route_number: string
  route_name: string
  color: string
  /** Polyline vertices [lat, lng] along the route (from ordered stops). */
  coordinates: [number, number][]
  geometry_source?: "shape_override" | "stop_polyline"
  geometry_point_count?: number
  /**
   * Optional bidirectional geometry for demo/dev rendering + direction-aware simulation.
   * When present, the UI can choose a direction-specific polyline.
   */
  coordinates_by_direction?: Partial<
    Record<"outbound" | "inbound", [number, number][]>
  >
  geometry_source_by_direction?: Partial<
    Record<"outbound" | "inbound", "shape_override" | "stop_polyline">
  >
  geometry_point_count_by_direction?: Partial<
    Record<"outbound" | "inbound", number>
  >
  stop_ids_ordered: string[]
  order_source?: "override" | "db"
  direction?: "outbound" | "inbound"
  override_warnings?: string[]
}

export interface VehicleDTO {
  id: string
  route_id: string
  route_number: string
  route_name: string
  route_color: string
  lat: number
  lng: number
  heading_deg: number
  speed_kmh: number
  /** Simulation leg (outbound/inbound) when bidirectional geometry + phase model is active. */
  direction?: "outbound" | "inbound"
  terminal_pause_active?: boolean
  distance_along_m?: number
  /** ETA to the focused stop when `focus_stop_id` was provided and this vehicle serves it. */
  eta_minutes?: number
  eta_confidence_pct?: number
  debug?: {
    distance_along_m: number
    speed_mps: number
    stop_id_for_eta?: string
  }
}

export interface TransitContextDTO {
  center: { lat: number; lng: number }
  stops: MapStopDTO[]
  routes: MapRouteDTO[]
  data_source: "supabase" | "mock"
  route_order_diagnostics?: Array<{
    route_id: string
    route_number: string
    route_name: string
    order_source: "override" | "db"
    direction?: "outbound" | "inbound"
    warnings: string[]
  }>
  route_override_resolution_report?: Array<{
    route_number: string
    direction: "outbound" | "inbound"
    route_id: string | null
    route_name: string | null
    source: "override" | "db"
    trusted_total: number
    resolved_total: number
    exact_matches: string[]
    fuzzy_matches: Array<{ trusted: string; matched: string; score: number }>
    unresolved: string[]
    warnings: string[]
  }>
  route_direction_debug?: Array<{
    route_id: string
    route_number: string
    outbound_stop_ids: string[]
    inbound_stop_ids: string[]
    source: "stop_code_override" | "name_resolved" | "db"
    warnings: string[]
  }>
  bus_stops_loaded_count?: number
  bus_stops_load_scope?: string
  bus_stops_active_query_count?: number
  bus_stops_debug_code_supplement_count?: number
  route10_debug_override_manifest?: {
    outbound_entries: Array<{
      override_stop_code: string
      matched_by_stop_code: boolean
      resolved_id: string | null
      resolved_stop_code: string | null
      resolved_name: string | null
    }>
    inbound_entries: Array<{
      override_stop_code: string
      matched_by_stop_code: boolean
      resolved_id: string | null
      resolved_stop_code: string | null
      resolved_name: string | null
    }>
  }
}

/** Sorted arrivals at a stop — same simulation as map vehicles. */
export interface EtaArrivalDTO {
  vehicle_id: string
  route_id: string
  route_number: string
  route_name: string
  route_color: string
  bus_label: string
  eta_minutes: number
  confidence_pct: number
  predicted_arrival_iso: string
  debug?: {
    route_id: string
    stop_id: string
    distance_along_m: number
    speed_mps: number
    forward_m: number
  }
}

export interface EtaResponsePayload {
  stop_id: string
  arrivals: EtaArrivalDTO[]
  server_time_ms: number
  sim_time_ms?: number
  simulation_speed_multiplier?: number
  data_source: "simulated" | "gtfs_rt" | "database"
  transit_data_source: "supabase" | "mock"
}
