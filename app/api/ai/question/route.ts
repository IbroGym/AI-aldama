import { generateText, tool } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { isLocale, type Locale } from "@/lib/i18n/config"
import {
  mergeStopLocalizedFields,
  refineDestinationSearchHits,
  searchStopsByName,
  stripStopQueryStopwords,
} from "@/lib/i18n/stops"
import { getEtaPayload } from "@/lib/vehicles/vehicle-service"
import {
  ROUTE_10_INBOUND_STOP_IDS,
  ROUTE_10_OUTBOUND_STOP_IDS,
  ROUTE_12_INBOUND_STOP_IDS,
  ROUTE_12_OUTBOUND_STOP_IDS,
  ROUTE_46_INBOUND_STOP_IDS,
  ROUTE_46_OUTBOUND_STOP_IDS,
} from "@/lib/vehicles/route-overrides"
import {
  ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID,
  ROUTE_10_NU_INBOUND_SIDE_STOP_CODE,
  ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID,
  ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID,
  isNazarbayevInboundPlatformRow,
  isNazarbayevOutboundPlatformRow,
  resolveNazarbayevOppositeStopDbId,
} from "@/lib/vehicles/route10-nu-demo-stops"
import { findLandmarkByQuery, landmarkDisplayName } from "@/lib/transit/landmarks"
import {
  createMvpRoutingContext,
  extractDestinationStopQueryFromQuestion,
  filterOppositeRoutesWithDirectRide,
  getDirectionalRoutesBetween,
  isDirectBusRideBetween,
  normalizeDestinationStopQuery,
  pickDestinationRoutingStopId,
  planBestItinerary,
  planFewestRides,
  resolveOriginRoutingStopId,
  resolveRoutingOriginCandidates,
  WALK_TRANSFER_ROUTE_NUMBER,
  resolveStopIdForRouting,
  searchStopsForRouting,
  stopServedByMvpRoutes,
  type StopRoutingRow,
} from "@/lib/transit/ai-routing"

const CANONICAL_DESTINATIONS = {
  airport: {
    id: "8c4ad112-e945-4ebf-ace1-1ac761470bfc",
    synonyms: [
      "әуежай",
      "халықаралық әуежай",
      "аэропорт",
      "международный аэропорт",
      "airport",
      "terminal",
      "auezhai",
    ],
  },
  railwayStation: {
    id: "a9adbb0f-d9f8-43d7-9084-dc71cf757017",
    synonyms: [
      "темір жол вокзалы",
      "темір жол",
      "теміржол вокзалы",
      "теміржол",
      "жд вокзал",
      "вокзал",
      "железнодорожный вокзал",
      "railway station",
      "train station",
      "temirzhol",
    ],
  },
  martialPalace: {
    // "Дворец единоборств им. Жаксылыка Ушкемпирова"
    id: "a9566d81-a191-47aa-a4dc-70ea4c6b0e83",
    synonyms: [
      "дворец единоборств",
      "ushkempirov",
      "martial arts palace",
      "martial palace",
    ],
  },
} as const

const AIRPORT_STOP_ID = CANONICAL_DESTINATIONS.airport.id
const RAILWAY_STOP_ID = CANONICAL_DESTINATIONS.railwayStation.id
const MARTIAL_PALACE_STOP_ID = CANONICAL_DESTINATIONS.martialPalace.id

const OPPOSITE_STOP_BY_ID: Record<string, string> = {
  [ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID]: ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID,
  [ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID]: ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID,
  [ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID]: ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID,
}
const BUS_PREFIX_ROUTES = new Set(["10", "12", "46"])

function formatMinutes(locale: Locale, minutes: number): string {
  if (locale === "ru") return `${minutes} минут`
  if (locale === "kk") return `${minutes} минут`
  return `${minutes} minutes`
}

function formatRouteLabel(locale: Locale, routeRaw?: string | null): string {
  const normalized = normalizeRouteNumber(routeRaw)
  const route = normalized ?? routeRaw ?? ""
  if (!route) return locale === "en" ? "route" : "маршрут"
  if (BUS_PREFIX_ROUTES.has(route)) {
    return locale === "en" ? `Bus ${route}` : `Автобус ${route}`
  }
  return locale === "en" ? `Route ${route}` : `Маршрут ${route}`
}

function normalizeRouteDisplayName(routeName?: string | null): string {
  if (!routeName) return ""
  const parts = routeName
    .split(/\s*[-–—]\s*/g)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length >= 3) {
    const first = parts[0].toLowerCase()
    const last = parts[parts.length - 1].toLowerCase()
    if (first === last) {
      parts.pop()
    }
  }
  return parts.join(" - ")
}

function detectLocaleFromQuestion(
  questionText: string,
  fallback: Locale
): Locale {
  const lower = questionText.toLowerCase()
  // Kazakh-specific letters give the strongest signal.
  if (/[әғқңөүұһәі]/i.test(questionText)) return "kk"
  // Common Russian words.
  if (/\b(как|когда|сколько|где|маршрут|автобус|остановк)/i.test(lower)) {
    return "ru"
  }
  // Any Cyrillic text (without Kazakh-specific letters above) defaults to Russian.
  if (/[а-яё]/i.test(questionText)) return "ru"
  // If text is mostly Latin, assume English.
  if (/[a-z]/i.test(questionText) && !/[а-яё]/i.test(questionText)) {
    return "en"
  }
  return fallback
}

function normalizeRouteNumber(raw?: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim().toLowerCase()
  const normalized = trimmed
    .replace(/^route\s*/i, "")
    .replace(/^r\s*/i, "")
    .replace(/^маршрут\s*/i, "")
  return normalized || null
}

function extractRouteNumber(questionText: string): string | null {
  const lower = questionText.toLowerCase()
  const routeMatch =
    lower.match(/route\s*([a-z]?\d+)/i) ||
    lower.match(/\bмаршрут\s*([a-z]?\d+)\b/i) ||
    lower.match(/\bавтобус\s*([a-z]?\d+)\b/i) ||
    lower.match(/\b([a-z]?\d+)\b/)

  return normalizeRouteNumber(routeMatch?.[1] ?? null)
}

function getDestinationKey(
  questionText: string
): "airport" | "railwayStation" | "martialPalace" | null {
  const lower = questionText.toLowerCase()
  if (CANONICAL_DESTINATIONS.airport.synonyms.some((s) => lower.includes(s))) {
    return "airport"
  }
  if (
    CANONICAL_DESTINATIONS.railwayStation.synonyms.some((s) =>
      lower.includes(s)
    )
  ) {
    return "railwayStation"
  }
  if (
    CANONICAL_DESTINATIONS.martialPalace.synonyms.some((s) =>
      lower.includes(s)
    )
  ) {
    return "martialPalace"
  }
  return null
}

function destinationNameTokens(
  key: "airport" | "railwayStation" | "martialPalace"
): string[] {
  if (key === "airport") {
    return ["airport", "аэропорт", "әуежай", "terminal"]
  }
  if (key === "martialPalace") {
    return ["единоборств", "ушкемп", "martial", "ushkemp"]
  }
  // Avoid "railway"/"train station" — route 10 name is "… Railway Station — … Airport" and would
  // match airport-bound buses when the passenger asks for the railway station.
  return ["вокзал", "ж/д", "теміржол", "темір жол", "temirzhol", "станция"]
}

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

const STOP_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type StopContextRow = {
  id: string
  stop_code: string
  name: string
  name_kk?: string | null
  name_ru?: string | null
  name_en?: string | null
  latitude: number
  longitude: number
  address: string | null
  zone: string | null
  is_active: boolean
  has_shelter: boolean
  has_display: boolean
}

type RouteStopJoin = { route_id: string; stop_id: string; stop_sequence: number }

function stopDisplayName(stop: StopContextRow, locale: Locale): string {
  if (locale === "ru") return stop.name_ru || stop.name
  if (locale === "kk") return stop.name_kk || stop.name
  return stop.name_en || stop.name
}

function resolveStopRef(ref: string, stops: StopContextRow[]): StopContextRow | null {
  const t = ref.trim()
  if (!t) return null
  if (STOP_UUID_RE.test(t)) {
    return stops.find((s) => s.id === t) ?? null
  }
  const lower = t.toLowerCase()
  const byCode = stops.find((s) => s.stop_code.toLowerCase() === lower)
  if (byCode) return byCode
  return stops.find((s) => s.id === t) ?? null
}

function searchStopsLocal(
  query: string,
  stops: StopContextRow[],
  limit: number
): StopContextRow[] {
  return searchStopsByName(query, stops, limit)
}

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)))
}

function groupSortedRouteStops(routeStops: RouteStopJoin[]): Map<string, RouteStopJoin[]> {
  const m = new Map<string, RouteStopJoin[]>()
  for (const rs of routeStops) {
    const list = m.get(rs.route_id) ?? []
    list.push(rs)
    m.set(rs.route_id, list)
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.stop_sequence - b.stop_sequence)
  }
  return m
}

function directRoutesBetweenStopsDb(
  fromId: string,
  toId: string,
  grouped: Map<string, RouteStopJoin[]>,
  routeMeta: Map<string, { route_number: string; route_name: string }>
): Array<{ routeNumber: string; routeName: string }> {
  const out: Array<{ routeNumber: string; routeName: string }> = []
  for (const [routeId, seq] of grouped) {
    const meta = routeMeta.get(routeId)
    if (!meta) continue
    const idxFrom = seq.findIndex((x) => x.stop_id === fromId)
    const idxTo = seq.findIndex((x) => x.stop_id === toId)
    if (idxFrom >= 0 && idxTo >= 0 && idxFrom < idxTo) {
      out.push({
        routeNumber: meta.route_number,
        routeName: normalizeRouteDisplayName(meta.route_name),
      })
    }
  }
  return out
}

