/**
 * Demo-only: two Nazarbayev University platforms along Qabanbay Batyr.
 * Route 10 shape overrides place outbound geometry through the outbound-side
 * coordinates and inbound geometry through the inbound-side coordinates.
 */
/** Production `bus_stops.id` on Route 10 outbound (toward airport). */
export const ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID =
  "21768934-279d-4ace-a962-0e638546a0ef"

/** GTFS `stop_id` / legacy row when PK differs from static feed. */
export const ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID =
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
  ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID,
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

/** Minimal row shape from `bus_stops` (id = PK, stop_code often = GTFS stop_id). */
export type NazarbayevStopRow = { id: string; stop_code?: string | null }

function normStopKey(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

export function isNazarbayevOutboundPlatformRow(
  row: NazarbayevStopRow | undefined,
): boolean {
  if (!row) return false
  const id = normStopKey(row.id)
  if (
    id === normStopKey(ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID) ||
    id === normStopKey(ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID)
  ) {
    return true
  }
  const c = normStopKey(row.stop_code)
  return (
    c === normStopKey(ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID) ||
    c === normStopKey(ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID)
  )
}

export function isNazarbayevInboundPlatformRow(
  row: NazarbayevStopRow | undefined,
): boolean {
  if (!row) return false
  const c = normStopKey(row.stop_code)
  return (
    c === normStopKey(ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID) ||
    c === normStopKey(ROUTE_10_NU_INBOUND_SIDE_STOP_CODE) ||
    row.id === ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID ||
    row.id === ROUTE_10_NU_INBOUND_SIDE_STOP_CODE
  )
}

/**
 * Returns the opposite NU platform's `bus_stops.id` for getEtaPayload / vehicles API.
 * Uses stop_code matching because DB primary keys are not the GTFS ids.
 */
export function resolveNazarbayevOppositeStopDbId(
  stops: NazarbayevStopRow[],
  currentStopId: string | undefined,
): string | null {
  if (!currentStopId?.trim() || !stops.length) return null
  const row = stops.find((s) => s.id === currentStopId)
  if (!row) return null
  if (isNazarbayevOutboundPlatformRow(row)) {
    const opp = stops.find((s) => isNazarbayevInboundPlatformRow(s))
    return opp?.id ?? null
  }
  if (isNazarbayevInboundPlatformRow(row)) {
    const opp = stops.find((s) => isNazarbayevOutboundPlatformRow(s))
    return opp?.id ?? null
  }
  return null
}
