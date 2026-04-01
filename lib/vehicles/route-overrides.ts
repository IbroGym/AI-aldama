type StopLike = {
  id: string
  name: string
  stop_code: string
}

type RouteLike = {
  id: string
  route_number: string
  route_name: string
}

type RouteStopLike = {
  stop_id: string
  stop_sequence: number
}

type DirectionName = "outbound" | "inbound"

type OverrideDirection = {
  from: string
  to: string
  stops: string[]
}

type RouteOverrideDefinition = {
  route_number: string
  directions: Record<DirectionName, OverrideDirection>
}

type MatchKind = "exact" | "fuzzy" | "unresolved"

type ResolutionReport = {
  route_number: string
  direction: DirectionName
  route_id: string | null
  route_name: string | null
  source: "override" | "db"
  trusted_total: number
  resolved_total: number
  exact_matches: string[]
  fuzzy_matches: Array<{ trusted: string; matched: string; score: number }>
  unresolved: string[]
  resolved_entries: Array<{ trusted: string; stop_id: string; matched_name: string }>
  warnings: string[]
}

export type RouteDirectionDebug = {
  route_id: string
  route_number: string
  outbound_stop_ids: string[]
  inbound_stop_ids: string[]
  source: "stop_code_override" | "name_resolved" | "db"
  warnings: string[]
}

export type RouteOrderDiagnostics = {
  route_id: string
  route_number: string
  route_name: string
  order_source: "override" | "db"
  direction?: DirectionName
  warnings: string[]
}

export type RouteOverrideResult = {
  orderedStopIdsByRouteId: Map<string, string[]>
  directionDebugByRouteId: Map<string, RouteDirectionDebug>
  diagnostics: RouteOrderDiagnostics[]
  resolutionReports: ResolutionReport[]
}

const MIN_RESOLVED_STOPS = 4
const FUZZY_THRESHOLD = 0.72
const AMBIGUITY_DELTA = 0.035
/** Values are `public.bus_stops.stop_code` (not primary key `id`). */
export const ROUTE_10_OUTBOUND_DEBUG_STOP_CODES: string[] = [
  "24da8f75-2dc4-4a5d-becc-2898122eaae5",
  "09b35dc0-2e95-4c03-b488-5eda1557f68b",
  "04530e5f-9e64-4ae3-a962-589640451d45",
  "782c5de3-4a10-4129-9dfb-8f19e6c95a25",
  "4fddb84f-fb97-43b8-a619-e667607dc9de",
  "5ea2fd87-18be-448c-ba4a-011ed7449f1e",
  "90bbca78-c461-4348-9ec8-4911c68a3ae3",
  "639393f6-22fb-4ab6-a13d-98f9131736b2",
  "d78e223c-3a67-42db-91eb-12858d261cb0",
  "3abac3ba-87c0-480c-aa39-fc3ec081e9c6",
  "4aed197d-2627-48aa-9191-4b45ed52ddbb",
  "f86c97bc-80c0-4a7e-bbc0-4dbff06148ab",
  "e0b23f68-0123-40e5-ac0d-71b4af6b7274",
  "ec4e66cb-d30e-4e6a-9539-3051048f84da",
  "06232fac-a185-48c0-8ac7-70a493306087",
  "e9dc4756-2990-4fa3-a0b8-a04d6312f913",
  "870084cf-ed0b-4bbd-bea0-368b5bce2425",
  "af31f517-9fae-414c-918f-82aba623f587",
  "d59b3173-0b00-4498-8684-00131374163c",
  "c885bb33-9730-4071-9429-8ad8e56f4a7e",
  "609457bf-32ed-4cae-8bc4-56c755311af4",
  "068882a1-be66-4fce-b012-98a2dd51acc8",
  "0354d63f-65ad-4bef-b2e1-b79439bb9f31",
  "12cabd75-d75d-4b82-8364-770c7812d47f",
  "a57b56fd-5f03-4ce5-bbef-6bcc23035352",
  "97fe4589-8e42-4006-b28b-a0fdb7f06199",
  "0a75a06f-8e5d-48f2-ac85-8211908d4c41",
  "bf5784b8-65f2-46b7-824e-78e29e38f3d1",
  "ccf9d9ab-2a88-4d8f-aa7d-4d3b7eaf7a50",
  "4b830103-8b6e-4273-aedc-b4ca2c34dda8",
  "a6d09382-75f3-4706-85e8-2a5b775af30c",
  "88b7ca3b-3501-4efe-b33f-701453ffa277",
  "1617c71a-0c29-4ad2-b1b4-5ea952e80f75",
  "19d56c0b-6421-4f46-8ec3-2781ee8b93ec",
  "eb69b78a-a836-40b3-8ca7-a7b8aaed7ec6",
  "0efb91bb-82ba-4082-a5d9-69e392b7510f",
]

