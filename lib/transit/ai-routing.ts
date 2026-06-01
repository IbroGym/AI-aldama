import {
  ROUTE_10_INBOUND_STOP_IDS,
  ROUTE_10_OUTBOUND_STOP_IDS,
  ROUTE_12_INBOUND_STOP_IDS,
  ROUTE_12_OUTBOUND_STOP_IDS,
  ROUTE_46_INBOUND_STOP_IDS,
  ROUTE_46_OUTBOUND_STOP_IDS,
  resolveRouteOrderOverrides,
} from "@/lib/vehicles/route-overrides"
import {
  searchStopsByName,
  stripStopQueryStopwords,
} from "@/lib/i18n/stop-search"
import {
  ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID,
  ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID,
  isNazarbayevInboundPlatformRow,
  isNazarbayevOutboundPlatformRow,
  resolveNazarbayevOppositeRoutingStopId,
} from "@/lib/vehicles/route10-nu-demo-stops"

/** Shared corridor stops (opposite platform / route 12 at NU). */
const NU_CORRIDOR_ROUTING_STOP_IDS = [
  ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID,
  "d7c8a98a-cee0-4225-bc8a-fbc5286a3e69",
  "cb6b7be7-9469-4270-add7-d6ee53e7dc7c",
  "1f48306b-7059-434d-ac20-aa05073980c6",
] as const

/** Equivalent hop penalty for crossing to the opposite NU platform. */
const NU_CROSS_PLATFORM_PENALTY_HOPS = 4

/** Route 10 outbound «Стелла Звезда» (GTFS rows may use other UUIDs as PK). */
const ROUTE_10_STELLA_OUTBOUND_STOP_ID = "e6103f47-14ec-4c2f-beaf-30afee8480c6"

/** GTFS / DB id → id in directional override graph */
const ROUTING_GRAPH_ID_ALIASES: Record<string, string> = {
  "0a75a06f-8e5d-48f2-ac85-8211908d4c41": ROUTE_10_STELLA_OUTBOUND_STOP_ID,
  "06eee664-f6eb-43f7-ac6a-de0d6e693a27": ROUTE_10_STELLA_OUTBOUND_STOP_ID,
  "f4d06a9d-8db0-4730-b026-249312e0dbe5": "6e0f2eb6-c144-4f73-8628-20f062f8f9b4",
  "26d4ae3b-1b99-47f1-a819-0e4f77899d96": "6e0f2eb6-c144-4f73-8628-20f062f8f9b4",
}

/** Shared 12-inbound / 46-inbound hub (city center corridor). */
const ROUTE_12_46_TRANSFER_HUB_STOP_ID =
  "0845f091-2b52-4028-b04b-42962dfc625e"

export const WALK_TRANSFER_ROUTE_NUMBER = "xfer"
const WALK_TRANSFER_HOP_COST = 5

/** Same id as canonical railway station stop in AI route handler. */
const RAILWAY_STOP_ID = "a9adbb0f-d9f8-43d7-9084-dc71cf757017"

const DIRECTIONAL_ROUTE_STOPS: Record<
  string,
  { outbound: string[]; inbound: string[] }
> = {
  "10": {
    outbound: ROUTE_10_OUTBOUND_STOP_IDS,
    inbound: ROUTE_10_INBOUND_STOP_IDS,
  },
  "12": {
    outbound: ROUTE_12_OUTBOUND_STOP_IDS,
    inbound: ROUTE_12_INBOUND_STOP_IDS,
  },
  "46": {
    outbound: ROUTE_46_OUTBOUND_STOP_IDS,
    inbound: [...ROUTE_46_INBOUND_STOP_IDS, RAILWAY_STOP_ID],
  },
}

const MVP_ROUTE_NUMBERS = new Set(["10", "12", "46"])
const MIN_STOPS_FOR_DIRECTIONAL_LIST = 4

export type RideLeg = {
  routeId: string
  routeNumber: string
  routeName: string
  fromStopId: string
  toStopId: string
}

export type StopRoutingRow = {
  id: string
  stop_code: string
  name: string
  name_kk?: string | null
  name_ru?: string | null
  name_en?: string | null
}

export type RouteStopJoinRow = {
  route_id: string
  stop_id: string
  stop_sequence: number
}

/** Per-request graph: all MVP stops from override resolution (not only hardcoded UUIDs). */
export type MvpRoutingContext = {
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>
  adjacency: Map<string, RideLeg[]>
  allStopIds: Set<string>
}

