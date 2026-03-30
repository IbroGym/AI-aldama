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
  stop_ids_ordered: string[]
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
  data_source: "simulated" | "gtfs_rt" | "database"
  transit_data_source: "supabase" | "mock"
}