/** Normalized key for matching override `stop_code` to loaded rows. */
export function normalizeStopCodeForLookup(code: string): string {
  return code.trim().toLowerCase()
}

const ROUTE_OVERRIDES: RouteOverrideDefinition[] = [
  {
    route_number: "10",
    directions: {
      outbound: {
        from: "Ж/д вокзал Астана 1",
        to: "Международный аэропорт",
        stops: [
          "Ж/д вокзал Астана 1",
          "Биржан сал",
          "Ильяса Есенберлина",
          "Агротехнический университет",
          "Медицинский университет Астана",
          "Политехнический колледж",
          "БЦ Марден",
          "Народный банк",
          "Амангельды Иманова",
          "Жанибек Тархана",
          "Микрорайон Самал",
          "Парк Ататюрк",
          "Амман",
          "Дом Министерств",
          "НК Казахстан Темир Жолы",
          "Динмухамеда Кунаева",
          "Кардиохирургическая клиника",
          "Центр нейрохирургии",
          "БЦ Асыл-тау",
          "Дворец единоборств им. Жаксылыка Ушкемпирова",
          "Стадион Астана-Арена",
          "Ледовый дворец Алау",
          "ЖК Экспо-Плаза",
          "Назарбаев университет",
          "Центральный госпиталь МВД РК",
          "ЖК Будапешт",
          "Стелла Звезда Астаны",
          "Шоссе Каркаралы",
          "ЖК Family Park",
          "Канал Нура-Есиль",
          "Садоводческое общество Авиатор",
          "ул. Жанадария",
          "ж/м Пригородный",
          "Арнасай",
          "Мечеть Альжан Ана",
          "Международный аэропорт",
        ],
      },
      inbound: {
        from: "Международный аэропорт",
        to: "Ж/д вокзал Астана 1",
        stops: [
          "Международный аэропорт",
          "Мечеть Альжан Ана",
          "Арнасай",
          "ж/м Пригородный",
          "ул. Жанадария",
          "ЖК Aq-Jol",
          "Садоводческое общество Авиатор",
          "Канал Нура-Есиль",
          "ЖК Family Park",
          "Шоссе Каркаралы",
          "Стелла Звезда Астаны",
          "Центральный госпиталь МВД РК",
          "Назарбаев университет",
          "ЖК Экспо-Плаза",
          "Ледовый дворец Алау",
          "Стадион Астана-Арена",
          "Дворец единоборств им. Жаксылыка Ушкемпирова",
          "БЦ Асыл-тау",
          "Центр нейрохирургии",
          "Кардиохирургическая клиника",
          "Динмухамеда Кунаева",
          "НК Казахстан Темир Жолы",
          "Монумент Байтерек",
          "Дом Министерств",
          "ЖК Миланский квартал",
          "Амман",
          "Жұмабек Тәшенов",
          "Парк Ататюрк",
          "Микрорайон Самал",
          "Амангельды Иманова",
          "Народный банк",
          "БЦ Марден",
          "Алиби Жангельдина",
          "Политехнический колледж",
          "Медицинский университет Астана",
          "Агротехнический университет",
          "Ильяса Есенберлина",
          "Биржан сал",
          "ТД Даулет",
          "Ж/д вокзал Астана 1",
        ],
      },
    },
  },
  {
    route_number: "12",
    directions: {
      outbound: {
        from: "Ж/д вокзал Астана 1",
        to: "Международный аэропорт",
        stops: [
          "Ж/д вокзал Астана 1",
          "Театр Жастар",
          "ул. Алтынсарина",
          "Алии Молдагуловой",
          "Школа-лицей №15",
          "проспект Сарыарка",
          "Спортивный комплекс ABYROY",
          "Школа Зерде",
          "Кенесары",
          "Парк Астана",
          "ТРЦ KeruenCity",
          "ТРЦ Сарыарка",
          "Динмухамеда Кунаева",
          "НК Казахстан Темир Жолы",
          "Монумент Байтерек",
          "Дом Министерств",
          "Финансовый центр",
          "ЖК Акжайык",
          "Қарлығаш балабақшасы",
          "Триумфальная арка Мангилик Ел",
          "ул. Бухар жырау",
          "ЖК Променад Экспо",
          "ЖК Orynbor Towers",
          "Астана ЭКСПО",
          "ЖК Экспо Сити",
          "Больница Медицинского центра УДП РК",
          "Е 495",
          "Детский сад Карлыгаш-2",
          "Е 319",
          "Канал Нура-Есиль",
          "Садоводческое общество Авиатор",
          "ул. Жанадария",
          "Детский сад Балбулак",
          "Сарытогай",
          "Средняя школа №24",
          "Арнасай",
          "Мечеть Альжан Ана",
          "Международный аэропорт",
        ],
      },
      inbound: {
        from: "Международный аэропорт",
        to: "Ж/д вокзал Астана 1",
        stops: [
          "Международный аэропорт",
          "Мечеть Альжан Ана",
          "Арнасай",
          "Средняя школа №24",
          "Сарытогай",
          "Детский сад Балбулак",
          "ул. Жанадария",
          "ЖК Aq-Jol",
          "Садоводческое общество Авиатор",
          "Канал Нура-Есиль",
          "Е 319",
          "Детский сад Карлыгаш-2",
          "Больница Медицинского центра УДП РК",
          "ЖК Экспо Сити",
          "Астана ЭКСПО",
          "ЖК Orynbor Towers",
          "ЖК Променад Экспо",
          "УДП",
          "ул. Бухар жырау",
          "Триумфальная арка Мангилик Ел",
          "Қарлығаш балабақшасы",
          "ЖК Акжайык",
          "Финансовый центр",
          "Қазақконцерт им. Розы Баглановой",
          "Дом Министерств",
          "НК Казахстан Темир Жолы",
          "Динмухамеда Кунаева",
          "Театр Астана Опера",
          "ТРЦ Сарыарка",
          "ТРЦ KeruenCity",
          "Коргалжинская трасса",
          "Парк Астана",
          "Кенесары",
          "Школа Зерде",
          "Спортивный комплекс ABYROY",
          "проспект Сарыарка",
          "ТД Коктем",
          "Школа-лицей №15",
          "Московская",
          "Алии Молдагуловой",
          "Театр Жастар",
          "ТД Даулет",
          "Ж/д вокзал Астана 1",
        ],
      },
    },
  },
  {
    route_number: "46",
    directions: {
      outbound: {
        from: "улица Карасу",
        to: "ЖК Комфорт таун",
        stops: [
          "улица Карасу",
          "Мұса дүкені",
          "Тарбагатай",
          "Актобе",
          "Улытау",
          "Гостиница Бахыт",
          "Келешек",
          "Жанаконыс",
          "пер. Тайтобе",
          "Ардагерлер",
          "Титова",
          "Шугыла",
          "Кафе Сулуколь",
          "Кладбище",
          "Медеу",
          "Қарталы",
          "Акан Серы",
          "проспект Тлендиева",
          "Сарыбулак",
          "Средняя школа №18",
          "ЖК Свечки",
          "проспект Сарыарка",
          "Спортивный комплекс ABYROY",
          "Школа Зерде",
          "Кенесары",
          "Парк Астана",
          "ТРЦ KeruenCity",
          "ТРЦ Сарыарка",
          "Театр Астана Опера",
          "ТРЦ Хан Шатыр",
          "Республиканский диагностический центр",
          "Кардиохирургическая клиника",
          "Мечеть Әбу Насыр әл-Фараби",
          "ТРЦ Керуен",
          "Монумент Байтерек",
          "Дом Министерств",
          "Финансовый центр",
          "ЖК Акжайык",
          "Қарлығаш балабақшасы",
          "Триумфальная арка Мангилик Ел",
          "ул. Бухар жырау",
          "ЖК Променад Экспо",
          "ЖК Orynbor Towers",
          "Каракат",
          "Жаркын",
          "ЖК Комфорт таун",
        ],
      },
      inbound: {
        from: "ЖК Комфорт таун",
        to: "улица Карасу",
        stops: [
          "ЖК Комфорт таун",
          "ЖК Nova city",
          "Жаркын",
          "Каракат",
          "ЖК Orynbor Towers",
          "ЖК Променад Экспо",
          "УДП",
          "ул. Бухар жырау",
          "Триумфальная арка Мангилик Ел",
          "Қарлығаш балабақшасы",
          "ЖК Акжайык",
          "Финансовый центр",
          "Қазақконцерт им. Розы Баглановой",
          "Дом Министерств",
          "Министерство обороны",
          "ТРЦ Керуен",
          "Кардиохирургическая клиника",
          "Республиканский диагностический центр",
          "ТРЦ Хан Шатыр",
          "Театр Астана Опера",
          "ТРЦ Сарыарка",
          "ТРЦ KeruenCity",
          "Коргалжинская трасса",
          "Парк Астана",
          "Кенесары",
          "Школа Зерде",
          "Спортивный комплекс ABYROY",
          "проспект Сарыарка",
          "Средняя школа №18",
          "Сарыбулак",
          "проспект Тлендиева",
          "Акан Серы",
          "Қарталы",
          "Медеу",
          "Кладбище",
          "Шугыла",
          "Титова",
          "Ардагерлер",
          "Бабатайулы",
          "пер. Тайтобе",
          "Жанаконыс",
          "Кафе Казыгурт",
          "Гостиница Бахыт",
          "ж/м Коктал-2",
          "Тарбагатай",
          "Мұса дүкені",
          "Наурыз,48",
          "улица Карасу",
        ],
      },
    },
  },
]