function normalizeRouteNumber(raw?: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim().toLowerCase()
  const normalized = trimmed
    .replace(/^route\s*/i, "")
    .replace(/^r\s*/i, "")
    .replace(/^маршрут\s*/i, "")
    .replace(/^автобус\s*/i, "")
  return normalized || null
}

function normalizeStopNameKey(stop: StopRoutingRow): string {
  const raw = (stop.name_ru || stop.name || stop.name_en || stop.name_kk || "")
    .toLowerCase()
  return raw
    .replace(/\bстелла\b/g, "")
    .replace(/\bстела\b/g, "")
    .replace(/\bstella\b/g, "")
    .replace(/\bstela\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function allStopIdsInDirectional(
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>
): Set<string> {
  const ids = new Set<string>()
  for (const d of Object.values(directionalByRoute)) {
    for (const id of d.outbound) ids.add(id)
    for (const id of d.inbound) ids.add(id)
  }
  return ids
}

function buildRideAdjacencyFromDirectional(
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>,
  activeRoutes: Array<{ id: string; route_number: string; route_name: string }>
): Map<string, RideLeg[]> {
  const adj = new Map<string, RideLeg[]>()
  const routeIdByNumber = new Map<string, string>()
  const routeNameByNumber = new Map<string, string>()

  for (const r of activeRoutes) {
    const num = normalizeRouteNumber(r.route_number)
    if (!num || !MVP_ROUTE_NUMBERS.has(num)) continue
    routeIdByNumber.set(num, r.id)
    routeNameByNumber.set(num, r.route_name)
  }

  for (const [routeNum, directional] of Object.entries(directionalByRoute)) {
    const routeId = routeIdByNumber.get(routeNum)
    if (!routeId) continue
    const routeName = routeNameByNumber.get(routeNum) ?? ""

    for (const stopIds of [directional.outbound, directional.inbound]) {
      for (let i = 0; i < stopIds.length; i++) {
        for (let j = i + 1; j < stopIds.length; j++) {
          const leg: RideLeg = {
            routeId,
            routeNumber: routeNum,
            routeName,
            fromStopId: stopIds[i],
            toStopId: stopIds[j],
          }
          const list = adj.get(stopIds[i]) ?? []
          list.push(leg)
          adj.set(stopIds[i], list)
        }
      }
    }
  }

  return adj
}

/** Short walk from NU opposite platform to route 12/46 inbound at the city corridor. */
function appendNuCorridorWalkEdges(
  adj: Map<string, RideLeg[]>,
  activeRoutes: Array<{ id: string; route_number: string; route_name: string }>
): void {
  const route12 = activeRoutes.find(
    (r) => normalizeRouteNumber(r.route_number) === "12"
  )
  const walkLegBase = {
    routeId: route12?.id ?? "walk",
    routeNumber: WALK_TRANSFER_ROUTE_NUMBER,
    routeName: "",
  }

  for (const fromId of NU_CORRIDOR_ROUTING_STOP_IDS) {
    const leg: RideLeg = {
      ...walkLegBase,
      fromStopId: fromId,
      toStopId: ROUTE_12_46_TRANSFER_HUB_STOP_ID,
    }
    const list = adj.get(fromId) ?? []
    list.push(leg)
    adj.set(fromId, list)
  }
}

/** Build routing graph from DB + route overrides (covers all stops on 10/12/46). */
export function createMvpRoutingContext(
  activeRoutes: Array<{ id: string; route_number: string; route_name: string }>,
  stops: StopRoutingRow[],
  routeStops: RouteStopJoinRow[]
): MvpRoutingContext {
  const routeStopsByRouteId = new Map<
    string,
    { stop_id: string; stop_sequence: number }[]
  >()
  for (const rs of routeStops) {
    const list = routeStopsByRouteId.get(rs.route_id) ?? []
    list.push({ stop_id: rs.stop_id, stop_sequence: rs.stop_sequence })
    routeStopsByRouteId.set(rs.route_id, list)
  }

  const directionalByRoute: Record<
    string,
    { outbound: string[]; inbound: string[] }
  > = {
    "10": {
      outbound: [...ROUTE_10_OUTBOUND_STOP_IDS],
      inbound: [...ROUTE_10_INBOUND_STOP_IDS],
    },
    "12": {
      outbound: [...ROUTE_12_OUTBOUND_STOP_IDS],
      inbound: [...ROUTE_12_INBOUND_STOP_IDS],
    },
    "46": {
      outbound: [...ROUTE_46_OUTBOUND_STOP_IDS],
      inbound: [...ROUTE_46_INBOUND_STOP_IDS],
    },
  }

  try {
    const overrideResult = resolveRouteOrderOverrides({
      routes: activeRoutes,
      stops: stops.map((s) => ({
        id: s.id,
        name: s.name,
        stop_code: s.stop_code,
      })),
      routeStopsByRouteId,
    })

    for (const route of activeRoutes) {
      const num = normalizeRouteNumber(route.route_number)
      if (!num || !MVP_ROUTE_NUMBERS.has(num)) continue
      const debug = overrideResult.directionDebugByRouteId.get(route.id)
      const outbound =
        debug?.outbound_stop_ids?.length &&
        debug.outbound_stop_ids.length >= MIN_STOPS_FOR_DIRECTIONAL_LIST
          ? debug.outbound_stop_ids
          : (overrideResult.orderedStopIdsByRouteId.get(route.id) ?? [])
      const inbound =
        debug?.inbound_stop_ids?.length &&
        debug.inbound_stop_ids.length >= MIN_STOPS_FOR_DIRECTIONAL_LIST
          ? debug.inbound_stop_ids
          : []
      if (outbound.length >= MIN_STOPS_FOR_DIRECTIONAL_LIST) {
        directionalByRoute[num] = {
          outbound,
          inbound:
            inbound.length >= MIN_STOPS_FOR_DIRECTIONAL_LIST
              ? inbound
              : directionalByRoute[num]?.inbound ?? [],
        }
      }
    }
  } catch {
    // Keep static fallback lists
  }

  const allStopIds = allStopIdsInDirectional(directionalByRoute)
  const adjacency = buildRideAdjacencyFromDirectional(
    directionalByRoute,
    activeRoutes
  )
  appendNuCorridorWalkEdges(adjacency, activeRoutes)

  return { directionalByRoute, adjacency, allStopIds }
}

/** Map DB stop row to id used in route 10/12/46 graphs. */
export function resolveStopIdForRouting(
  stop: StopRoutingRow,
  stops: StopRoutingRow[],
  mvpCtx?: MvpRoutingContext
): string {
  const directionalIds = mvpCtx?.allStopIds ?? allStopIdsInDirectional(DIRECTIONAL_ROUTE_STOPS)
  const alias =
    ROUTING_GRAPH_ID_ALIASES[stop.id] ?? ROUTING_GRAPH_ID_ALIASES[stop.stop_code]
  if (alias) return alias

  if (directionalIds.has(stop.id)) return stop.id
  if (directionalIds.has(stop.stop_code)) return stop.stop_code

  const nameKey = normalizeStopNameKey(stop)
  if (nameKey) {
    const nameMatches: string[] = []
    for (const id of directionalIds) {
      const row = stops.find((s) => s.id === id)
      if (row && normalizeStopNameKey(row) === nameKey) nameMatches.push(id)
    }
    if (nameMatches.length === 1) return nameMatches[0]
    if (nameMatches.length > 1) {
      const onOutbound = nameMatches.find((id) =>
        ROUTE_10_OUTBOUND_STOP_IDS.includes(id)
      )
      if (onOutbound) return onOutbound
      return nameMatches[0]
    }
  }

  const linked = stops.find(
    (s) =>
      (s.stop_code === stop.id || s.id === stop.stop_code) &&
      directionalIds.has(s.id)
  )
  if (linked) return linked.id

  return stop.id
}

/** Kiosk row → correct platform id on route 10 (inbound vs outbound NU). */
export function resolveOriginRoutingStopId(
  currentStop: StopRoutingRow,
  stops: StopRoutingRow[]
): string {
  if (isNazarbayevOutboundPlatformRow(currentStop)) {
    return ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID
  }
  if (isNazarbayevInboundPlatformRow(currentStop)) {
    return ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID
  }
  return resolveStopIdForRouting(currentStop, stops)
}

/** Prefer terminal on route 46 (e.g. ulitsa Karasu at inbound end). */
export function pickRoute46TerminalAmongCandidates(
  candidateIds: string[],
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>
): string | null {
  const d46 = directionalByRoute["46"]
  if (!d46) return null

  const on46 = candidateIds.filter(
    (id) => d46.inbound.includes(id) || d46.outbound.includes(id)
  )
  if (!on46.length) return null

  let bestInboundId: string | null = null
  let bestInboundIdx = -1
  for (const id of on46) {
    const idx = d46.inbound.indexOf(id)
    if (idx > bestInboundIdx) {
      bestInboundIdx = idx
      bestInboundId = id
    }
  }
  if (bestInboundId) return bestInboundId

  const atOutboundStart = on46.find((id) => d46.outbound.indexOf(id) === 0)
  if (atOutboundStart) return atOutboundStart

  return on46[0]
}

export function countBusRideLegs(path: RideLeg[]): number {
  return path.filter((leg) => leg.routeNumber !== WALK_TRANSFER_ROUTE_NUMBER)
    .length
}

/**
 * Same name can map to inbound + outbound rows (e.g. Stella). Pick dest on the
 * same directional list ahead of origin (outbound NU → outbound Stella).
 */
export function pickDestinationRoutingStopId(
  originRoutingId: string,
  hitRows: StopRoutingRow[],
  stops: StopRoutingRow[],
  mvpCtx?: MvpRoutingContext
): string {
  const directionalByRoute =
    mvpCtx?.directionalByRoute ?? DIRECTIONAL_ROUTE_STOPS
  const candidateIds = [
    ...new Set(hitRows.map((h) => resolveStopIdForRouting(h, stops, mvpCtx))),
  ]

  const route46Terminal = pickRoute46TerminalAmongCandidates(
    candidateIds,
    directionalByRoute
  )
  if (route46Terminal) return route46Terminal

  for (const directional of Object.values(directionalByRoute)) {
    const outFrom = directional.outbound.indexOf(originRoutingId)
    if (outFrom >= 0) {
      let bestId: string | null = null
      let bestIdx = Number.POSITIVE_INFINITY
      for (const id of candidateIds) {
        const idx = directional.outbound.indexOf(id)
        if (idx > outFrom && idx < bestIdx) {
          bestIdx = idx
          bestId = id
        }
      }
      if (bestId) return bestId
    }

    const inFrom = directional.inbound.indexOf(originRoutingId)
    if (inFrom >= 0) {
      let bestId: string | null = null
      let bestIdx = Number.POSITIVE_INFINITY
      for (const id of candidateIds) {
        const idx = directional.inbound.indexOf(id)
        if (idx > inFrom && idx < bestIdx) {
          bestIdx = idx
          bestId = id
        }
      }
      if (bestId) return bestId
    }
  }

  const route10Outbound = directionalByRoute["10"]?.outbound ?? ROUTE_10_OUTBOUND_STOP_IDS
  if (route10Outbound.includes(originRoutingId)) {
    const onOutbound = candidateIds.find((id) => route10Outbound.includes(id))
    if (onOutbound) return onOutbound
  }

  // Destinations at the "start" of outbound (e.g. Karasu) are reached via inbound lists.
  let bestInboundIdx = -1
  let bestInboundId: string | null = null
  for (const id of candidateIds) {
    for (const directional of Object.values(directionalByRoute)) {
      const outIdx = directional.outbound.indexOf(id)
      const inIdx = directional.inbound.indexOf(id)
      if (outIdx === 0 && inIdx > bestInboundIdx) {
        bestInboundIdx = inIdx
        bestInboundId = id
      } else if (inIdx > bestInboundIdx && inIdx >= 0) {
        const outFrom = directional.outbound.indexOf(originRoutingId)
        if (outFrom >= 0 && outIdx < 0) {
          bestInboundIdx = inIdx
          bestInboundId = id
        }
      }
    }
  }
  if (bestInboundId) return bestInboundId

  return candidateIds[0] ?? resolveStopIdForRouting(hitRows[0], stops, mvpCtx)
}

/** KK/RU dative suffix: көшесіне, аялдамасына, … */
const DEST_FIRST_SUFFIX_RE =
  /(?:көшесіне|көше|кошesine|koshesine|аялдамасына|аялдамаға|тоқтауына|токтауына|турағына|турағы)(?=\s|$|[?.!,])/iu

const ROUTE_INTENT_TAIL_RE =
  /(?:қалай\s+)?(?:жету|жетсем|жетуге|жетсе|бару|барамын|келу|баруға)(?:\s+болады|\s+керек)?\s*$/iu

/** Strip routing intent phrases so search focuses on the place name. */
export function normalizeDestinationStopQuery(query: string): string {
  const stripped = query
    .replace(
      /^(как\s+)?(добраться|доехать|проехать|попасть|ехать|дойти)\s+(до|на)\s+(остановк[аиуеё]?\s+)?/gi,
      ""
    )
    .replace(
      /^(how\s+to\s+get\s+to|how\s+do\s+i\s+get\s+to)\s+(the\s+)?(bus\s+)?(stop\s+)?/gi,
      ""
    )
    .replace(
      /^(қалай\s+)?(жету|бару|барамын|келу)\s+(де|ге|ға|қа|ой)?\s*(аялдам[аы]?\s*|тоқтау\s*|токтау\s*|көшесіне\s*|көше\s*|кошесине\s*|коше\s*)?/giu,
      ""
    )
    .replace(
      /^(қалай\s+).{0,40}?(аялдам[аы]?\s*|тоқтау\s*|токтау\s*)(қа|ға|ге|де)?\s*/giu,
      ""
    )
    .replace(DEST_FIRST_SUFFIX_RE, " ")
    .replace(ROUTE_INTENT_TAIL_RE, "")
    .replace(/[?.!]+$/, "")
    .trim()
  return stripStopQueryStopwords(stripped) || stripped
}

/** «Қарасу көшесіне …» / «до Карасу как …» — place name comes first. */
export function extractDestinationPlaceFromQuestion(question: string): string {
  const q = question.replace(/[?.!]+$/, "").trim()

  const kkDestFirst = q.match(
    new RegExp(`^(.+?)\\s*${DEST_FIRST_SUFFIX_RE.source}`, "iu")
  )
  if (kkDestFirst?.[1]) {
    const place = stripStopQueryStopwords(kkDestFirst[1].trim())
    if (place.length >= 2) return place
  }

  const ruDestFirst = q.match(
    /^(?:до|на)\s+(.+?)\s+(?:(?:как|каким\s+образом)\s+)?(?:добраться|доехать|попасть|ехать|дойти)(?=\s|$|[?.!,])/iu
  )
  if (ruDestFirst?.[1]) {
    const place = stripStopQueryStopwords(ruDestFirst[1].trim())
    if (place.length >= 2) return place
  }

  return ""
}

/** Passenger asks how to reach a named bus stop (not airport/railway-only phrasing). */
export function isRouteToStopQuestion(question: string): boolean {
  const lower = question.toLowerCase()
  const asksRoute =
    /(?:как\s+)?(?:добраться|доехать|проехать|попасть|ехать|дойти)\s+(?:до|на)\s+/i.test(
      question
    ) ||
    /(?:до|на)\s+\S+.{2,80}(?:добраться|доехать|попасть|ехать)/iu.test(question) ||
    /how\s+to\s+get\s+to/i.test(question) ||
    /(?:қалай|жету|жетсем|бару|келу|барамын).{0,50}(?:аялдам|тоқтау|токтау|көше)/iu.test(
      question
    ) ||
    /(?:қалай|жету|жетсем|бару)\s+(де|ге|ға|қа)/iu.test(question) ||
    /\S.{1,60}(?:көшесіне|аялдамасына|тоқтауына|турағына)\s+.{0,40}(?:қалай|жету|жетсем|бару)/iu.test(
      question
    ) ||
    /(?:қалай\s+)?(?:жетсем|жетуге|баруға)\s+болады/iu.test(question)

  if (!asksRoute) return false

  const canonicalOnly =
    /(?:аэропорт[а-яё]*|airport|әуежай[а-яёәғқңөүұһі]*|вокзал[а-яё]*|теміржол|темиржол|railway|train station|единоборств|ушкемп|ushkemp)/iu.test(
      lower
    ) &&
    !/звезд|zvezda|stella|стелл|стелла|жұлдыз|juldyz|қарасу|karasu/i.test(lower)

  return !canonicalOnly
}

export function extractDestinationStopQueryFromQuestion(
  question: string
): string | null {
  if (!isRouteToStopQuestion(question)) return null

  const fromPlace = extractDestinationPlaceFromQuestion(question)
  if (fromPlace.length >= 2) return fromPlace

  let cleaned = normalizeDestinationStopQuery(question)
  if (!cleaned) {
    cleaned = question
      .replace(
        /^(как\s+)?(добраться|доехать|проехать|попасть|ехать|дойти)\s+(до|на)\s+(остановк[аиуеё]?\s+)?/gi,
        ""
      )
      .replace(/^(how\s+to\s+get\s+to)\s+(the\s+)?(bus\s+)?(stop\s+)?/gi, "")
      .replace(
        /^(қалай\s+)?(жету|бару|барамын|келу|жетсем)\s+(де|ге|ға|қа|ой)?\s*(аялдам[аы]?\s*|тоқтау\s*|токтау\s*|көшесіне\s*|көше\s*)?/giu,
        ""
      )
      .replace(DEST_FIRST_SUFFIX_RE, " ")
      .replace(ROUTE_INTENT_TAIL_RE, "")
      .replace(/[?.!]+$/, "")
      .trim()
    cleaned = stripStopQueryStopwords(cleaned) || cleaned
  }

  return cleaned.length >= 2 ? cleaned : null
}

export function searchStopsForRouting(
  query: string,
  stops: StopRoutingRow[],
  limit: number
): StopRoutingRow[] {
  return searchStopsByName(query, stops, limit)
}

/** @deprecated Prefer createMvpRoutingContext().adjacency */
export function buildDirectionalRideAdjacency(
  activeRoutes: Array<{ id: string; route_number: string; route_name: string }>
): Map<string, RideLeg[]> {
  return buildRideAdjacencyFromDirectional(DIRECTIONAL_ROUTE_STOPS, activeRoutes)
}

export function planFewestRides(
  fromId: string,
  toId: string,
  adj: Map<string, RideLeg[]>,
  maxLegs: number
): RideLeg[] | null {
  if (fromId === toId) return []
  const queue: { stop: string; path: RideLeg[] }[] = [{ stop: fromId, path: [] }]
  const visited = new Set<string>([fromId])

  while (queue.length) {
    const { stop, path } = queue.shift()!
    if (path.length >= maxLegs) continue
    for (const leg of adj.get(stop) ?? []) {
      const next = leg.toStopId
      const nextPath = [...path, leg]
      if (next === toId) return nextPath
      if (!visited.has(next)) {
        visited.add(next)
        queue.push({ stop: next, path: nextPath })
      }
    }
  }
  return null
}

/** Stops between boarding and alighting on one ride (proxy for travel time). */
export function legHopCount(
  leg: RideLeg,
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>
): number {
  if (leg.routeNumber === WALK_TRANSFER_ROUTE_NUMBER) return WALK_TRANSFER_HOP_COST

  const directional = directionalByRoute[leg.routeNumber]
  if (!directional) return 24

  const outFrom = directional.outbound.indexOf(leg.fromStopId)
  const outTo = directional.outbound.indexOf(leg.toStopId)
  if (outFrom >= 0 && outTo >= 0 && outFrom < outTo) return outTo - outFrom

  const inFrom = directional.inbound.indexOf(leg.fromStopId)
  const inTo = directional.inbound.indexOf(leg.toStopId)
  if (inFrom >= 0 && inTo >= 0 && inFrom < inTo) return inTo - inFrom

  return 24
}

export function pathHopCost(
  path: RideLeg[],
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>
): number {
  return path.reduce((sum, leg) => sum + legHopCount(leg, directionalByRoute), 0)
}

/**
 * Shortest path by stop count (not fewest transfers). Prefers fewer stops even
 * with an extra transfer when the total ride is shorter.
 */
export function planBestRides(
  fromId: string,
  toId: string,
  adj: Map<string, RideLeg[]>,
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>,
  maxBusLegs: number
): RideLeg[] | null {
  if (fromId === toId) return []

  type QueueItem = { stop: string; path: RideLeg[]; cost: number }
  const bestCostByState = new Map<string, number>()
  const queue: QueueItem[] = [{ stop: fromId, path: [], cost: 0 }]
  let bestComplete: QueueItem | null = null

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost)
    const { stop, path, cost } = queue.shift()!

    if (bestComplete && cost > bestComplete.cost) break
    if (countBusRideLegs(path) >= maxBusLegs) continue

    for (const leg of adj.get(stop) ?? []) {
      const next = leg.toStopId
      const hop = legHopCount(leg, directionalByRoute)
      const nextCost = cost + hop
      const nextPath = [...path, leg]

      if (next === toId) {
        const better =
          !bestComplete ||
          nextCost < bestComplete.cost ||
          (nextCost === bestComplete.cost &&
            nextPath.length < bestComplete.path.length)
        if (better) {
          bestComplete = { stop: next, path: nextPath, cost: nextCost }
        }
        continue
      }

      const stateKey = `${next}:${nextPath.length}`
      if ((bestCostByState.get(stateKey) ?? Number.POSITIVE_INFINITY) <= nextCost) {
        continue
      }
      bestCostByState.set(stateKey, nextCost)
      queue.push({ stop: next, path: nextPath, cost: nextCost })
    }
  }

  return bestComplete?.path ?? null
}

