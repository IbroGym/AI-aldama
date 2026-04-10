import { generateText, tool } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { isLocale, type Locale } from "@/lib/i18n/config"
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

  const currentStop = stopsForContext.find((s) => s.id === stopId)
  const currentStopDisplayName =
    responseLocale === "ru"
      ? currentStop?.name_ru || currentStop?.name
      : responseLocale === "kk"
        ? currentStop?.name_kk || currentStop?.name
        : currentStop?.name_en || currentStop?.name
  const activeRoutes = routes ?? []
  const activeRouteStops = routeStops ?? []

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
    if (!stopId || !activeRoutes.length) {
      return { sameSide: [] as typeof activeRoutes, oppositeSide: [] as typeof activeRoutes }
    }

    const sameSideRouteNumbers = new Set<string>()
    const oppositeSideRouteNumbers = new Set<string>()

    for (const route of activeRoutes) {
      const routeNumber = normalizeRouteNumber(route.route_number)
      if (!routeNumber) continue
      const directional = DIRECTIONAL_ROUTE_STOPS[routeNumber]
      if (!directional) continue

      const outFrom = directional.outbound.indexOf(stopId)
      const outTo = directional.outbound.indexOf(destinationStopId)
      const inFrom = directional.inbound.indexOf(stopId)
      const inTo = directional.inbound.indexOf(destinationStopId)

      if (outFrom >= 0 && outTo >= 0 && outFrom < outTo) {
        sameSideRouteNumbers.add(routeNumber)
      } else if (outFrom >= 0 && outTo >= 0 && outFrom > outTo) {
        oppositeSideRouteNumbers.add(routeNumber)
      } else if (inFrom >= 0 && inTo >= 0 && inFrom < inTo) {
        sameSideRouteNumbers.add(routeNumber)
      } else if (inFrom >= 0 && inTo >= 0 && inFrom > inTo) {
        oppositeSideRouteNumbers.add(routeNumber)
      } else if (outFrom >= 0 && inTo >= 0) {
        oppositeSideRouteNumbers.add(routeNumber)
      } else if (inFrom >= 0 && outTo >= 0) {
        oppositeSideRouteNumbers.add(routeNumber)
      }
    }

    return {
      sameSide: activeRoutes.filter((r) =>
        sameSideRouteNumbers.has(normalizeRouteNumber(r.route_number) ?? "")
      ),
      oppositeSide: activeRoutes.filter((r) =>
        oppositeSideRouteNumbers.has(normalizeRouteNumber(r.route_number) ?? "")
      ),
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

  try {
    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      prompt: question,
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
      questionLower.includes("доехать")
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
      questionLower.includes("доехать")
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