export function resolveRouteOrderOverrides(params: {
  routes: RouteLike[]
  stops: StopLike[]
  routeStopsByRouteId: Map<string, RouteStopLike[]>
}): RouteOverrideResult {
  const targetRouteNumbers = new Set(ROUTE_OVERRIDES.map((r) => r.route_number))
  const diagnostics: RouteOrderDiagnostics[] = []
  const resolutionReports: ResolutionReport[] = []
  const orderedStopIdsByRouteId = new Map<string, string[]>()
  const directionDebugByRouteId = new Map<string, RouteDirectionDebug>()
  const stopIndex = createStopNameIndex(params.stops)
  const stopById = new Map(params.stops.map((s) => [s.id, s]))
  const stopsByNormalizedCode = buildStopsByNormalizedStopCode(params.stops)

  for (const route of params.routes) {
    const dbOrder = dbOrderedStopIds(route.id, params.routeStopsByRouteId)
    orderedStopIdsByRouteId.set(route.id, dbOrder)
    diagnostics.push({
      route_id: route.id,
      route_number: route.route_number,
      route_name: route.route_name,
      order_source: "db",
      warnings: [],
    })
  }

  for (const def of ROUTE_OVERRIDES) {
    const candidates = params.routes.filter((r) => r.route_number === def.route_number)
    if (!candidates.length) {
      logWarn(`No route_id found for override route_number ${def.route_number}`)
      continue
    }

    const byDirection = matchRouteIdsForDirections(
      candidates,
      def,
      params.routeStopsByRouteId,
      params.stops
    )

    if (def.route_number === "10") {
      const route = byDirection.outbound ?? byDirection.inbound
      if (!route) continue
      const outboundReport = resolveExplicitStopCodeSequence(
        "10",
        "outbound",
        route,
        ROUTE_10_OUTBOUND_DEBUG_STOP_CODES,
        stopsByNormalizedCode
      )
      const inboundReport = resolveExplicitStopCodeSequence(
        "10",
        "inbound",
        route,
        [...ROUTE_10_OUTBOUND_DEBUG_STOP_CODES].reverse(),
        stopsByNormalizedCode
      )
      inboundReport.warnings.push(
        "Temporary debug-only inbound override: reversed outbound stop_code sequence"
      )
      resolutionReports.push(outboundReport, inboundReport)

      const outboundIds = dedupeKeepingOrder(
        outboundReport,
        outboundReport.route_id,
        outboundReport.warnings
      )
      const inboundIds = dedupeKeepingOrder(
        inboundReport,
        inboundReport.route_id,
        inboundReport.warnings
      )
      if (outboundIds.length >= MIN_RESOLVED_STOPS) {
        orderedStopIdsByRouteId.set(route.id, outboundIds)
        setRouteDiagnostic(diagnostics, route.id, {
          order_source: "override",
          direction: "outbound",
          warnings: [
            ...outboundReport.warnings,
            "Inbound debug direction available via reversed outbound stop_code order",
          ],
        })
      } else {
        outboundReport.warnings.push(
          `Resolved route has too few stops (${outboundIds.length}), falling back to DB order`
        )
      }

      directionDebugByRouteId.set(route.id, {
        route_id: route.id,
        route_number: route.route_number,
        outbound_stop_ids: outboundIds,
        inbound_stop_ids: inboundIds,
        source: "stop_code_override",
        warnings: [...outboundReport.warnings, ...inboundReport.warnings],
      })
      continue
    }

    for (const direction of ["outbound", "inbound"] as const) {
      const route = byDirection[direction]
      if (!route) {
        const rep = emptyReport(def.route_number, direction)
        rep.warnings.push(
          `No matching route_id selected for ${def.route_number} ${direction}`
        )
        resolutionReports.push(rep)
        logWarn(
          `Override not applied for route ${def.route_number} ${direction}: route_id not resolved`
        )
        continue
      }

      const sequence = def.directions[direction]
      const report = resolveDirectionSequence(
        def.route_number,
        direction,
        route,
        sequence.stops,
        stopIndex
      )
      resolutionReports.push(report)

      const uniqueIds = dedupeKeepingOrder(report, report.route_id, report.warnings)
      if (uniqueIds.length >= MIN_RESOLVED_STOPS) {
        orderedStopIdsByRouteId.set(route.id, uniqueIds)
        const existing = directionDebugByRouteId.get(route.id)
        directionDebugByRouteId.set(route.id, {
          route_id: route.id,
          route_number: route.route_number,
          outbound_stop_ids:
            direction === "outbound"
              ? uniqueIds
              : existing?.outbound_stop_ids ?? [],
          inbound_stop_ids:
            direction === "inbound" ? uniqueIds : existing?.inbound_stop_ids ?? [],
          source: "name_resolved",
          warnings: report.warnings,
        })
        setRouteDiagnostic(diagnostics, route.id, {
          order_source: "override",
          direction,
          warnings: report.warnings,
        })
        logInfo(
          `Applied override order for route ${route.route_number} (${route.id}) ${direction}: ${uniqueIds.length}/${sequence.stops.length} resolved`
        )
      } else {
        report.warnings.push(
          `Resolved route has too few stops (${uniqueIds.length}), falling back to DB order`
        )
        setRouteDiagnostic(diagnostics, route.id, {
          order_source: "db",
          direction,
          warnings: report.warnings,
        })
        logWarn(
          `Override fallback to DB for route ${route.route_number} (${route.id}) ${direction}: only ${uniqueIds.length} resolved`
        )
      }
    }
  }

  validateDirectionConsistency(diagnostics, orderedStopIdsByRouteId)
  warnUntouchedTargetRoutes(params.routes, targetRouteNumbers, diagnostics)

  return {
    orderedStopIdsByRouteId,
    directionDebugByRouteId,
    diagnostics,
    resolutionReports,
  }
}