export type RoutingOriginOption = {
  stopId: string
  crossPlatform: boolean
}

/** Kiosk stop plus opposite-platform boarding points (NU corridor). */
export function resolveRoutingOriginCandidates(
  kioskOriginRoutingId: string,
  currentStop: StopRoutingRow,
  mvpCtx?: MvpRoutingContext
): RoutingOriginOption[] {
  const allIds =
    mvpCtx?.allStopIds ?? allStopIdsInDirectional(DIRECTIONAL_ROUTE_STOPS)
  const seen = new Set<string>()
  const options: RoutingOriginOption[] = []

  const push = (id: string, crossPlatform: boolean) => {
    if (!allIds.has(id) || seen.has(id)) return
    seen.add(id)
    options.push({ stopId: id, crossPlatform })
  }

  push(kioskOriginRoutingId, false)

  if (
    isNazarbayevOutboundPlatformRow(currentStop) ||
    isNazarbayevInboundPlatformRow(currentStop)
  ) {
    for (const id of NU_CORRIDOR_ROUTING_STOP_IDS) {
      push(id, id !== kioskOriginRoutingId)
    }
  }

  return options
}

export type BestItineraryResult = {
  path: RideLeg[]
  boardingStopId: string
  crossPlatform: boolean
  hopCost: number
}