export async function POST(req: Request) {
  const startTime = Date.now()
  const { question, stopId, stopName, locale, contextArrivals } = await req.json()
  const uiLocale: Locale = isLocale(locale) ? locale : "kk"
  const responseLocale: Locale = detectLocaleFromQuestion(question, uiLocale)

  if (!question) {
    return Response.json({ error: "Question is required" }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch context data for the AI
  const [{ data: routes }, { data: stops }, { data: alerts }, { data: routeStops }, etaPayload] =
    await Promise.all([
      supabase.from("bus_routes").select("*").eq("is_active", true),
      supabase.from("bus_stops").select("*").eq("is_active", true),
      supabase.from("alerts").select("*").eq("is_active", true),
      supabase
        .from("route_stops")
        .select("route_id, stop_id, stop_sequence"),
      stopId
        ? getEtaPayload(supabase, stopId, false, false)
        : Promise.resolve(null),
    ])

  let stopsForContext = [...(stops ?? [])]
  if (stopId) {
    const row = stopsForContext.find((s) => s.id === stopId)
    if (
      row &&
      (isNazarbayevOutboundPlatformRow(row) ||
        isNazarbayevInboundPlatformRow(row)) &&
      !resolveNazarbayevOppositeStopDbId(stopsForContext, stopId)
    ) {
      const codes = isNazarbayevOutboundPlatformRow(row)
        ? [ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID, ROUTE_10_NU_INBOUND_SIDE_STOP_CODE]
        : [
            ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID,
            ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID,
          ]
      const { data: nuPartnerRows } = await supabase
        .from("bus_stops")
        .select("*")
        .in("stop_code", codes)
      const byId = new Map(stopsForContext.map((s) => [s.id, s]))
      for (const r of nuPartnerRows ?? []) {
        byId.set(r.id, r)
      }
      stopsForContext = Array.from(byId.values())
    }
  }

  stopsForContext = stopsForContext.map((s) => mergeStopLocalizedFields(s))

  const currentStop = stopsForContext.find((s) => s.id === stopId)
  const currentStopDisplayName =
    responseLocale === "ru"
      ? currentStop?.name_ru || currentStop?.name
      : responseLocale === "kk"
        ? currentStop?.name_kk || currentStop?.name
        : currentStop?.name_en || currentStop?.name
  const activeRoutes = routes ?? []
  const activeRouteStops = routeStops ?? []

  const routeMetaById = new Map(
    activeRoutes.map((r) => [
      r.id,
      { route_number: r.route_number, route_name: r.route_name },
    ])
  )
  const groupedSortedRouteStops = groupSortedRouteStops(activeRouteStops)
  const mvpRoutingContext = createMvpRoutingContext(
    activeRoutes,
    stopsForContext as StopRoutingRow[],
    activeRouteStops
  )

  // Use the same ETA source as /api/eta (simulation snapshot)
  const apiUpcomingArrivals = etaPayload?.arrivals?.map((eta) => ({
    route: eta.route_number,
    routeName: normalizeRouteDisplayName(eta.route_name),
    busNumber: eta.bus_label,
    arrivalTime: eta.predicted_arrival_iso,
    // Use the exact ETA minutes from /api/eta to stay in sync with kiosk board.
    minutesAway: eta.eta_minutes,
  }))

  const safeContextArrivals = Array.isArray(contextArrivals)
    ? contextArrivals
        .filter(
          (a) =>
            a &&
            typeof a.routeNumber === "string" &&
            typeof a.minutesAway === "number"
        )
        .map((a) => ({
          route: a.routeNumber,
          routeName:
            typeof a.routeName === "string"
              ? normalizeRouteDisplayName(a.routeName)
              : "",
          busNumber: typeof a.busNumber === "string" ? a.busNumber : "",
          arrivalTime: null as string | null,
          minutesAway: Math.max(0, Math.round(a.minutesAway)),
        }))
    : []

  // Prefer the exact arrivals currently shown in the kiosk UI to avoid drift.
  const upcomingArrivals = (safeContextArrivals.length > 0
    ? safeContextArrivals
    : apiUpcomingArrivals
  )?.slice().sort((a, b) => a.minutesAway - b.minutesAway)

  const oppositeNuDbId =
    stopId && currentStop
      ? resolveNazarbayevOppositeStopDbId(stopsForContext, stopId)
      : null
  let oppositeNuArrivalsBlock = ""
  if (oppositeNuDbId) {
    try {
      const oppEta = await getEtaPayload(supabase, oppositeNuDbId, false, false)
      const lines = (oppEta.arrivals ?? []).slice(0, 8).map(
        (a) =>
          `- Route ${a.route_number} (${normalizeRouteDisplayName(a.route_name)}): Bus ${a.bus_label} arriving in ~${a.eta_minutes} minutes`,
      )
      oppositeNuArrivalsBlock =
        lines.length > 0
          ? lines.join("\n")
          : "No upcoming arrivals at the opposite platform."
    } catch {
      oppositeNuArrivalsBlock = "Opposite platform ETA unavailable."
    }
  }

  const oppositePlatformPromptSection =
    oppositeNuDbId && oppositeNuArrivalsBlock
      ? `

Opposite platform across the road (Nazarbayev University second platform — use when the question targets the OTHER route 10 terminal than this stop name):
${oppositeNuArrivalsBlock}
`
      : ""

  const languageInstruction =
    responseLocale === "ru"
      ? "Respond in Russian."
      : responseLocale === "en"
        ? "Respond in English."
        : "Respond in Kazakh."

  const domainFallback =
    responseLocale === "ru"
      ? "Я могу помочь с автобусами, маршрутами и прибытием на этой остановке."
      : responseLocale === "en"
        ? "I can help with buses, routes, and arrivals at this stop."
        : "Мен осы аялдамадағы автобустар, маршруттар және келу уақыты туралы көмектесе аламын."

  const insufficientDataFallback =
    responseLocale === "ru"
      ? "Сейчас недостаточно данных для точного ответа по этой остановке."
      : responseLocale === "en"
        ? "There is not enough data right now for a precise answer at this stop."
        : "Қазір бұл аялдама бойынша нақты жауапқа дерек жеткіліксіз."

  const systemPrompt = `You are a helpful transit assistant at a bus stop kiosk. You help passengers with information about bus arrivals, routes, and schedules.
${languageInstruction}

Current Context:
- Current Stop: ${currentStopDisplayName || stopName || "Unknown"}
- Stop Code: ${currentStop?.stop_code || "Unknown"}
- Stop ID (UUID for tools): ${stopId || "Unknown"}
- Current Time: ${new Date().toLocaleTimeString()}

Available Routes: ${
  routes
    ?.map((r) => `${r.route_number} (${normalizeRouteDisplayName(r.route_name)})`)
    .join(", ") || "None"
}

Upcoming Arrivals at this Stop:
${
  upcomingArrivals?.length
    ? upcomingArrivals
        .map(
          (a) =>
            `- Route ${a.route} (${a.routeName}): Bus ${a.busNumber} arriving in ${a.minutesAway} minutes`
        )
        .join("\n")
    : "No upcoming arrivals"
}
${oppositePlatformPromptSection}
Active Alerts:
${
  alerts?.length
    ? alerts.map((a) => `- ${a.title}: ${a.message}`).join("\n")
    : "No active alerts"
}

Rules (strict):
- You are a stop-based transport assistant for the CURRENT kiosk stop only.
- Source of truth for ETA is kiosk ETA feed (/api/eta via current context).
- If the passenger asks when the next bus arrives (including Kazakh: «қашан келеді», «келесі автобус», «жақын келу»), answer with concrete minutes from Upcoming Arrivals — do not reply with only the route list from Available Routes.
- Nazarbayev University has two platforms on route 10: toward airport vs toward city/railway. If the kiosk stop name says one direction but the passenger asks for the opposite terminal, call getDestinationRoute or state that they must cross to the opposite stop; never use this stop's ETA for the wrong direction.
- Use structured context/tool data first; do not invent missing values.
- Never guess arrival times, route numbers, travel times, transfers, or directions.
- If data is missing, state it clearly and briefly.
- Do not ask follow-up questions if kiosk context already makes the answer clear.
- If boarding is required from opposite side, state it explicitly.
- Keep answers short: 1-2 sentences, practical, no extra explanations.
- For trip planning or unfamiliar places: call searchStops to resolve stop UUIDs, then getDirectRoutesBetweenStops (nonstop along DB order) and/or planTransitBetweenStops (minimum rides with transfers). Never invent routes or transfers not supported by tool results.
- Use getEtaForStop for arrivals at a stop other than the kiosk; use getRouteSchedule for timetable rows. If schedule tools return empty, say timetable data is unavailable.
- getNearbyStops uses straight-line distance (walking paths may differ).
- Famous buildings/monuments/malls may have no bus stop with that exact name: use getNearestStopsToLandmark(placeQuery) to get real stops nearest to the landmark (straight-line walking estimate), then route to that stop with planTransitBetweenStops / getDirectRoutesBetweenStops from the kiosk Stop ID; tell the passenger they must walk from that stop to the destination (~Xm approximate).

Tool playbook (typical call order — skip steps that do not apply):
1) Next bus / ETA at THIS kiosk stop: use Upcoming Arrivals context first; if a specific route is asked, use getNextArrival(routeNumber).
2) Airport / railway station / martial arts palace from here: prefer getDestinationRoute (handles platform nuance); do not override with guessed ETAs.
3) Any named bus stop in the database ("как доехать до …", "доехать до …", with or without the word "остановка"): the server answers automatically for all stops on routes 10, 12, 46 — same format as Stella Zvezda (direct bus or transfers). Examples: "Как доехать до Биржан сал?", "до остановки Медицинский университет".
4) Named landmark (not a bus stop name): searchStops or getNearestStopsToLandmark → then getRouteToBusStop or planTransitBetweenStops from kiosk Stop ID.
5) A → B when both stop UUIDs are already known: getDirectRoutesBetweenStops or planTransitBetweenStops; prefer getRouteToBusStop when the passenger only gives a name.
6) "Plan my day" / several places: for each place use getRouteToBusStop or step (4) → optionally getEtaForStop; mention getAlerts if relevant.
7) "What routes serve this stop?" when stop is known: getRoutesAtStop(stopId); for the kiosk use Stop ID from Current Context above.
8) Explore one route line: getStopsOnRoute(routeNumber); timetable questions: getRouteSchedule(routeNumber).
9) Walking alternative nearby: getNearbyStops(centerStopId) after resolving center via searchStops or kiosk context.

For multi-stop itineraries only: you may answer with a compact numbered list (each line: route + from → to); still stay factual and short; never fabricate legs.

- Answer only within transit domain for this stop.
- If question is outside domain, respond exactly: "${domainFallback}"
- If data is insufficient for a precise transit answer, prefer: "${insufficientDataFallback}"`

  const getDirectRoutesToDestination = (destinationStopId: string) => {
    if (!stopId || !activeRouteStops.length || !activeRoutes.length) return []
    const routeIndex = new Map<string, { fromSeq?: number; toSeq?: number }>()

    for (const row of activeRouteStops) {
      const entry = routeIndex.get(row.route_id) ?? {}
      if (row.stop_id === stopId) entry.fromSeq = row.stop_sequence
      if (row.stop_id === destinationStopId) entry.toSeq = row.stop_sequence
      routeIndex.set(row.route_id, entry)
    }

    const directRouteIds = Array.from(routeIndex.entries())
      .filter(([, v]) => v.fromSeq != null && v.toSeq != null && v.toSeq > v.fromSeq)
      .map(([routeId]) => routeId)

    return activeRoutes.filter((r) => directRouteIds.includes(r.id))
  }

  const getDirectionalRoutesToDestination = (destinationStopId: string) => {
    if (!stopId || !currentStop || !activeRoutes.length) {
      return { sameSide: [] as typeof activeRoutes, oppositeSide: [] as typeof activeRoutes }
    }
    const originRoutingId = resolveOriginRoutingStopId(
      currentStop as StopRoutingRow,
      stopsForContext as StopRoutingRow[]
    )
    const destRow = stopsForContext.find((s) => s.id === destinationStopId)
    const destId = destRow
      ? resolveStopIdForRouting(destRow as StopRoutingRow, stopsForContext as StopRoutingRow[])
      : destinationStopId

    const { sameSide, oppositeSide } = getDirectionalRoutesBetween(
      originRoutingId,
      destId,
      activeRoutes,
      mvpRoutingContext
    )
    const byNumber = new Map(
      activeRoutes.map((r) => [normalizeRouteNumber(r.route_number) ?? "", r])
    )
    return {
      sameSide: sameSide
        .map((m) => byNumber.get(m.routeNumber))
        .filter((r): r is (typeof activeRoutes)[number] => Boolean(r)),
      oppositeSide: oppositeSide
        .map((m) => byNumber.get(m.routeNumber))
        .filter((r): r is (typeof activeRoutes)[number] => Boolean(r)),
    }
  }

  const getDestinationServingRouteNumbers = (destinationStopId: string): Set<string> => {
    const serving = new Set<string>()
    for (const [routeNumber, directional] of Object.entries(DIRECTIONAL_ROUTE_STOPS)) {
      if (
        directional.outbound.includes(destinationStopId) ||
        directional.inbound.includes(destinationStopId)
      ) {
        serving.add(routeNumber)
      }
    }
    return serving
  }

  const inferSameSideRouteFromArrivals = (
    destinationKey: "airport" | "railwayStation" | "martialPalace",
    destinationStopId: string
  ) => {
    const destinationServing = getDestinationServingRouteNumbers(destinationStopId)
    const tokens = destinationNameTokens(destinationKey)
    const matches = (upcomingArrivals ?? []).filter((a) => {
      const routeNum = normalizeRouteNumber(a.route) ?? ""
      const byRouteMembership = destinationServing.has(routeNum)
      const routeName = (a.routeName ?? "").toLowerCase()
      const byRouteName = tokens.some((t) => routeName.includes(t))
      return byRouteMembership || byRouteName
    })
    if (!matches.length) return null
    return matches
      .slice()
      .sort((a, b) => a.minutesAway - b.minutesAway)[0]
  }

  const getNextUpcomingForRouteNumbers = (routeNumbers: Set<string>) => {
    const matches = (upcomingArrivals ?? []).filter((a) =>
      routeNumbers.has(normalizeRouteNumber(a.route) ?? "")
    )
    if (!matches.length) return null
    return matches.slice().sort((a, b) => a.minutesAway - b.minutesAway)[0]
  }

  const getNextUpcomingAtOppositeStopForRoutes = async (routeNumbers: Set<string>) => {
    if (!stopId) return null
    const oppositeStopId =
      resolveNazarbayevOppositeStopDbId(stopsForContext, stopId) ??
      OPPOSITE_STOP_BY_ID[stopId]
    if (!oppositeStopId) return null
    const oppositeEta = await getEtaPayload(supabase, oppositeStopId, false, false)
    let matches = oppositeEta.arrivals.filter((a) =>
      routeNumbers.has(normalizeRouteNumber(a.route_number) ?? ""),
    )
    if (!matches.length && oppositeEta.arrivals.length > 0) {
      matches = oppositeEta.arrivals.filter((a) =>
        [...routeNumbers].some(
          (want) =>
            want === String(a.route_number ?? "").trim() ||
            want === (normalizeRouteNumber(a.route_number) ?? ""),
        ),
      )
    }
    if (!matches.length && oppositeEta.arrivals.length > 0 && routeNumbers.has("10")) {
      matches = oppositeEta.arrivals.filter((a) => String(a.route_number ?? "").trim() === "10")
    }
    if (!matches.length) return null
    return matches.slice().sort((a, b) => a.eta_minutes - b.eta_minutes)[0]
  }

  const runRouteToBusStop = async (
    destinationStopQuery: string,
    maxTransfers = 3
  ): Promise<string> => {
    if (!stopId || !currentStop) {
      return responseLocale === "ru"
        ? "Текущая остановка киоска не определена."
        : responseLocale === "en"
          ? "Current kiosk stop is unknown."
          : "Киоск аялдамасы анықталмады."
    }

    const cleaned = normalizeDestinationStopQuery(destinationStopQuery)
    if (!cleaned) {
      return responseLocale === "ru"
        ? "Укажите название остановки назначения."
        : responseLocale === "en"
          ? "Please provide the destination stop name."
          : "Баратын аялдама атауын жазыңыз."
    }

    const searchQuery = stripStopQueryStopwords(cleaned)
    let hits = searchStopsForRouting(
      searchQuery || cleaned,
      stopsForContext as StopRoutingRow[],
      6
    )
    hits = refineDestinationSearchHits(
      searchQuery || cleaned,
      hits as StopRoutingRow[]
    )
    if (!hits.length) {
      return responseLocale === "ru"
        ? `Остановка «${cleaned}» не найдена в базе. Проверьте название.`
        : responseLocale === "en"
          ? `Stop "${cleaned}" was not found in the database.`
          : `«${cleaned}» аялдамасы дерекқорда табылмады.`
    }

    const destRow = hits[0]
    const destLabel = stopDisplayName(destRow as StopContextRow, responseLocale)
    const originRoutingId = resolveOriginRoutingStopId(
      currentStop as StopRoutingRow,
      stopsForContext as StopRoutingRow[]
    )
    const destRoutingId = pickDestinationRoutingStopId(
      originRoutingId,
      hits,
      stopsForContext as StopRoutingRow[],
      mvpRoutingContext
    )

    if (originRoutingId === destRoutingId) {
      return responseLocale === "ru"
        ? `Вы уже на остановке «${destLabel}».`
        : responseLocale === "en"
          ? `You are already at "${destLabel}".`
          : `Сіз «${destLabel}» аялдамасындасыз.`
    }

    const serving = stopServedByMvpRoutes(destRoutingId, mvpRoutingContext)
    if (!serving.length) {
      return responseLocale === "ru"
        ? `Остановка «${destLabel}» не обслуживается маршрутами 10, 12, 46.`
        : responseLocale === "en"
          ? `"${destLabel}" is not on routes 10, 12, or 46.`
          : `«${destLabel}» 10, 12, 46 маршруттарында жоқ.`
    }

    const originCandidates = resolveRoutingOriginCandidates(
      originRoutingId,
      currentStop as StopRoutingRow,
      mvpRoutingContext
    )

    type DirectHint = {
      kind: "same" | "opposite"
      routeNums: Set<string>
      crossPlatform: boolean
      hopCost: number
    }
    let bestDirect: DirectHint | null = null

    for (const origin of originCandidates) {
      const dir = getDirectionalRoutesBetween(
        origin.stopId,
        destRoutingId,
        activeRoutes,
        mvpRoutingContext
      )
      const crossPenalty = origin.crossPlatform ? 4 : 0

      const directional = mvpRoutingContext.directionalByRoute
      const boardingStopId = origin.stopId

      const sameReachable = dir.sameSide.filter((r) =>
        isDirectBusRideBetween(
          boardingStopId,
          destRoutingId,
          r.routeNumber,
          directional
        )
      )
      if (sameReachable.length > 0) {
        const hint: DirectHint = {
          kind: "same",
          routeNums: new Set(sameReachable.map((r) => r.routeNumber)),
          crossPlatform: origin.crossPlatform,
          hopCost: crossPenalty,
        }
        if (!bestDirect || hint.hopCost < bestDirect.hopCost) {
          bestDirect = hint
        }
      }

      const oppositeReachable = filterOppositeRoutesWithDirectRide(
        boardingStopId,
        destRoutingId,
        dir.oppositeSide,
        directional
      )
      if (oppositeReachable.length > 0) {
        const hint: DirectHint = {
          kind: "opposite",
          routeNums: new Set(oppositeReachable.map((r) => r.routeNumber)),
          crossPlatform: true,
          hopCost: crossPenalty + 4,
        }
        if (!bestDirect || hint.hopCost < bestDirect.hopCost) {
          bestDirect = hint
        }
      }
    }

    const maxBusLegs = maxTransfers + 1
    const itinerary = planBestItinerary(
      originCandidates,
      destRoutingId,
      mvpRoutingContext.adjacency,
      mvpRoutingContext.directionalByRoute,
      maxBusLegs
    )
    const path = itinerary?.path
    const busLegCount =
      path?.filter((leg) => leg.routeNumber !== WALK_TRANSFER_ROUTE_NUMBER)
        .length ?? 0
    const preferItineraryResponse =
      busLegCount > 1 ||
      (path?.some((leg) => leg.routeNumber === WALK_TRANSFER_ROUTE_NUMBER) ??
        false)

    if (bestDirect?.kind === "same" && !preferItineraryResponse) {
      const routeNums = bestDirect.routeNums
      const next = bestDirect.crossPlatform
        ? await getNextUpcomingAtOppositeStopForRoutes(routeNums)
        : getNextUpcomingForRouteNumbers(routeNums)
      const routeList = [...routeNums]
        .map((n) => formatRouteLabel(responseLocale, n))
        .join(", ")
      const crossNote = bestDirect.crossPlatform
        ? responseLocale === "ru"
          ? "Перейдите на встречную остановку. "
          : responseLocale === "en"
            ? "Cross to the opposite stop. "
            : "Қарсы аялдамаға өтіңіз. "
        : ""
      if (next) {
        return responseLocale === "ru"
          ? `До «${destLabel}»: ${crossNote}сядьте на ${formatRouteLabel(responseLocale, next.route)} (${routeList}). Ближайший автобус через ${formatMinutes(responseLocale, next.minutesAway)}.`
          : responseLocale === "en"
            ? `To "${destLabel}": ${crossNote}take ${formatRouteLabel(responseLocale, next.route)} (${routeList}). Next bus in ${formatMinutes(responseLocale, next.minutesAway)}.`
            : `«${destLabel}» бағытына: ${crossNote}${formatRouteLabel(responseLocale, next.route)} (${routeList}). ${formatMinutes(responseLocale, next.minutesAway)} кейін.`
      }
      return responseLocale === "ru"
        ? `До «${destLabel}» без пересадки: ${crossNote}${routeList}. Ближайших прибытий на этой остановке по этим маршрутам сейчас нет.`
        : responseLocale === "en"
          ? `To "${destLabel}" without transfer: ${crossNote}${routeList}. No upcoming arrivals for these routes at this stop.`
          : `«${destLabel}» бағытына ауысусыз: ${crossNote}${routeList}. Жақын келулер жоқ.`
    }

    if (bestDirect?.kind === "opposite" && !preferItineraryResponse) {
      const routeNums = bestDirect.routeNums
      const oppositeArrival =
        await getNextUpcomingAtOppositeStopForRoutes(routeNums)
      const routeList = [...routeNums]
        .map((n) => formatRouteLabel(responseLocale, n))
        .join(", ")
      if (oppositeArrival) {
        return responseLocale === "ru"
          ? `До «${destLabel}» — обратное направление. Перейдите на встречную остановку, сядьте на ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}. Ближайший автобус через ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)}.`
          : responseLocale === "en"
            ? `To "${destLabel}" — opposite direction. Cross to the opposite stop and take ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}. Next bus in ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)}.`
            : `«${destLabel}» қарсы бағыт. Қарсы аялдамаға өтіп, ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}. ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)} кейін.`
      }
      return responseLocale === "ru"
        ? `До «${destLabel}» — обратное направление (${routeList}). Перейдите на встречную остановку.`
        : responseLocale === "en"
          ? `To "${destLabel}" use the opposite direction (${routeList}). Cross to the opposite stop.`
          : `«${destLabel}» қарсы бағыт (${routeList}). Қарсы аялдамаға өтіңіз.`
    }

    if (!path?.length) {
      return responseLocale === "ru"
        ? `Маршрут до «${destLabel}» на автобусах 10/12/46 с ≤${maxBusLegs} поездками не найден.`
        : responseLocale === "en"
          ? `No itinerary to "${destLabel}" on routes 10/12/46 within ${maxBusLegs} rides.`
          : `«${destLabel}» бағытына ${maxBusLegs} сапар шегінде маршрут табылмады.`
    }

    const byId = new Map(stopsForContext.map((s) => [s.id, s as StopContextRow]))
    const resolveName = (id: string) => {
      const row = byId.get(id)
      return row ? stopDisplayName(row, responseLocale) : id
    }

    const lines = path.map((leg, i) => {
      const fromL = resolveName(leg.fromStopId)
      const toL = resolveName(leg.toStopId)
      const transfer =
        i > 0
          ? responseLocale === "ru"
            ? " (пересадка)"
            : responseLocale === "en"
              ? " (transfer)"
              : " (ауысу)"
          : ""
      if (leg.routeNumber === WALK_TRANSFER_ROUTE_NUMBER) {
        return responseLocale === "ru"
          ? `${i + 1}. Перейдите к остановке «${toL}» (встречная сторона, ~2 мин пешком).`
          : responseLocale === "en"
            ? `${i + 1}. Walk to "${toL}" (opposite platform, ~2 min).`
            : `${i + 1}. «${toL}» аялдамасына жүру (қарсы жақ, ~2 мин).`
      }
      return `${i + 1}. ${formatRouteLabel(responseLocale, leg.routeNumber)}${transfer}: ${fromL} → ${toL}`
    })

    const firstBusLeg = path.find(
      (leg) => leg.routeNumber !== WALK_TRANSFER_ROUTE_NUMBER
    )
    const firstRouteNums = new Set(
      firstBusLeg ? [firstBusLeg.routeNumber] : [path[0].routeNumber]
    )
    const firstEtaRaw = itinerary?.crossPlatform
      ? await getNextUpcomingAtOppositeStopForRoutes(firstRouteNums)
      : getNextUpcomingForRouteNumbers(firstRouteNums)
    const firstEtaRoute =
      firstEtaRaw &&
      ("route" in firstEtaRaw ? firstEtaRaw.route : firstEtaRaw.route_number)
    const firstEtaMinutes =
      firstEtaRaw &&
      ("minutesAway" in firstEtaRaw
        ? firstEtaRaw.minutesAway
        : firstEtaRaw.eta_minutes)
    const etaLine =
      firstEtaRoute != null && firstEtaMinutes != null
        ? responseLocale === "ru"
          ? ` Сейчас ${itinerary?.crossPlatform ? "на встречной остановке" : "с этой остановки"} ${formatRouteLabel(responseLocale, firstEtaRoute)} через ~${formatMinutes(responseLocale, firstEtaMinutes)}.`
          : responseLocale === "en"
            ? ` From ${itinerary?.crossPlatform ? "the opposite stop" : "this stop"} ${formatRouteLabel(responseLocale, firstEtaRoute)} in ~${formatMinutes(responseLocale, firstEtaMinutes)}.`
            : ` ${itinerary?.crossPlatform ? "Қарсы аялдамада" : "Бұл аялдамадан"} ${formatRouteLabel(responseLocale, firstEtaRoute)} ~${formatMinutes(responseLocale, firstEtaMinutes)} кейін.`
        : ""

    const crossPrefix = itinerary?.crossPlatform
      ? responseLocale === "ru"
        ? "Перейдите на встречную остановку. "
        : responseLocale === "en"
          ? "Cross to the opposite stop. "
          : "Қарсы аялдамаға өтіңіз. "
      : ""

    const header =
      path.length === 1
        ? responseLocale === "ru"
          ? `${crossPrefix}До «${destLabel}» (без пересадки):`
          : responseLocale === "en"
            ? `${crossPrefix}To "${destLabel}" (direct):`
            : `${crossPrefix}«${destLabel}» (ауысусыз):`
        : responseLocale === "ru"
          ? `${crossPrefix}До «${destLabel}» с пересадками (автобусы 10, 12, 46):`
          : responseLocale === "en"
            ? `${crossPrefix}To "${destLabel}" with transfers (buses 10, 12, 46):`
            : `${crossPrefix}«${destLabel}» (10, 12, 46, ауысу):`

    return `${header}\n${lines.join("\n")}${etaLine}`
  }

  // Rule-based fallback function for when AI is unavailable
  const generateFallbackAnswer = async (): Promise<string> => {
    const tx = {
      nextBus:
        responseLocale === "ru"
          ? "Следующий автобус"
          : responseLocale === "en"
            ? "The next bus is"
            : "Келесі автобус",
      arrivingIn:
        responseLocale === "ru"
          ? "прибудет через"
          : responseLocale === "en"
            ? "arriving in"
            : "келеді",
      noArrivals:
        responseLocale === "ru"
          ? "Сейчас на этой остановке нет ближайших прибытий."
          : responseLocale === "en"
            ? "There are currently no upcoming arrivals at this stop."
            : "Қазір бұл аялдамада жақын келулер жоқ.",
      generic:
        responseLocale === "ru"
          ? "Я помогу с прибытиями автобусов и маршрутами."
          : responseLocale === "en"
            ? "I'm here to help with bus arrival times and route information."
            : "Автобус келуі мен маршрут туралы көмектесемін.",
      insufficient:
        insufficientDataFallback,
    }
    const questionLower = question.toLowerCase()

    const destinationKey = getDestinationKey(question)
    const destinationId = destinationKey
      ? CANONICAL_DESTINATIONS[destinationKey].id
      : null
    const routeNumber = extractRouteNumber(question)
    const routeDestQuery = extractDestinationStopQueryFromQuestion(question)

    if (destinationKey && destinationId && stopId) {
      // NU has two platforms on route 10; DB route_stops can look "direct" while the correct
      // boardings for the other terminal are only from the opposite platform.
      if (
        destinationKey === "railwayStation" &&
        currentStop &&
        isNazarbayevOutboundPlatformRow(currentStop)
      ) {
        const nuDir = getDirectionalRoutesToDestination(destinationId)
        const oppositeRouteNums =
          nuDir.oppositeSide.length > 0
            ? new Set(
                nuDir.oppositeSide
                  .map((r) => normalizeRouteNumber(r.route_number))
                  .filter((v): v is string => Boolean(v)),
              )
            : new Set<string>(["10"])
        const oppositeArrivalNu =
          await getNextUpcomingAtOppositeStopForRoutes(oppositeRouteNums)
        const oppRouteList =
          nuDir.oppositeSide.length > 0
            ? nuDir.oppositeSide.map((r) => r.route_number).join(", ")
            : [...oppositeRouteNums].join(", ")
        if (oppositeArrivalNu) {
          return responseLocale === "ru"
            ? `Эта остановка в противоположном направлении. Перейдите на встречную остановку и сядьте на автобус ${oppositeArrivalNu.route_number}. Ближайший автобус через ${oppositeArrivalNu.eta_minutes} мин.`
            : responseLocale === "en"
              ? `This destination is in the opposite direction. Cross to the opposite stop and take bus ${oppositeArrivalNu.route_number}. The next bus is in ${oppositeArrivalNu.eta_minutes} minutes.`
              : `Бұл бағыт қарсы жақта. Қарсы беттегі аялдамаға өтіп, ${oppositeArrivalNu.route_number} автобусына отырыңыз. Ең жақын автобус ${oppositeArrivalNu.eta_minutes} минуттан кейін келеді.`
        }
        return responseLocale === "ru"
          ? `Эта остановка в противоположном направлении. Перейдите на встречную остановку и сядьте на автобус ${oppRouteList}, однако ближайших прибытий сейчас нет.`
          : responseLocale === "en"
            ? `This destination is in the opposite direction. Cross to the opposite stop and take bus ${oppRouteList}, however there are no upcoming arrivals.`
            : `Бұл бағыт қарсы жақта. Қарсы беттегі аялдамаға өтіп, ${oppRouteList} автобусына отырыңыз, бірақ жақын келулер қазір жоқ.`
      }
      if (
        destinationKey === "airport" &&
        currentStop &&
        isNazarbayevInboundPlatformRow(currentStop)
      ) {
        const nuDir = getDirectionalRoutesToDestination(destinationId)
        const oppositeRouteNums =
          nuDir.oppositeSide.length > 0
            ? new Set(
                nuDir.oppositeSide
                  .map((r) => normalizeRouteNumber(r.route_number))
                  .filter((v): v is string => Boolean(v)),
              )
            : new Set<string>(["10"])
        const oppositeArrivalNu =
          await getNextUpcomingAtOppositeStopForRoutes(oppositeRouteNums)
        const oppRouteList =
          nuDir.oppositeSide.length > 0
            ? nuDir.oppositeSide.map((r) => r.route_number).join(", ")
            : [...oppositeRouteNums].join(", ")
        if (oppositeArrivalNu) {
          return responseLocale === "ru"
            ? `Эта остановка в противоположном направлении. Перейдите на встречную остановку и сядьте на автобус ${oppositeArrivalNu.route_number}. Ближайший автобус через ${oppositeArrivalNu.eta_minutes} мин.`
            : responseLocale === "en"
              ? `This destination is in the opposite direction. Cross to the opposite stop and take bus ${oppositeArrivalNu.route_number}. The next bus is in ${oppositeArrivalNu.eta_minutes} minutes.`
              : `Бұл бағыт қарсы жақта. Қарсы беттегі аялдамаға өтіп, ${oppositeArrivalNu.route_number} автобусына отырыңыз. Ең жақын автобус ${oppositeArrivalNu.eta_minutes} минуттан кейін келеді.`
        }
        return responseLocale === "ru"
          ? `Эта остановка в противоположном направлении. Перейдите на встречную остановку и сядьте на автобус ${oppRouteList}, однако ближайших прибытий сейчас нет.`
          : responseLocale === "en"
            ? `This destination is in the opposite direction. Cross to the opposite stop and take bus ${oppRouteList}, however there are no upcoming arrivals.`
            : `Бұл бағыт қарсы жақта. Қарсы беттегі аялдамаға өтіп, ${oppRouteList} автобусына отырыңыз, бірақ жақын келулер қазір жоқ.`
      }

      const directional = getDirectionalRoutesToDestination(destinationId)
      const hasDirectionalMatch =
        directional.sameSide.length > 0 || directional.oppositeSide.length > 0
      const directRoutes =
        directional.sameSide.length > 0
          ? directional.sameSide
          : hasDirectionalMatch
            ? []
            : getDirectRoutesToDestination(destinationId)
      const inferredFromArrivals = inferSameSideRouteFromArrivals(
        destinationKey,
        destinationId
      )
      const destinationEta = await getEtaPayload(supabase, destinationId, false, false)
      const directRouteNumbers = new Set<string>(
        directRoutes
          .map((r) => normalizeRouteNumber(r.route_number))
          .filter((v): v is string => Boolean(v))
      )
      const nextAtDestination = destinationEta.arrivals.find((a) =>
        directRouteNumbers.has(normalizeRouteNumber(a.route_number) ?? "")
      )
      const destinationLabel =
        destinationKey === "airport"
          ? responseLocale === "ru"
            ? "аэропорта"
            : responseLocale === "en"
              ? "airport"
              : "әуежай"
          : destinationKey === "martialPalace"
            ? responseLocale === "ru"
              ? "Дворца единоборств"
              : responseLocale === "en"
                ? "Dvorets edinoborstv"
                : "Жекпе-жек сарайы"
            : responseLocale === "ru"
              ? "ЖД вокзала"
              : responseLocale === "en"
                ? "railway station"
                : "теміржол вокзалы"

      if (directional.oppositeSide.length > 0 && directional.sameSide.length === 0) {
        const oppositeRouteSet = new Set<string>(
          directional.oppositeSide
            .map((r) => normalizeRouteNumber(r.route_number))
            .filter((v): v is string => Boolean(v))
        )
        const oppositeRouteList = directional.oppositeSide
          .map((r) => r.route_number)
          .join(", ")
        const oppositeArrival = await getNextUpcomingAtOppositeStopForRoutes(
          oppositeRouteSet
        )
        if (oppositeArrival) {
          return responseLocale === "ru"
            ? `Эта остановка в противоположном направлении. Перейдите на встречную остановку и сядьте на автобус ${oppositeArrival.route_number}. Ближайший автобус через ${oppositeArrival.eta_minutes} мин.`
            : responseLocale === "en"
              ? `This destination is in the opposite direction. Cross to the opposite stop and take bus ${oppositeArrival.route_number}. The next bus is in ${oppositeArrival.eta_minutes} minutes.`
              : `Бұл бағыт қарсы жақта. Қарсы беттегі аялдамаға өтіп, ${oppositeArrival.route_number} автобусына отырыңыз. Ең жақын автобус ${oppositeArrival.eta_minutes} минуттан кейін келеді.`
        }
        return responseLocale === "ru"
          ? `Эта остановка в противоположном направлении. Перейдите на встречную остановку и сядьте на автобус ${oppositeRouteList}, однако ближайших прибытий сейчас нет.`
          : responseLocale === "en"
            ? `This destination is in the opposite direction. Cross to the opposite stop and take bus ${oppositeRouteList}, however there are no upcoming arrivals.`
            : `Бұл бағыт қарсы жақта. Қарсы беттегі аялдамаға өтіп, ${oppositeRouteList} автобусына отырыңыз, бірақ жақын келулер қазір жоқ.`
      }

      if (!directRoutes.length) {
        if (inferredFromArrivals?.route) {
          const inferredMinutes = inferredFromArrivals.minutesAway
          return responseLocale === "ru"
            ? `С этой остановки сядьте на ${formatRouteLabel(responseLocale, inferredFromArrivals.route)} до ${destinationLabel}. Ближайший автобус через ${formatMinutes(responseLocale, inferredMinutes)}.`
            : responseLocale === "en"
              ? `From this stop, take ${formatRouteLabel(responseLocale, inferredFromArrivals.route)} to the ${destinationLabel}. The next bus is in ${formatMinutes(responseLocale, inferredMinutes)}.`
              : `Осы аялдамадан ${destinationLabel} бағытына ${formatRouteLabel(responseLocale, inferredFromArrivals.route)}-қа отырыңыз. Ең жақын автобус ${formatMinutes(responseLocale, inferredMinutes)} кейін келеді.`
        }

        const oppositeRouteList = directional.oppositeSide
          .map((r) => r.route_number)
          .join(", ")

        if (oppositeRouteList) {
          const oppositeRouteSet = new Set<string>(
            directional.oppositeSide
              .map((r) => normalizeRouteNumber(r.route_number))
              .filter((v): v is string => Boolean(v))
          )
          const oppositeArrival = await getNextUpcomingAtOppositeStopForRoutes(
            oppositeRouteSet
          )

          if (oppositeArrival) {
            return responseLocale === "ru"
            ? `Эта остановка в противоположном направлении. Перейдите на встречную остановку и сядьте на ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}. Ближайший автобус через ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)}.`
              : responseLocale === "en"
              ? `This destination is in the opposite direction. Cross to the opposite stop and take ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}. The next bus is in ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)}.`
              : `Бұл бағыт қарсы жақта. Қарсы беттегі аялдамаға өтіп, ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}-қа отырыңыз. Ең жақын автобус ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)} кейін келеді.`
          }

          return responseLocale === "ru"
            ? `Эта остановка в противоположном направлении. Перейдите на встречную остановку и сядьте на автобус ${oppositeRouteList}, однако ближайших прибытий сейчас нет.`
            : responseLocale === "en"
              ? `This destination is in the opposite direction. Cross to the opposite stop and take bus ${oppositeRouteList}, however there are no upcoming arrivals.`
              : `Бұл бағыт қарсы жақта. Қарсы беттегі аялдамаға өтіп, ${oppositeRouteList} автобусына отырыңыз, бірақ жақын келулер қазір жоқ.`
        }

        return responseLocale === "ru"
          ? `С этой стороны нет прямого маршрута до ${destinationLabel}. Перейдите на противоположную остановку или проверьте пересадки в основном приложении.`
          : responseLocale === "en"
            ? `There is no direct route from this side to the ${destinationLabel}. Cross to the opposite stop or check transfers in the main app.`
            : `Осы бағыттан ${destinationLabel} бағытына тікелей маршрут жоқ. Қарсы беттегі аялдамаға өтіңіз немесе негізгі қолданбадан ауысуды тексеріңіз.`
      }

      const routeList = directRoutes.map((r) => r.route_number).join(", ")
      const nextAtCurrentStop = getNextUpcomingForRouteNumbers(directRouteNumbers)
      if (nextAtCurrentStop) {
        return responseLocale === "ru"
          ? `С этой остановки сядьте на ${formatRouteLabel(responseLocale, nextAtCurrentStop.route)} до ${destinationLabel}. Ближайший автобус через ${formatMinutes(responseLocale, nextAtCurrentStop.minutesAway)}.`
          : responseLocale === "en"
            ? `From this stop, take ${formatRouteLabel(responseLocale, nextAtCurrentStop.route)} to the ${destinationLabel}. The next bus is in ${formatMinutes(responseLocale, nextAtCurrentStop.minutesAway)}.`
            : `Осы аялдамадан ${destinationLabel} бағытына ${formatRouteLabel(responseLocale, nextAtCurrentStop.route)}-қа отырыңыз. Ең жақын автобус ${formatMinutes(responseLocale, nextAtCurrentStop.minutesAway)} кейін келеді.`
      }
      if (nextAtDestination) {
        return responseLocale === "ru"
          ? `До ${destinationLabel} можно доехать на маршруте(ах): ${routeList}. Ближайшее прибытие по этим маршрутам: примерно через ${nextAtDestination.eta_minutes} мин.`
          : responseLocale === "en"
            ? `You can reach the ${destinationLabel} using route(s): ${routeList}. The next arrival on these routes is in about ${nextAtDestination.eta_minutes} minutes.`
            : `${destinationLabel} бағытына ${routeList} маршрут(тар)ымен жете аласыз. Осы маршруттар бойынша келесі келу шамамен ${nextAtDestination.eta_minutes} минуттан кейін.`
      }
      return responseLocale === "ru"
        ? `С этой остановки сядьте на автобус ${routeList} до ${destinationLabel}, однако ближайших прибытий сейчас нет.`
        : responseLocale === "en"
          ? `From this stop, take bus ${routeList} to the ${destinationLabel}, however there are no upcoming arrivals.`
          : `Осы аялдамадан ${destinationLabel} бағытына ${routeList} автобусына отырыңыз, бірақ жақын келулер қазір жоқ.`
    }

    if (routeDestQuery && stopId && currentStop) {
      return runRouteToBusStop(routeDestQuery)
    }

    // Next arrival queries (EN + RU + KK keywords; KK must come before broad "автобус" route branch below)
    if (
      questionLower.includes("next") ||
      questionLower.includes("when") ||
      questionLower.includes("когда") ||
      questionLower.includes("первый") ||
      questionLower.includes("приедет") ||
      questionLower.includes("қашан") ||
      questionLower.includes("келесі") ||
      questionLower.includes("келеді") ||
      questionLower.includes("жақын келу") ||
      questionLower.includes("қай кезде") ||
      questionLower.includes("qashan") ||
      questionLower.includes("kelesi") ||
      questionLower.includes("keledi")
    ) {
      if (routeNumber) {
        const arrivalForRoute = upcomingArrivals?.find(
          (a) => normalizeRouteNumber(a.route) === routeNumber
        )
        if (arrivalForRoute) {
          return `${tx.nextBus} ${arrivalForRoute.route} (${arrivalForRoute.routeName}), ${tx.arrivingIn} ${arrivalForRoute.minutesAway} min.`
        }
      }
      if (upcomingArrivals?.length) {
        const next = upcomingArrivals[0]
        return responseLocale === "ru"
          ? `${formatRouteLabel(responseLocale, next.route)} прибудет через ${formatMinutes(responseLocale, next.minutesAway)}.`
          : responseLocale === "en"
            ? `${formatRouteLabel(responseLocale, next.route)} arrives in ${formatMinutes(responseLocale, next.minutesAway)}.`
            : `${formatRouteLabel(responseLocale, next.route)} ${formatMinutes(responseLocale, next.minutesAway)} кейін келеді.`
      }
      return tx.noArrivals
    }
    
    // Route information / "when will route X arrive" queries (not generic "bus + when" — handled above)
    if (
      routes?.length &&
      (questionLower.includes("route") ||
        questionLower.includes("маршрут") ||
        (questionLower.includes("автобус") &&
          !questionLower.includes("қашан") &&
          !questionLower.includes("келеді") &&
          !questionLower.includes("когда") &&
          !questionLower.includes("when") &&
          !questionLower.includes("next") &&
          !questionLower.includes("qashan") &&
          !questionLower.includes("keledi")))
    ) {
      // Try to extract a route number like "12" from the question
      if (routeNumber) {
        const routeNum = routeNumber.toUpperCase()
        const route = routes.find(
          (r) => normalizeRouteNumber(r.route_number)?.toUpperCase() === routeNum
        )

        // If we also have upcoming arrivals, try to answer "when will 12 arrive?"
        const arrivalForRoute = upcomingArrivals?.find(
          (a) => normalizeRouteNumber(a.route)?.toUpperCase() === routeNum
        )
        if (arrivalForRoute) {
          return responseLocale === "ru"
            ? `${formatRouteLabel(responseLocale, arrivalForRoute.route)} прибудет через ${formatMinutes(responseLocale, arrivalForRoute.minutesAway)}.`
            : responseLocale === "en"
              ? `${formatRouteLabel(responseLocale, arrivalForRoute.route)} arrives in ${formatMinutes(responseLocale, arrivalForRoute.minutesAway)}.`
              : `${formatRouteLabel(responseLocale, arrivalForRoute.route)} ${formatMinutes(responseLocale, arrivalForRoute.minutesAway)} кейін келеді.`
        }

        if (route) {
          return responseLocale === "ru"
            ? `${formatRouteLabel(responseLocale, route.route_number)}. Направление: ${normalizeRouteDisplayName(route.route_name)}. Статус: ${route.is_active ? "активен" : "неактивен"}.`
            : responseLocale === "en"
              ? `${formatRouteLabel(responseLocale, route.route_number)}. Direction: ${normalizeRouteDisplayName(route.route_name)}. Status: ${route.is_active ? "active" : "inactive"}.`
              : `${formatRouteLabel(responseLocale, route.route_number)}. Бағыт: ${normalizeRouteDisplayName(route.route_name)}. Күйі: ${route.is_active ? "белсенді" : "белсенді емес"}.`
        }
        return responseLocale === "ru"
          ? `Для маршрута ${routeNum} сейчас нет данных о ближайшем прибытии.`
          : responseLocale === "en"
            ? `There is currently no nearby arrival data for route ${routeNum}.`
            : `${routeNum} маршруты үшін жақын келу деректері қазір жоқ.`
      }
      return responseLocale === "ru"
        ? `Доступные маршруты: ${routes.slice(0, 5).map((r) => r.route_number).join(", ")}.`
        : responseLocale === "en"
          ? `Available routes: ${routes.slice(0, 5).map((r) => r.route_number).join(", ")}.`
          : `Қолжетімді маршруттар: ${routes.slice(0, 5).map((r) => r.route_number).join(", ")}.`
    }
    
    // Alert queries
    if (questionLower.includes("alert") || questionLower.includes("delay") || questionLower.includes("running")) {
      if (alerts?.length) {
        return responseLocale === "ru"
          ? `Активных предупреждений: ${alerts.length}. ${alerts.slice(0, 2).map((a) => a.title).join(", ")}.`
          : responseLocale === "en"
            ? `There are ${alerts.length} active alerts: ${alerts.slice(0, 2).map((a) => a.title).join(", ")}.`
            : `Белсенді ескертулер саны: ${alerts.length}. ${alerts.slice(0, 2).map((a) => a.title).join(", ")}.`
      }
      return responseLocale === "ru"
        ? "Сейчас активных транспортных предупреждений нет."
        : responseLocale === "en"
          ? "There are no active service alerts at this time."
          : "Қазір белсенді көлік ескертулері жоқ."
    }
    
    // List all arrivals
    if (questionLower.includes("list") || questionLower.includes("all buses")) {
      if (upcomingArrivals?.length) {
        return `Upcoming arrivals:\n${upcomingArrivals
          .slice(0, 4)
          .map((a) => `• Route ${a.route}: ${a.minutesAway} min`)
          .join("\n")}`
      }
      return responseLocale === "ru"
        ? "На этой остановке нет ближайших прибытий."
        : responseLocale === "en"
          ? "There are no upcoming arrivals at this stop."
          : "Бұл аялдамада жақын келулер жоқ."
    }
    
    // Default response
    return `${tx.generic} ${stopName || "this stop"}: ${
      upcomingArrivals?.length
        ? `${formatRouteLabel(responseLocale, upcomingArrivals[0].route)} ${tx.arrivingIn} ${formatMinutes(responseLocale, upcomingArrivals[0].minutesAway)}`
        : tx.insufficient
    }`
  }

  const canonicalDestinationKey = getDestinationKey(question)
  if (canonicalDestinationKey && stopId) {
    const answer = await generateFallbackAnswer()
    const responseTime = Date.now() - startTime
    await supabase.from("ai_query_logs").insert({
      stop_id: stopId || null,
      question,
      answer,
      intent: "route_query",
      confidence: 0.97,
      response_time_ms: responseTime,
      was_successful: true,
    })
    return Response.json({
      answer,
      intent: "route_query",
      responseTime,
      routed: true,
    })
  }

  const routeDestQuery = extractDestinationStopQueryFromQuestion(question)
  if (routeDestQuery && stopId && currentStop) {
    const answer = await runRouteToBusStop(routeDestQuery)
    const responseTime = Date.now() - startTime
    await supabase.from("ai_query_logs").insert({
      stop_id: stopId || null,
      question,
      answer,
      intent: "route_query",
      confidence: 0.95,
      response_time_ms: responseTime,
      was_successful: true,
    })
    return Response.json({
      answer,
      intent: "route_query",
      responseTime,
      routed: true,
    })
  }

  try {
    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      prompt: question,
      maxSteps: 8,
      tools: {
        getNextArrival: tool({
          description: "Get the next bus arrival at the current stop",
          inputSchema: z.object({
            routeNumber: z.string().optional().describe("Specific route number to check"),
          }),
          execute: async ({ routeNumber }) => {
            if (routeNumber) {
              const arrival = upcomingArrivals?.find(
                (a) => a.route?.toLowerCase() === routeNumber.toLowerCase()
              )
              if (arrival) {
                return responseLocale === "ru"
                  ? `${formatRouteLabel(responseLocale, arrival.route)} прибудет через ${formatMinutes(responseLocale, arrival.minutesAway)}.`
                  : responseLocale === "en"
                    ? `${formatRouteLabel(responseLocale, arrival.route)} arrives in ${formatMinutes(responseLocale, arrival.minutesAway)}.`
                    : `${formatRouteLabel(responseLocale, arrival.route)} ${formatMinutes(responseLocale, arrival.minutesAway)} кейін келеді.`
              }
              return responseLocale === "ru"
                ? `Для ${formatRouteLabel(responseLocale, routeNumber)} на этой остановке нет ближайших прибытий.`
                : responseLocale === "en"
                  ? `No upcoming arrivals for ${formatRouteLabel(responseLocale, routeNumber)} at this stop.`
                  : `Бұл аялдамада ${formatRouteLabel(responseLocale, routeNumber)} үшін жақын келулер жоқ.`
            }
            if (upcomingArrivals?.length) {
              const next = upcomingArrivals[0]
              return responseLocale === "ru"
                ? `${formatRouteLabel(responseLocale, next.route)} прибудет через ${formatMinutes(responseLocale, next.minutesAway)}.`
                : responseLocale === "en"
                  ? `${formatRouteLabel(responseLocale, next.route)} arrives in ${formatMinutes(responseLocale, next.minutesAway)}.`
                  : `${formatRouteLabel(responseLocale, next.route)} ${formatMinutes(responseLocale, next.minutesAway)} кейін келеді.`
            }
            return responseLocale === "ru"
              ? "На этой остановке нет ближайших прибытий."
              : responseLocale === "en"
                ? "No upcoming arrivals at this stop."
                : "Бұл аялдамада жақын келулер жоқ."
          },
        }),
        getRouteInfo: tool({
          description: "Get information about a specific route",
          inputSchema: z.object({
            routeNumber: z.string().describe("The route number to get info about"),
          }),
          execute: async ({ routeNumber }) => {
            const normalized = normalizeRouteNumber(routeNumber)?.toLowerCase()
            const route = routes?.find(
              (r) =>
                normalizeRouteNumber(r.route_number)?.toLowerCase() === normalized
            )
            if (route) {
              return responseLocale === "ru"
                ? `${formatRouteLabel(responseLocale, route.route_number)}. Направление: ${normalizeRouteDisplayName(route.route_name)}. Статус: ${route.is_active ? "активен" : "неактивен"}.`
                : responseLocale === "en"
                  ? `${formatRouteLabel(responseLocale, route.route_number)}. Direction: ${normalizeRouteDisplayName(route.route_name)}. Status: ${route.is_active ? "active" : "inactive"}.`
                  : `${formatRouteLabel(responseLocale, route.route_number)}. Бағыт: ${normalizeRouteDisplayName(route.route_name)}. Күйі: ${route.is_active ? "белсенді" : "белсенді емес"}.`
            }
            return responseLocale === "ru"
              ? `${formatRouteLabel(responseLocale, routeNumber)} не найден.`
              : responseLocale === "en"
                ? `${formatRouteLabel(responseLocale, routeNumber)} not found.`
                : `${formatRouteLabel(responseLocale, routeNumber)} табылмады.`
          },
        }),
        searchStops: tool({
          description:
            "Find bus stops by name, stop_code, address fragment, or zone. Returns UUID ids for other tools.",
          inputSchema: z.object({
            query: z.string().describe("Search text from the passenger"),
            limit: z
              .number()
              .int()
              .min(1)
              .max(20)
              .optional()
              .describe("Max results (default 8)"),
          }),
          execute: async ({ query, limit }) => {
            const lim = limit ?? 8
            const cleaned = normalizeDestinationStopQuery(query) || query
            const hits = searchStopsForRouting(
              cleaned,
              stopsForContext as StopRoutingRow[],
              lim
            )
            if (!hits.length) {
              return responseLocale === "ru"
                ? "Остановки не найдены."
                : responseLocale === "en"
                  ? "No stops matched."
                  : "Аялдамалар табылмады."
            }
            return hits
              .map((s) => {
                const label = stopDisplayName(s, responseLocale)
                return `- ${label} | id=${s.id} | code=${s.stop_code}`
              })
              .join("\n")
          },
        }),
        getStopDetails: tool({
          description:
            "Shelter, zone, address, and identifiers for one stop (use id from searchStops).",
          inputSchema: z.object({
            stopIdOrCode: z.string().describe("Stop UUID or stop_code"),
          }),
          execute: async ({ stopIdOrCode }) => {
            const s = resolveStopRef(stopIdOrCode, stopsForContext as StopContextRow[])
            if (!s) {
              return responseLocale === "ru"
                ? "Остановка не найдена в активном списке."
                : responseLocale === "en"
                  ? "Stop not found in active list."
                  : "Белсенді тізімде аялдама табылмады."
            }
            const label = stopDisplayName(s, responseLocale)
            return responseLocale === "ru"
              ? `${label} (${s.stop_code}). Зона: ${s.zone ?? "—"}. Адрес: ${s.address ?? "—"}. Навес: ${s.has_shelter ? "да" : "нет"}. id=${s.id}`
              : responseLocale === "en"
                ? `${label} (${s.stop_code}). Zone: ${s.zone ?? "—"}. Address: ${s.address ?? "—"}. Shelter: ${s.has_shelter ? "yes" : "no"}. id=${s.id}`
                : `${label} (${s.stop_code}). Аудан: ${s.zone ?? "—"}. Мекенжай: ${s.address ?? "—"}. Қауіпсіз пана: ${s.has_shelter ? "иә" : "жоқ"}. id=${s.id}`
          },
        }),
        getRoutesAtStop: tool({
          description: "Route numbers that serve this stop (from route_stops).",
          inputSchema: z.object({
            stopId: z.string().describe("Stop UUID"),
          }),
          execute: async ({ stopId }) => {
            const s = resolveStopRef(stopId, stopsForContext as StopContextRow[])
            if (!s) {
              return responseLocale === "ru"
                ? "Остановка не найдена."
                : responseLocale === "en"
                  ? "Stop not found."
                  : "Аялдама табылмады."
            }
            const nums = new Set<string>()
            for (const [routeId, seq] of groupedSortedRouteStops.entries()) {
              if (seq.some((x) => x.stop_id === s.id)) {
                const meta = routeMetaById.get(routeId)
                if (meta) nums.add(meta.route_number)
              }
            }
            if (!nums.size) {
              return responseLocale === "ru"
                ? "Маршруты не найдены."
                : responseLocale === "en"
                  ? "No routes found."
                  : "Маршруттар табылмады."
            }
            return [...nums].sort().join(", ")
          },
        }),
        getNearbyStops: tool({
          description:
            "Other stops within walking distance (straight-line meters; not walking directions).",
          inputSchema: z.object({
            stopId: z.string().describe("Center stop UUID"),
            radiusMeters: z.number().min(50).max(5000).optional(),
            limit: z.number().int().min(1).max(15).optional(),
          }),
          execute: async ({ stopId, radiusMeters, limit }) => {
            const center = resolveStopRef(stopId, stopsForContext as StopContextRow[])
            const R = radiusMeters ?? 500
            const lim = limit ?? 8
            if (!center) {
              return responseLocale === "ru"
                ? "Остановка не найдена."
                : responseLocale === "en"
                  ? "Stop not found."
                  : "Аялдама табылмады."
            }
            const others = stopsForContext
              .filter((x) => x.id !== center.id)
              .map((x) => ({
                x,
                d: haversineM(center.latitude, center.longitude, x.latitude, x.longitude),
              }))
              .filter((o) => o.d <= R)
              .sort((a, b) => a.d - b.d)
              .slice(0, lim)
            if (!others.length) {
              return responseLocale === "ru"
                ? "Рядом других остановок нет."
                : responseLocale === "en"
                  ? "No other stops within radius."
                  : "Радиуста басқа аялдамалар жоқ."
            }
            return others
              .map(
                (o) =>
                  `- ${stopDisplayName(o.x as StopContextRow, responseLocale)} (~${Math.round(o.d)} m) | id=${o.x.id}`
              )
              .join("\n")
          },
        }),
        getNearestStopsToLandmark: tool({
          description:
            "Curated Astana/Nur-Sultan landmarks (e.g. Bayterek, Khan Shatyr, Opera) without matching stop names: returns real bus stops closest to the landmark with approximate straight-line walking meters. Use before routing when searchStops fails or names diverge.",
          inputSchema: z.object({
            placeQuery: z
              .string()
              .describe(
                "Place name only or short phrase (e.g. Байтерек, Bayterek, Khan Shatyr)"
              ),
            limit: z.number().int().min(1).max(12).optional(),
          }),
          execute: async ({ placeQuery, limit }) => {
            const lm = findLandmarkByQuery(placeQuery)
            if (!lm) {
              return responseLocale === "ru"
                ? "Место не найдено в справочнике достопримечательностей. Попробуйте searchStops по названию остановки или уточните название."
                : responseLocale === "en"
                  ? "Landmark not in curated list. Try searchStops for a stop name or clarify the place."
                  : "Бұл жер белгіленген тізімде жоқ. Аялдама атауы бойынша searchStops қолданыңыз немесе орынды нақтылаңыз."
            }
            const lim = limit ?? 6
            const label = landmarkDisplayName(lm, responseLocale)
            const ranked = stopsForContext
              .filter(
                (s) =>
                  typeof s.latitude === "number" &&
                  typeof s.longitude === "number" &&
                  !Number.isNaN(s.latitude) &&
                  !Number.isNaN(s.longitude)
              )
              .map((s) => ({
                s,
                d: haversineM(lm.lat, lm.lng, s.latitude, s.longitude),
              }))
              .sort((a, b) => a.d - b.d)
              .slice(0, lim)

            if (!ranked.length) {
              return responseLocale === "ru"
                ? `Ориентир «${label}» распознан, но нет остановок с координатами в текущем контексте.`
                : responseLocale === "en"
                  ? `Landmark "${label}" matched but no stops with coordinates in context.`
                  : `«${label}» табылды, бірақ контекстте координаталы аялдамалар жоқ.`
            }

            const header =
              responseLocale === "ru"
                ? `Ориентир: ${label}. Расстояние до остановок — по прямой на карте (реальный путь пешком может быть дольше). Выходите у ближайшей и дойдите пешком:`
                : responseLocale === "en"
                  ? `Landmark: ${label}. Distances are straight-line on the map (walking may be longer). Alight at nearest stop, then walk:`
                  : `Бағдар: ${label}. Қашықтық карталық түзу сызық бойынша (жаяу жол ұзақ болуы мүмкін). Ең жақын аялдамада түсіңіз:`

            const lines = ranked.map(
              ({ s, d }) =>
                `- ${stopDisplayName(s as StopContextRow, responseLocale)} (${s.stop_code}) ~${Math.round(d)} m approx. walk | id=${s.id}`
            )
            return `${header}\n${lines.join("\n")}`
          },
        }),
        getStopsOnRoute: tool({
          description: "Ordered stops along one route (database sequence).",
          inputSchema: z.object({
            routeNumber: z.string(),
            limit: z.number().int().min(1).max(80).optional(),
          }),
          execute: async ({ routeNumber, limit }) => {
            const normalized = normalizeRouteNumber(routeNumber)?.toLowerCase()
            const route = activeRoutes.find(
              (r) => normalizeRouteNumber(r.route_number)?.toLowerCase() === normalized
            )
            if (!route) {
              return responseLocale === "ru"
                ? "Маршрут не найден."
                : responseLocale === "en"
                  ? "Route not found."
                  : "Маршрут табылмады."
            }
            const seq = groupedSortedRouteStops.get(route.id) ?? []
            const lim = limit ?? 40
            const lines: string[] = []
            let n = 0
            for (const row of seq) {
              if (n >= lim) break
              const st = resolveStopRef(row.stop_id, stopsForContext as StopContextRow[])
              if (st) {
                lines.push(
                  `${row.stop_sequence}. ${stopDisplayName(st, responseLocale)} (${st.stop_code}) | ${st.id}`
                )
                n++
              }
            }
            if (!lines.length) {
              return responseLocale === "ru"
                ? "Нет остановок для маршрута."
                : responseLocale === "en"
                  ? "No stops listed for route."
                  : "Маршрут үшін аялдамалар жоқ."
            }
            return lines.join("\n")
          },
        }),
        getRouteSchedule: tool({
          description:
            "Planned departure times from the schedules table. day_of_week: 0=Sunday … 6=Saturday if your data follows JS convention.",
          inputSchema: z.object({
            routeNumber: z.string(),
            dayOfWeek: z.number().int().min(0).max(6).optional(),
            limit: z.number().int().min(1).max(40).optional(),
          }),
          execute: async ({ routeNumber, dayOfWeek, limit }) => {
            const normalized = normalizeRouteNumber(routeNumber)?.toLowerCase()
            const route = activeRoutes.find(
              (r) => normalizeRouteNumber(r.route_number)?.toLowerCase() === normalized
            )
            if (!route) {
              return responseLocale === "ru"
                ? "Маршрут не найден."
                : responseLocale === "en"
                  ? "Route not found."
                  : "Маршрут табылмады."
            }
            const { data, error } = await supabase
              .from("schedules")
              .select("day_of_week, departure_time")
              .eq("route_id", route.id)
              .eq("is_active", true)
              .order("day_of_week", { ascending: true })
              .order("departure_time", { ascending: true })
            if (error) {
              return responseLocale === "ru"
                ? "Не удалось загрузить расписание."
                : responseLocale === "en"
                  ? "Could not load schedule."
                  : "Кестені жүктеу мүмкін болмады."
            }
            let rows = data ?? []
            if (dayOfWeek !== undefined) {
              rows = rows.filter((sch) => sch.day_of_week === dayOfWeek)
            }
            const lim = limit ?? 24
            rows = rows.slice(0, lim)
            if (!rows.length) {
              return responseLocale === "ru"
                ? "В базе нет строк расписания для этого маршрута."
                : responseLocale === "en"
                  ? "No timetable rows in database for this route."
                  : "Осы маршрут үшін дерекқорда кесте жолдары жоқ."
            }
            return rows.map((sch) => `day ${sch.day_of_week}: ${sch.departure_time}`).join("\n")
          },
        }),
        getDirectRoutesBetweenStops: tool({
          description:
            "Routes where the passenger can stay on one bus from fromStop to toStop following database stop order (no transfer).",
          inputSchema: z.object({
            fromStopId: z.string(),
            toStopId: z.string(),
          }),
          execute: async ({ fromStopId, toStopId }) => {
            const from = resolveStopRef(fromStopId, stopsForContext as StopContextRow[])
            const to = resolveStopRef(toStopId, stopsForContext as StopContextRow[])
            if (!from || !to) {
              return responseLocale === "ru"
                ? "Одна или обе остановки не найдены."
                : responseLocale === "en"
                  ? "One or both stops not found."
                  : "Бір немесе екі аялдама табылмады."
            }
            const dirs = directRoutesBetweenStopsDb(
              from.id,
              to.id,
              groupedSortedRouteStops,
              routeMetaById
            )
            if (!dirs.length) {
              return responseLocale === "ru"
                ? "Нет прямого маршрута по порядку остановок в базе (проверьте пересадки через planTransitBetweenStops)."
                : responseLocale === "en"
                  ? "No single-route connection in database order (try planTransitBetweenStops for transfers)."
                  : "Дерекқор реті бойынша тікелей маршрут жоқ (ауысу үшін planTransitBetweenStops қолданыңыз)."
            }
            return dirs
              .map((d) => `${formatRouteLabel(responseLocale, d.routeNumber)} — ${d.routeName}`)
              .join("\n")
          },
        }),
        planTransitBetweenStops: tool({
          description:
            "Minimum number of bus rides between stops. Each leg may pass intermediate stops on that route.",
          inputSchema: z.object({
            originStopId: z.string(),
            destinationStopId: z.string(),
            maxTransfers: z
              .number()
              .int()
              .min(0)
              .max(5)
              .optional()
              .describe(
                "Maximum transfers; number of rides allowed is maxTransfers + 1 (default maxTransfers=3)"
              ),
          }),
          execute: async ({ originStopId, destinationStopId, maxTransfers }) => {
            const from = resolveStopRef(originStopId, stopsForContext as StopContextRow[])
            const to = resolveStopRef(destinationStopId, stopsForContext as StopContextRow[])
            if (!from || !to) {
              return responseLocale === "ru"
                ? "Одна или обе остановки не найдены."
                : responseLocale === "en"
                  ? "One or both stops not found."
                  : "Бір немесе екі аялдама табылмады."
            }
            const mt = maxTransfers ?? 3
            const maxLegs = mt + 1
            const fromRouting = resolveStopIdForRouting(
              from,
              stopsForContext as StopRoutingRow[],
              mvpRoutingContext
            )
            const toRouting = resolveStopIdForRouting(
              to,
              stopsForContext as StopRoutingRow[],
              mvpRoutingContext
            )
            const path = planFewestRides(
              fromRouting,
              toRouting,
              mvpRoutingContext.adjacency,
              maxLegs
            )
            if (!path) {
              return responseLocale === "ru"
                ? `Маршрут не найден за ≤${maxLegs} поездок (попробуйте другие остановки или увеличьте maxTransfers).`
                : responseLocale === "en"
                  ? `No itinerary within ${maxLegs} rides (try different stops or increase maxTransfers).`
                  : `${maxLegs} сапардан аспайтын бағыт табылмады.`
            }
            if (path.length === 0) {
              return responseLocale === "ru"
                ? "Начальная и конечная остановки совпадают."
                : responseLocale === "en"
                  ? "Origin and destination are the same stop."
                  : "Бастапқы және соңғы аялдамалар бірдей."
            }
            const byId = new Map(
              stopsForContext.map((s) => [s.id, s as StopContextRow])
            )
            return path
              .map((leg, i) => {
                const a = byId.get(leg.fromStopId)
                const b = byId.get(leg.toStopId)
                const fromL = a ? stopDisplayName(a, responseLocale) : leg.fromStopId
                const toL = b ? stopDisplayName(b, responseLocale) : leg.toStopId
                return `${i + 1}. ${formatRouteLabel(responseLocale, leg.routeNumber)} (${normalizeRouteDisplayName(leg.routeName)}): ${fromL} → ${toL}`
              })
              .join("\n")
          },
        }),
        getRouteToBusStop: tool({
          description:
            "How to reach any bus stop in the database from the current kiosk stop. Uses routes 10, 12, 46 with direct rides or transfers. Primary tool for 'how to get to stop X' / 'как доехать до остановки …' (e.g. Звезда Астаны, Stella Zvezda).",
          inputSchema: z.object({
            destinationStopQuery: z
              .string()
              .describe("Destination stop name or phrase from the passenger question"),
            maxTransfers: z.number().int().min(0).max(4).optional(),
          }),
          execute: async ({ destinationStopQuery, maxTransfers }) =>
            runRouteToBusStop(destinationStopQuery, maxTransfers ?? 3),
        }),
        getEtaForStop: tool({
          description:
            "Upcoming arrivals at another stop (same ETA engine as the kiosk board).",
          inputSchema: z.object({
            stopId: z.string(),
            limit: z.number().int().min(1).max(15).optional(),
          }),
          execute: async ({ stopId, limit }) => {
            const s = resolveStopRef(stopId, stopsForContext as StopContextRow[])
            if (!s) {
              return responseLocale === "ru"
                ? "Остановка не найдена."
                : responseLocale === "en"
                  ? "Stop not found."
                  : "Аялдама табылмады."
            }
            try {
              const eta = await getEtaPayload(supabase, s.id, false, false)
              const lim = limit ?? 8
              const arrivals = (eta.arrivals ?? []).slice(0, lim)
              if (!arrivals.length) {
                return responseLocale === "ru"
                  ? `Нет ближайших прибытий на ${stopDisplayName(s, responseLocale)}.`
                  : responseLocale === "en"
                    ? `No upcoming arrivals at ${stopDisplayName(s, responseLocale)}.`
                    : `${stopDisplayName(s, responseLocale)} үшін жақын келулер жоқ.`
              }
              return arrivals
                .map(
                  (a) =>
                    `${formatRouteLabel(responseLocale, a.route_number)} (${normalizeRouteDisplayName(a.route_name)}): ~${a.eta_minutes} min`
                )
                .join("\n")
            } catch {
              return responseLocale === "ru"
                ? "Не удалось получить ETA."
                : responseLocale === "en"
                  ? "Could not load ETA."
                  : "ETA алу мүмкін болмады."
            }
          },
        }),
        getDestinationRoute: tool({
          description:
            "Get direct routes and ETA to airport or railway station. Kazakh cues: әуежай / халықаралық әуежай → airport; теміржол вокзалы / вокзал (train context) → railway_station.",
          inputSchema: z.object({
            destination: z.enum(["airport", "railway_station", "martial_palace"]),
          }),
          execute: async ({ destination }) => {
            if (!stopId) {
              return responseLocale === "ru"
                ? "Текущая остановка не определена."
                : responseLocale === "en"
                  ? "Current stop is unknown."
                  : "Ағымдағы аялдама анықталмады."
            }

            const destinationStopId =
              destination === "airport"
                ? CANONICAL_DESTINATIONS.airport.id
                : destination === "martial_palace"
                  ? CANONICAL_DESTINATIONS.martialPalace.id
                  : CANONICAL_DESTINATIONS.railwayStation.id

            if (
              destination === "railway_station" &&
              currentStop &&
              isNazarbayevOutboundPlatformRow(currentStop)
            ) {
              const nuDir = getDirectionalRoutesToDestination(destinationStopId)
              const oppositeRouteNums =
                nuDir.oppositeSide.length > 0
                  ? new Set(
                      nuDir.oppositeSide
                        .map((r) => normalizeRouteNumber(r.route_number))
                        .filter((v): v is string => Boolean(v)),
                    )
                  : new Set<string>(["10"])
              const oppositeArrivalNu =
                await getNextUpcomingAtOppositeStopForRoutes(oppositeRouteNums)
              const oppRouteList =
                nuDir.oppositeSide.length > 0
                  ? nuDir.oppositeSide.map((r) => r.route_number).join(", ")
                  : [...oppositeRouteNums].join(", ")
              if (oppositeArrivalNu) {
                return responseLocale === "ru"
                  ? `Нужно ехать с противоположной стороны. Перейдите на встречную остановку и сядьте на автобус ${oppositeArrivalNu.route_number}. Ближайший автобус через ${formatMinutes(responseLocale, oppositeArrivalNu.eta_minutes)}.`
                  : responseLocale === "en"
                    ? `Opposite side required. Cross to the opposite stop and take bus ${oppositeArrivalNu.route_number}. The next bus is in ${formatMinutes(responseLocale, oppositeArrivalNu.eta_minutes)}.`
                    : `Қарсы бағыт қажет. Қарсы беттегі аялдамаға өтіп, ${oppositeArrivalNu.route_number} автобусына отырыңыз. Ең жақын автобус ${formatMinutes(responseLocale, oppositeArrivalNu.eta_minutes)} кейін келеді.`
              }
              return responseLocale === "ru"
                ? `Нужно ехать с противоположной стороны. Перейдите на встречную остановку и сядьте на автобус ${oppRouteList}, однако ближайших прибытий сейчас нет.`
                : responseLocale === "en"
                  ? `Opposite side required. Cross to the opposite stop and take bus ${oppRouteList}, however there are no upcoming arrivals.`
                  : `Қарсы бағыт қажет. Қарсы беттегі аялдамаға өтіп, ${oppRouteList} автобусына отырыңыз, бірақ жақын келулер қазір жоқ.`
            }
            if (
              destination === "airport" &&
              currentStop &&
              isNazarbayevInboundPlatformRow(currentStop)
            ) {
              const nuDir = getDirectionalRoutesToDestination(destinationStopId)
              const oppositeRouteNums =
                nuDir.oppositeSide.length > 0
                  ? new Set(
                      nuDir.oppositeSide
                        .map((r) => normalizeRouteNumber(r.route_number))
                        .filter((v): v is string => Boolean(v)),
                    )
                  : new Set<string>(["10"])
              const oppositeArrivalNu =
                await getNextUpcomingAtOppositeStopForRoutes(oppositeRouteNums)
              const oppRouteList =
                nuDir.oppositeSide.length > 0
                  ? nuDir.oppositeSide.map((r) => r.route_number).join(", ")
                  : [...oppositeRouteNums].join(", ")
              if (oppositeArrivalNu) {
                return responseLocale === "ru"
                  ? `Нужно ехать с противоположной стороны. Перейдите на встречную остановку и сядьте на автобус ${oppositeArrivalNu.route_number}. Ближайший автобус через ${formatMinutes(responseLocale, oppositeArrivalNu.eta_minutes)}.`
                  : responseLocale === "en"
                    ? `Opposite side required. Cross to the opposite stop and take bus ${oppositeArrivalNu.route_number}. The next bus is in ${formatMinutes(responseLocale, oppositeArrivalNu.eta_minutes)}.`
                    : `Қарсы бағыт қажет. Қарсы беттегі аялдамаға өтіп, ${oppositeArrivalNu.route_number} автобусына отырыңыз. Ең жақын автобус ${formatMinutes(responseLocale, oppositeArrivalNu.eta_minutes)} кейін келеді.`
              }
              return responseLocale === "ru"
                ? `Нужно ехать с противоположной стороны. Перейдите на встречную остановку и сядьте на автобус ${oppRouteList}, однако ближайших прибытий сейчас нет.`
                : responseLocale === "en"
                  ? `Opposite side required. Cross to the opposite stop and take bus ${oppRouteList}, however there are no upcoming arrivals.`
                  : `Қарсы бағыт қажет. Қарсы беттегі аялдамаға өтіп, ${oppRouteList} автобусына отырыңыз, бірақ жақын келулер қазір жоқ.`
            }

            const directional = getDirectionalRoutesToDestination(destinationStopId)
            const hasDirectionalMatch =
              directional.sameSide.length > 0 || directional.oppositeSide.length > 0
            const directRoutes =
              directional.sameSide.length > 0
                ? directional.sameSide
                : hasDirectionalMatch
                  ? []
                  : getDirectRoutesToDestination(destinationStopId)
            const inferredFromArrivals = inferSameSideRouteFromArrivals(
              destination === "airport"
                ? "airport"
                : destination === "martial_palace"
                  ? "martialPalace"
                  : "railwayStation",
              destinationStopId
            )
            if (directional.oppositeSide.length > 0 && directional.sameSide.length === 0) {
              const oppositeRouteList = directional.oppositeSide
                .map((r) => r.route_number)
                .join(", ")
              const oppositeRouteSet = new Set<string>(
                directional.oppositeSide
                  .map((r) => normalizeRouteNumber(r.route_number))
                  .filter((v): v is string => Boolean(v))
              )
              const oppositeArrival = await getNextUpcomingAtOppositeStopForRoutes(
                oppositeRouteSet
              )
              if (oppositeArrival) {
                return responseLocale === "ru"
                  ? `Нужно ехать с противоположной стороны. Перейдите на встречную остановку и сядьте на ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}. Ближайший автобус через ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)}.`
                  : responseLocale === "en"
                    ? `Opposite side required. Cross to the opposite stop and take ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}. The next bus is in ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)}.`
                    : `Қарсы бағыт қажет. Қарсы беттегі аялдамаға өтіп, ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}-қа отырыңыз. Ең жақын автобус ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)} кейін келеді.`
              }
              return responseLocale === "ru"
                ? `Нужно ехать с противоположной стороны. Перейдите на встречную остановку и сядьте на автобус ${oppositeRouteList}, однако ближайших прибытий сейчас нет.`
                : responseLocale === "en"
                  ? `Opposite side required. Cross to the opposite stop and take bus ${oppositeRouteList}, however there are no upcoming arrivals.`
                  : `Қарсы бағыт қажет. Қарсы беттегі аялдамаға өтіп, ${oppositeRouteList} автобусына отырыңыз, бірақ жақын келулер қазір жоқ.`
            }
            if (!directRoutes.length) {
              if (inferredFromArrivals?.route) {
                return `From this stop, take route ${inferredFromArrivals.route} to ${destination}. The next bus is in ${inferredFromArrivals.minutesAway} minutes.`
              }
              const oppositeRouteList = directional.oppositeSide
                .map((r) => r.route_number)
                .join(", ")
              if (oppositeRouteList) {
                const oppositeRouteSet = new Set<string>(
                  directional.oppositeSide
                    .map((r) => normalizeRouteNumber(r.route_number))
                    .filter((v): v is string => Boolean(v))
                )
                const oppositeArrival = await getNextUpcomingAtOppositeStopForRoutes(
                  oppositeRouteSet
                )
                if (oppositeArrival) {
                  return responseLocale === "ru"
                    ? `Нужно ехать с противоположной стороны. Перейдите на встречную остановку и сядьте на ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}. Ближайший автобус через ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)}.`
                    : responseLocale === "en"
                      ? `Opposite side required. Cross to the opposite stop and take ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}. The next bus is in ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)}.`
                      : `Қарсы бағыт қажет. Қарсы беттегі аялдамаға өтіп, ${formatRouteLabel(responseLocale, oppositeArrival.route_number)}-қа отырыңыз. Ең жақын автобус ${formatMinutes(responseLocale, oppositeArrival.eta_minutes)} кейін келеді.`
                }
                return responseLocale === "ru"
                  ? `Нужно ехать с противоположной стороны. Перейдите на встречную остановку и сядьте на автобус ${oppositeRouteList}, однако ближайших прибытий сейчас нет.`
                  : responseLocale === "en"
                    ? `Opposite side required. Cross to the opposite stop and take bus ${oppositeRouteList}, however there are no upcoming arrivals.`
                    : `Қарсы бағыт қажет. Қарсы беттегі аялдамаға өтіп, ${oppositeRouteList} автобусына отырыңыз, бірақ жақын келулер қазір жоқ.`
              }
              return responseLocale === "ru"
                ? "С этой остановки прямой маршрут не найден."
                : responseLocale === "en"
                  ? "No direct routes found from this stop."
                  : "Бұл аялдамадан тікелей маршрут табылмады."
            }

            const destinationEta = await getEtaPayload(
              supabase,
              destinationStopId,
              false,
              false
            )
            const directRouteNumbers = new Set<string>(
              directRoutes
                .map((r) => normalizeRouteNumber(r.route_number))
                .filter((v): v is string => Boolean(v))
            )
            const nextAtDestination = destinationEta.arrivals.find((a) =>
              directRouteNumbers.has(normalizeRouteNumber(a.route_number) ?? "")
            )
            const nextAtCurrentStop = getNextUpcomingForRouteNumbers(directRouteNumbers)

            const list = directRoutes.map((r) => r.route_number).join(", ")
            if (nextAtCurrentStop) {
              return `From this stop, take route ${nextAtCurrentStop.route} to ${destination}. The next bus is in ${nextAtCurrentStop.minutesAway} minutes.`
            }
            if (nextAtDestination) {
              return responseLocale === "ru"
                ? `Прямые маршруты: ${list}. Следующий автобус по этим маршрутам примерно через ${formatMinutes(responseLocale, nextAtDestination.eta_minutes)}.`
                : responseLocale === "en"
                  ? `Direct routes: ${list}. Estimated next arrival on these routes is in ${formatMinutes(responseLocale, nextAtDestination.eta_minutes)}.`
                  : `Тікелей маршруттар: ${list}. Осы маршруттар бойынша келесі автобус шамамен ${formatMinutes(responseLocale, nextAtDestination.eta_minutes)} кейін келеді.`
            }
            return `From this stop, take route(s) ${list} to ${destination}, however there are no upcoming arrivals.`
          },
        }),
        getAlerts: tool({
          description: "Get current service alerts",
          inputSchema: z.object({}),
          execute: async () => {
            if (alerts?.length) {
              return alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.title}: ${a.message}`).join("\n")
            }
            return "No active service alerts"
          },
        }),
      },
    })

    const responseTime = Date.now() - startTime
    const answer = result.text

    // Determine intent from the question
    let intent = "general"
    const questionLower = question.toLowerCase()
    if (
      questionLower.includes("when") ||
      questionLower.includes("next") ||
      questionLower.includes("arrive") ||
      questionLower.includes("когда") ||
      questionLower.includes("приедет") ||
      questionLower.includes("қашан") ||
      questionLower.includes("келесі") ||
      questionLower.includes("келеді") ||
      questionLower.includes("qashan") ||
      questionLower.includes("kelesi") ||
      questionLower.includes("keledi")
    ) {
      intent = "eta_query"
    } else if (
      questionLower.includes("route") ||
      questionLower.includes("get to") ||
      questionLower.includes("go to") ||
      questionLower.includes("как доехать") ||
      questionLower.includes("доехать") ||
      questionLower.includes("добраться") ||
      questionLower.includes("попасть")
    ) {
      intent = "route_query"
    } else if (questionLower.includes("schedule") || questionLower.includes("time") || questionLower.includes("last")) {
      intent = "schedule_query"
    } else if (questionLower.includes("running") || questionLower.includes("status") || questionLower.includes("delay")) {
      intent = "service_status"
    }

    // Log the query
    await supabase.from("ai_query_logs").insert({
      stop_id: stopId || null,
      question,
      answer,
      intent,
      confidence: 0.9,
      response_time_ms: responseTime,
      was_successful: true,
    })

    return Response.json({
      answer,
      intent,
      responseTime,
    })
  } catch (error) {
    const responseTime = Date.now() - startTime
    console.log("[v0] AI API error, using fallback:", error)

    // Use rule-based fallback when AI is unavailable
    const fallbackAnswer = await generateFallbackAnswer()
    
    // Determine intent from the question
    let intent = "general"
    const questionLower = question.toLowerCase()
    if (
      questionLower.includes("when") ||
      questionLower.includes("next") ||
      questionLower.includes("arrive") ||
      questionLower.includes("когда") ||
      questionLower.includes("приедет") ||
      questionLower.includes("қашан") ||
      questionLower.includes("келесі") ||
      questionLower.includes("келеді") ||
      questionLower.includes("qashan") ||
      questionLower.includes("kelesi") ||
      questionLower.includes("keledi")
    ) {
      intent = "eta_query"
    } else if (
      questionLower.includes("route") ||
      questionLower.includes("get to") ||
      questionLower.includes("go to") ||
      questionLower.includes("как доехать") ||
      questionLower.includes("доехать") ||
      questionLower.includes("добраться") ||
      questionLower.includes("попасть")
    ) {
      intent = "route_query"
    } else if (questionLower.includes("schedule") || questionLower.includes("time") || questionLower.includes("last")) {
      intent = "schedule_query"
    } else if (questionLower.includes("running") || questionLower.includes("status") || questionLower.includes("delay")) {
      intent = "service_status"
    }

    // Log the fallback query
    if (supabase) {
      await supabase.from("ai_query_logs").insert({
        stop_id: stopId || null,
        question,
        answer: fallbackAnswer,
        intent,
        confidence: 0.7,
        response_time_ms: responseTime,
        was_successful: true,
      })
    }

    return Response.json({
      answer: fallbackAnswer,
      intent,
      responseTime,
      fallback: true,
    })
  }
}