function buildStopsByNormalizedStopCode(
  stops: StopLike[]
): Map<string, StopLike[]> {
  const m = new Map<string, StopLike[]>()
  for (const s of stops) {
    const key = normalizeStopCodeForLookup(s.stop_code)
    const list = m.get(key) ?? []
    list.push(s)
    m.set(key, list)
  }
  return m
}

function resolveExplicitStopCodeSequence(
  routeNumber: string,
  direction: DirectionName,
  route: RouteLike,
  stopCodes: string[],
  stopsByNormalizedCode: Map<string, StopLike[]>
): ResolutionReport {
  const report: ResolutionReport = {
    route_number: routeNumber,
    direction,
    route_id: route.id,
    route_name: route.route_name,
    source: "override",
    trusted_total: stopCodes.length,
    resolved_total: 0,
    exact_matches: [],
    fuzzy_matches: [],
    unresolved: [],
    resolved_entries: [],
    warnings: [],
  }
  for (const code of stopCodes) {
    const key = normalizeStopCodeForLookup(code)
    const candidates = stopsByNormalizedCode.get(key) ?? []
    if (candidates.length === 0) {
      report.unresolved.push(code)
      report.warnings.push(
        `Missing stop_code "${code}" in bus_stops for route ${routeNumber} ${direction}`
      )
      continue
    }
    if (candidates.length > 1) {
      logWarn(
        `Ambiguous stop_code "${code}" for route ${routeNumber} ${direction}: ${candidates.length} rows, using first (id=${candidates[0].id})`
      )
    }
    const stop = candidates[0]
    report.exact_matches.push(code)
    report.resolved_entries.push({
      trusted: code,
      stop_id: stop.id,
      matched_name: stop.name,
    })
  }
  report.resolved_total = report.resolved_entries.length
  if (report.unresolved.length > 0) {
    report.warnings.push(
      `Route ${routeNumber} ${direction} is partially resolved: ${report.resolved_total}/${report.trusted_total}`
    )
  }
  return report
}

