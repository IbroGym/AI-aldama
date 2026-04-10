import type { Locale } from "@/lib/i18n/config"

type StopNameTranslations = Partial<Record<Locale, string>>
type StopLocalizedNameFields = {
  name_kk?: string | null
  name_ru?: string | null
  name_en?: string | null
}

// Keyed by `stop_code` (GTFS stop_id for this feed).
const STOP_NAME_BY_CODE: Record<string, StopNameTranslations> = {
  // Inbound-side NU (toward city / railway) — GTFS stop_id.
  "ccd5e97f-c483-4209-96d7-8d64466fdc26": {
    kk: "Назарбаев Университеті",
    ru: "Назарбаев Университет",
    en: "Nazarbayev University",
  },
  // Outbound-side NU (toward airport) — GTFS stop_id / alternate PK in some DBs.
  "12cabd75-d75d-4b82-8364-770c7812d47f": {
    kk: "Назарбаев Университеті (аэропортқа қарай)",
    ru: "Назарбаев Университет (в сторону аэропорта)",
    en: "Nazarbayev University (toward airport)",
  },
}

// Keyed by `public.bus_stops.id` (kiosk / UI labels when direction matters).
const STOP_NAME_BY_ID: Record<string, StopNameTranslations> = {
  // Keep in sync with `KIOSK_TEATR_ASTANA_OPERA_STOP_ID`
  "0ae68bb8-6b0d-4025-8898-16debf368904": {
    kk: "Astana Opera театры (ж/д вокзалға қарай)",
    ru: "Teatr Astana Opera (в сторону ж/д вокзала)",
    en: "Astana Opera Theatre (toward railway station)",
  },
  // Outbound-side Nazarbayev U. — GTFS / legacy row (`ROUTE_10_NU_OUTBOUND_SIDE_LEGACY_STOP_ID`)
  "12cabd75-d75d-4b82-8364-770c7812d47f": {
    kk: "Назарбаев Университеті (аэропортқа қарай)",
    ru: "Назарбаев Университет (в сторону аэропорта)",
    en: "Nazarbayev University (toward airport)",
  },
  // Production `bus_stops.id` (`ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID`)
  "21768934-279d-4ace-a962-0e638546a0ef": {
    kk: "Назарбаев Университеті (аэропортқа қарай)",
    ru: "Назарбаев Университет (в сторону аэропорта)",
    en: "Nazarbayev University (toward airport)",
  },
}

function normalizeForMatch(value: string) {
  return value.trim().toLowerCase()
}

export function getLocalizedStopName(
  originalName: string | null | undefined,
  stopCode: string | null | undefined,
  locale: Locale,
  fields?: StopLocalizedNameFields | null,
  stopId?: string | null,
): string {
  const rawName = (originalName ?? "").trim()

  const fromFields =
    locale === "kk"
      ? fields?.name_kk
      : locale === "ru"
        ? fields?.name_ru
        : fields?.name_en
  if (fromFields && fromFields.trim()) return fromFields.trim()

  if (stopId) {
    const byId = STOP_NAME_BY_ID[stopId]?.[locale]
    if (byId) return byId
  }

  const byCode = stopCode ? STOP_NAME_BY_CODE[stopCode]?.[locale] : undefined
  if (byCode) return byCode

  const normalizedName = normalizeForMatch(rawName)
  if (!normalizedName) return rawName

  // Heuristic fallback for this specific featured stop if the stop_code changes.
  if (
    normalizedName.includes("nazarbaev") ||
    normalizedName.includes("nazarbayev") ||
    normalizedName.includes("назарбаев")
  ) {
    return (
      STOP_NAME_BY_CODE["ccd5e97f-c483-4209-96d7-8d64466fdc26"]?.[locale] ??
      rawName
    )
  }

  return rawName
}