/** Append bus legs until path reaches dest (e.g. missing final route 46). */
export function extendItineraryToDestination(
  path: RideLeg[] | null | undefined,
  destRoutingId: string,
  adj: Map<string, RideLeg[]>,
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>,
  maxBusLegs: number
): RideLeg[] | null {
  if (!path?.length) return path ?? null

  let full = [...path]
  let guard = 0
  while (
    full[full.length - 1].toStopId !== destRoutingId &&
    countBusRideLegs(full) < maxBusLegs &&
    guard < 4
  ) {
    guard += 1
    const from = full[full.length - 1].toStopId
    const tail = planBestRides(
      from,
      destRoutingId,
      adj,
      directionalByRoute,
      maxBusLegs - countBusRideLegs(full)
    )
    if (!tail?.length) break
    full = [...full, ...tail]
  }

  return full[full.length - 1].toStopId === destRoutingId ? full : path
}

export function planBestItinerary(
  origins: RoutingOriginOption[],
  toId: string,
  adj: Map<string, RideLeg[]>,
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>,
  maxBusLegs: number,
  crossPlatformPenaltyHops = NU_CROSS_PLATFORM_PENALTY_HOPS
): BestItineraryResult | null {
  let best: BestItineraryResult | null = null

  for (const origin of origins) {
    let path = planBestRides(
      origin.stopId,
      toId,
      adj,
      directionalByRoute,
      maxBusLegs
    )
    if (!path) continue

    path =
      extendItineraryToDestination(
        path,
        toId,
        adj,
        directionalByRoute,
        maxBusLegs
      ) ?? path

    if (path[path.length - 1].toStopId !== toId) continue

    let hopCost = pathHopCost(path, directionalByRoute)
    if (origin.crossPlatform) hopCost += crossPlatformPenaltyHops

    if (!best || hopCost < best.hopCost) {
      best = {
        path,
        boardingStopId: origin.stopId,
        crossPlatform: origin.crossPlatform,
        hopCost,
      }
    }
  }

  return best
}