function warnUntouchedTargetRoutes(
  routes: RouteLike[],
  targetRouteNumbers: Set<string>,
  diagnostics: RouteOrderDiagnostics[]
) {
  for (const route of routes) {
    if (!targetRouteNumbers.has(route.route_number)) continue
    const d = diagnostics.find((x) => x.route_id === route.id)
    if (!d || d.order_source === "override") continue
    logWarn(
      `Route ${route.route_number} (${route.id}) remains on DB order (override not fully resolved)`
    )
  }
}

function setRouteDiagnostic(
  diagnostics: RouteOrderDiagnostics[],
  routeId: string,
  patch: Partial<RouteOrderDiagnostics>
) {
  const idx = diagnostics.findIndex((d) => d.route_id === routeId)
  if (idx < 0) return
  diagnostics[idx] = { ...diagnostics[idx], ...patch }
}

function validateDirectionConsistency(
  diagnostics: RouteOrderDiagnostics[],
  orderedStopIdsByRouteId: Map<string, string[]>
) {
  const byRouteNumber = new Map<string, RouteOrderDiagnostics[]>()
  for (const d of diagnostics) {
    const list = byRouteNumber.get(d.route_number) ?? []
    list.push(d)
    byRouteNumber.set(d.route_number, list)
  }

  for (const [routeNumber, list] of byRouteNumber) {
    const outbound = list.find((d) => d.direction === "outbound")
    const inbound = list.find((d) => d.direction === "inbound")
    if (!outbound || !inbound) continue

    const outStops = orderedStopIdsByRouteId.get(outbound.route_id) ?? []
    const inStops = orderedStopIdsByRouteId.get(inbound.route_id) ?? []
    if (outStops.length < 2 || inStops.length < 2) continue

    const outFirst = outStops[0]
    const outLast = outStops[outStops.length - 1]
    const inFirst = inStops[0]
    const inLast = inStops[inStops.length - 1]
    const terminalMismatch = outFirst !== inLast || outLast !== inFirst

    const outSet = new Set(outStops)
    let overlap = 0
    for (const id of inStops) {
      if (outSet.has(id)) overlap++
    }
    const overlapRatio = overlap / Math.max(1, Math.min(outStops.length, inStops.length))

    if (terminalMismatch || overlapRatio < 0.55) {
      const message = `Direction consistency warning for route ${routeNumber}: terminals mismatch=${terminalMismatch}, overlap_ratio=${overlapRatio.toFixed(2)}`
      outbound.warnings = [...outbound.warnings, message]
      inbound.warnings = [...inbound.warnings, message]
      logWarn(message)
    }
  }
}

