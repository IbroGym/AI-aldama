/**
 * Demo-only: two Nazarbayev University platforms along Qabanbay Batyr.
 * Route 10 shape overrides place outbound geometry through the outbound-side
 * coordinates and inbound geometry through the inbound-side coordinates.
 */
export const ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID =
  "12cabd75-d75d-4b82-8364-770c7812d47f"

/** public.bus_stops.id — inbound platform (toward city / railway). */
export const ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID =
  "95ac140c-ef7f-4f0c-a78f-2915c58da204"

/** GTFS stop_id / stop_code when it matches this string (not the DB PK). */
export const ROUTE_10_NU_INBOUND_SIDE_STOP_CODE =
  "ccd5e97f-c483-4209-96d7-8d64466fdc26"

const ROUTE_10_NU_INBOUND_STOP_IDS = new Set<string>([
  ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID,
  ROUTE_10_NU_INBOUND_SIDE_STOP_CODE,
])

const ROUTE_10_NU_OUTBOUND_STOP_IDS = new Set<string>([
  ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID,
])

const ROUTE_10_NU_DEMO_STOP_IDS = new Set<string>([
  ...ROUTE_10_NU_INBOUND_STOP_IDS,
  ...ROUTE_10_NU_OUTBOUND_STOP_IDS,
])

export function isRoute10NuInboundSideStopId(stopId: string): boolean {
  return ROUTE_10_NU_INBOUND_STOP_IDS.has(stopId)
}

export function isRoute10NuOutboundSideStopId(stopId: string): boolean {
  return ROUTE_10_NU_OUTBOUND_STOP_IDS.has(stopId)
}

export function isRoute10NazarbaevDemoStopId(stopId: string): boolean {
  return ROUTE_10_NU_DEMO_STOP_IDS.has(stopId)
}