export type DirectionalRouteMatch = {
  routeNumber: string
  routeId: string
  routeName: string
}

/** One bus, no transfer: dest is ahead of origin on outbound or inbound list. */
export function isDirectBusRideBetween(
  fromStopId: string,
  toStopId: string,
  routeNumber: string,
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>
): boolean {
  const directional = directionalByRoute[routeNumber]
  if (!directional) return false

  const outFrom = directional.outbound.indexOf(fromStopId)
  const outTo = directional.outbound.indexOf(toStopId)
  if (outFrom >= 0 && outTo >= 0 && outFrom < outTo) return true

  const inFrom = directional.inbound.indexOf(fromStopId)
  const inTo = directional.inbound.indexOf(toStopId)
  if (inFrom >= 0 && inTo >= 0 && inFrom < inTo) return true

  return false
}

/** After crossing at NU, can this route reach dest in a single ride? */
export function filterOppositeRoutesWithDirectRide(
  originRoutingStopId: string,
  destRoutingStopId: string,
  oppositeMatches: DirectionalRouteMatch[],
  directionalByRoute: Record<string, { outbound: string[]; inbound: string[] }>
): DirectionalRouteMatch[] {
  const nuOpposite = resolveNazarbayevOppositeRoutingStopId(originRoutingStopId)

  return oppositeMatches.filter((m) => {
    const boardingCandidates = [
      nuOpposite,
      originRoutingStopId,
    ].filter((id): id is string => Boolean(id))

    return boardingCandidates.some((fromId) =>
      isDirectBusRideBetween(
        fromId,
        destRoutingStopId,
        m.routeNumber,
        directionalByRoute
      )
    )
  })
}