function resolveDirectionSequence(
  routeNumber: string,
  direction: DirectionName,
  route: RouteLike,
  trustedStops: string[],
  stopIndex: ReturnType<typeof createStopNameIndex>
): ResolutionReport {
  const report: ResolutionReport = {
    route_number: routeNumber,
    direction,
    route_id: route.id,
    route_name: route.route_name,
    source: "override",
    trusted_total: trustedStops.length,
    resolved_total: 0,
    exact_matches: [],
    fuzzy_matches: [],
    unresolved: [],
    resolved_entries: [],
    warnings: [],
  }

  for (const trustedName of trustedStops) {
    const match = matchStopName(trustedName, stopIndex)
    if (match.kind === "unresolved") {
      report.unresolved.push(trustedName)
      report.warnings.push(
        `Missing stop match for "${trustedName}" on route ${routeNumber} ${direction}`
      )
      continue
    }
    if (match.kind === "exact") {
      report.exact_matches.push(trustedName)
    } else {
      report.fuzzy_matches.push({
        trusted: trustedName,
        matched: match.stop.name,
        score: Number(match.score.toFixed(3)),
      })
    }
    report.resolved_entries.push({
      trusted: trustedName,
      stop_id: match.stop.id,
      matched_name: match.stop.name,
    })
  }

  report.resolved_total = report.resolved_entries.length

  if (report.unresolved.length > 0) {
    report.warnings.push(
      `Route ${routeNumber} ${direction} is partially resolved: ${report.resolved_total}/${report.trusted_total}`
    )
  }

  if (report.fuzzy_matches.length > 0) {
    logInfo(
      `Fuzzy matches used for route ${routeNumber} ${direction}: ${report.fuzzy_matches.length}`
    )
  }

  if (report.unresolved.length > 0) {
    logWarn(
      `Unresolved trusted stops for route ${routeNumber} ${direction}: ${report.unresolved.join(", ")}`
    )
  }

  return report
}

