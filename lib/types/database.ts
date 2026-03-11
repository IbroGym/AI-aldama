export interface BusStop {
  id: string
  stop_code: string
  name: string
  latitude: number
  longitude: number
  address: string | null
  zone: string | null
  is_active: boolean
  has_shelter: boolean
  has_display: boolean
  created_at: string
  updated_at: string
}

export interface BusRoute {
  id: string
  route_number: string
  route_name: string
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Bus {
  id: string
  bus_number: string
  license_plate: string
  capacity: number
  is_active: boolean
  current_route_id: string | null
  created_at: string
  updated_at: string
  current_route?: BusRoute
}

export interface BusPosition {
  id: string
  bus_id: string
  latitude: number
  longitude: number
  speed: number | null
  heading: number | null
  recorded_at: string
  bus?: Bus
}

export interface EtaPrediction {
  id: string
  bus_id: string
  stop_id: string
  route_id: string
  predicted_arrival: string
  confidence: number
  created_at: string
  updated_at: string
  bus?: Bus
  stop?: BusStop
  route?: BusRoute
}

export interface AiQueryLog {
  id: string
  stop_id: string | null
  question: string
  answer: string | null
  intent: string | null
  confidence: number | null
  response_time_ms: number | null
  was_successful: boolean
  created_at: string
  stop?: BusStop
}

export interface SystemMetric {
  id: string
  metric_name: string
  metric_value: number
  metric_unit: string
  tags: Record<string, string> | null
  recorded_at: string
}

export interface Schedule {
  id: string
  route_id: string
  day_of_week: number
  departure_time: string
  is_active: boolean
  route?: BusRoute
}

export interface Alert {
  id: string
  alert_type: 'delay' | 'cancellation' | 'reroute' | 'maintenance' | 'info'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  affected_routes: string[] | null
  affected_stops: string[] | null
  is_active: boolean
  starts_at: string
  ends_at: string | null
  created_at: string
}

export interface RouteStop {
  id: string
  route_id: string
  stop_id: string
  stop_sequence: number
  scheduled_time_offset: number
  route?: BusRoute
  stop?: BusStop
}

export interface DashboardStats {
  totalBuses: number
  activeBuses: number
  totalStops: number
  activeAlerts: number
  avgResponseTime: number
  todayQueries: number
}