export function getDirectionalRoutesBetween(
  fromStopId: string,
  toStopId: string,
  activeRoutes: Array<{ id: string; route_number: string; route_name: string }>,
  mvpCtx?: MvpRoutingContext
): { sameSide: DirectionalRouteMatch[]; oppositeSide: DirectionalRouteMatch[] } {
  const sameSide: DirectionalRouteMatch[] = []
  const oppositeSide: DirectionalRouteMatch[] = []
  const directionalByRoute =
    mvpCtx?.directionalByRoute ?? DIRECTIONAL_ROUTE_STOPS

  for (const route of activeRoutes) {
    const routeNumber = normalizeRouteNumber(route.route_number)
    if (!routeNumber || !MVP_ROUTE_NUMBERS.has(routeNumber)) continue
    const directional = directionalByRoute[routeNumber]
    if (!directional) continue

    const outFrom = directional.outbound.indexOf(fromStopId)
    const outTo = directional.outbound.indexOf(toStopId)
    const inFrom = directional.inbound.indexOf(fromStopId)
    const inTo = directional.inbound.indexOf(toStopId)

    const entry: DirectionalRouteMatch = {
      routeNumber,
      routeId: route.id,
      routeName: route.route_name,
    }

    if (outFrom >= 0 && outTo >= 0 && outFrom < outTo) {
      sameSide.push(entry)
      continue
    }
    if (outFrom >= 0 && outTo >= 0 && outFrom > outTo) {
      // Terminal / backward on outbound — often need inbound list (e.g. Karasu on 46).
      if (inFrom >= 0 && inTo >= 0 && inFrom < inTo) {
        sameSide.push(entry)
      } else {
        oppositeSide.push(entry)
      }
      continue
    }
    if (inFrom >= 0 && inTo >= 0 && inFrom < inTo) {
      sameSide.push(entry)
      continue
    }
    if (inFrom >= 0 && inTo >= 0 && inFrom > inTo) {
      oppositeSide.push(entry)
      continue
    }
    // Mixed lists: opposite platform only when dest is not forward on outbound
    // from an outbound-boarding origin (fixes NU outbound → Stella outbound).
    if (outFrom >= 0 && inTo >= 0 && outTo < 0) {
      const nuOpposite = resolveNazarbayevOppositeRoutingStopId(fromStopId)
      const boardingId = nuOpposite ?? fromStopId
      const inBoard = directional.inbound.indexOf(boardingId)
      if (inBoard >= 0 && inBoard < inTo) {
        oppositeSide.push(entry)
      }
      continue
    }
    if (inFrom >= 0 && outTo >= 0 && inTo < 0) {
      oppositeSide.push(entry)
    }
  }

  return { sameSide, oppositeSide }
}

export function stopServedByMvpRoutes(
  stopId: string,
  mvpCtx?: MvpRoutingContext
): string[] {
  const serving: string[] = []
  const directionalByRoute =
    mvpCtx?.directionalByRoute ?? DIRECTIONAL_ROUTE_STOPS
  for (const [routeNumber, directional] of Object.entries(directionalByRoute)) {
    if (
      directional.outbound.includes(stopId) ||
      directional.inbound.includes(stopId)
    ) {
      serving.push(routeNumber)
    }
  }
  return serving
}