function dedupeKeepingOrder(
  report: ResolutionReport,
  routeId: string | null,
  warnings: string[]
): string[] {
  if (!routeId) return []
  const seen = new Set<string>()
  const ids: string[] = []

  for (const entry of report.resolved_entries) {
    if (seen.has(entry.stop_id)) {
      const w = `Duplicate stop in override resolved sequence: "${entry.trusted}" -> ${entry.stop_id}`
      warnings.push(w)
      logWarn(w)
      continue
    }
    seen.add(entry.stop_id)
    ids.push(entry.stop_id)
  }
  return ids
}

function dbOrderedStopIds(
  routeId: string,
  routeStopsByRouteId: Map<string, RouteStopLike[]>
): string[] {
  return (routeStopsByRouteId.get(routeId) ?? [])
    .slice()
    .sort((a, b) => a.stop_sequence - b.stop_sequence)
    .map((s) => s.stop_id)
}

function matchRouteIdsForDirections(
  candidates: RouteLike[],
  def: RouteOverrideDefinition,
  routeStopsByRouteId: Map<string, RouteStopLike[]>,
  allStops: StopLike[]
): Record<DirectionName, RouteLike | null> {
  const byId = new Map(allStops.map((s) => [s.id, s]))

  const ranked = {
    outbound: rankCandidates(
      candidates,
      def.directions.outbound,
      routeStopsByRouteId,
      byId
    ),
    inbound: rankCandidates(candidates, def.directions.inbound, routeStopsByRouteId, byId),
  }

  const outbound = ranked.outbound[0]?.route ?? null
  let inbound = ranked.inbound[0]?.route ?? null

  if (outbound && inbound && outbound.id === inbound.id && candidates.length > 1) {
    inbound = ranked.inbound.find((r) => r.route.id !== outbound.id)?.route ?? inbound
  }

  return { outbound, inbound }
}

function rankCandidates(
  candidates: RouteLike[],
  direction: OverrideDirection,
  routeStopsByRouteId: Map<string, RouteStopLike[]>,
  stopById: Map<string, StopLike>
): Array<{ route: RouteLike; score: number }> {
  const fromNorm = normalizeName(direction.from)
  const toNorm = normalizeName(direction.to)

  const ranked = candidates.map((route) => {
    const stopIds = dbOrderedStopIds(route.id, routeStopsByRouteId)
    const dbNames = stopIds
      .map((id) => stopById.get(id)?.name)
      .filter((x): x is string => !!x)
      .map((name) => normalizeName(name))

    const first = dbNames[0] ?? ""
    const last = dbNames[dbNames.length - 1] ?? ""
    const endpointScore =
      similarity(first, fromNorm) * 2.4 + similarity(last, toNorm) * 2.4
    const overlap = calcOverlapRatio(dbNames, direction.stops.map((s) => normalizeName(s)))
    const score = endpointScore + overlap * 2 + dbNames.length / 1000
    return { route, score }
  })

  ranked.sort((a, b) => b.score - a.score)
  return ranked
}

function calcOverlapRatio(dbNames: string[], trustedNames: string[]): number {
  const dbSet = new Set(dbNames)
  let hits = 0
  for (const n of trustedNames) {
    if (dbSet.has(n)) hits++
  }
  return hits / Math.max(1, trustedNames.length)
}

type StopNameIndex = {
  exactByName: Map<string, StopLike[]>
  normalizedStops: Array<{ stop: StopLike; norm: string }>
}

function createStopNameIndex(stops: StopLike[]): StopNameIndex {
  const exactByName = new Map<string, StopLike[]>()
  const normalizedStops = stops.map((stop) => ({
    stop,
    norm: normalizeName(stop.name),
  }))
  for (const stop of stops) {
    const key = normalizeBasic(stop.name)
    const list = exactByName.get(key) ?? []
    list.push(stop)
    exactByName.set(key, list)
  }
  return { exactByName, normalizedStops }
}

function matchStopName(
  trustedName: string,
  index: StopNameIndex
):
  | { kind: "exact"; stop: StopLike; score: number }
  | { kind: "fuzzy"; stop: StopLike; score: number; ambiguous: boolean }
  | { kind: "unresolved" } {
  const exactKey = normalizeBasic(trustedName)
  const exactCandidates = index.exactByName.get(exactKey) ?? []
  if (exactCandidates.length === 1) {
    return { kind: "exact", stop: exactCandidates[0], score: 1 }
  }
  if (exactCandidates.length > 1) {
    logWarn(
      `Ambiguous exact match for "${trustedName}": ${exactCandidates.length} candidates, selecting first`
    )
    return { kind: "exact", stop: exactCandidates[0], score: 1 }
  }

  const trustedNorm = normalizeName(trustedName)
  let best: { stop: StopLike; score: number } | null = null
  let secondScore = 0
  for (const candidate of index.normalizedStops) {
    const score = similarity(trustedNorm, candidate.norm)
    if (!best || score > best.score) {
      secondScore = best?.score ?? 0
      best = { stop: candidate.stop, score }
    } else if (score > secondScore) {
      secondScore = score
    }
  }

  if (!best || best.score < FUZZY_THRESHOLD) {
    return { kind: "unresolved" }
  }

  const ambiguous = best.score - secondScore <= AMBIGUITY_DELTA
  if (ambiguous) {
    logWarn(
      `Ambiguous fuzzy match for "${trustedName}": best="${best.stop.name}" score=${best.score.toFixed(3)}`
    )
  }

  return { kind: "fuzzy", stop: best.stop, score: best.score, ambiguous }
}

function emptyReport(routeNumber: string, direction: DirectionName): ResolutionReport {
  return {
    route_number: routeNumber,
    direction,
    route_id: null,
    route_name: null,
    source: "db",
    trusted_total: 0,
    resolved_total: 0,
    exact_matches: [],
    fuzzy_matches: [],
    unresolved: [],
    resolved_entries: [],
    warnings: [],
  }
}

function normalizeBasic(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[’`']/g, "'")
    .replace(/[«»"]/g, "")
    .replace(/\s+/g, " ")
}

function normalizeName(v: string): string {
  return normalizeBasic(v)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ё]/g, "е")
    .replace(/[қ]/g, "к")
    .replace(/[ң]/g, "н")
    .replace(/[ғ]/g, "г")
    .replace(/[ү]/g, "у")
    .replace(/[ұ]/g, "у")
    .replace(/[ә]/g, "а")
    .replace(/[ө]/g, "о")
    .replace(/[һ]/g, "х")
    .replace(/[і]/g, "и")
    .replace(/[a]/g, "а")
    .replace(/[c]/g, "с")
    .replace(/[e]/g, "е")
    .replace(/[h]/g, "н")
    .replace(/[k]/g, "к")
    .replace(/[m]/g, "м")
    .replace(/[o]/g, "о")
    .replace(/[p]/g, "р")
    .replace(/[t]/g, "т")
    .replace(/[x]/g, "х")
    .replace(/[^a-z0-9а-яё\s./-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const aBigrams = bigrams(a)
  const bBigrams = bigrams(b)
  if (!aBigrams.length || !bBigrams.length) return 0
  const bSet = new Set(bBigrams)
  let overlap = 0
  for (const gram of aBigrams) {
    if (bSet.has(gram)) overlap++
  }
  return (2 * overlap) / (aBigrams.length + bBigrams.length)
}

function bigrams(v: string): string[] {
  const s = v.replace(/\s+/g, " ")
  if (s.length < 2) return [s]
  const out: string[] = []
  for (let i = 0; i < s.length - 1; i++) {
    out.push(s.slice(i, i + 2))
  }
  return out
}

function logWarn(message: string) {
  console.warn(`[route-overrides] ${message}`)
}

function logInfo(message: string) {
  console.info(`[route-overrides] ${message}`)
}
