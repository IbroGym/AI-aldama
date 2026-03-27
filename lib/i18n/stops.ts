import type { Locale } from "@/lib/i18n/config"

type StopNameTranslations = Partial<Record<Locale, string>>
type StopLocalizedNameFields = {
  name_kk?: string | null
  name_ru?: string | null
  name_en?: string | null
}

// Keyed by `stop_code` (GTFS stop_id for this feed).
const STOP_NAME_BY_CODE: Record<string, StopNameTranslations> = {
  // Nazarbayev University stop (demo/featured).
  "ccd5e97f-c483-4209-96d7-8d64466fdc26": {
    kk: "Назарбаев Университеті",
    ru: "Назарбаев Университет",
    en: "Nazarbayev University",
  },
  // Alternate stop_id seen in some imports.
  "12cabd75-d75d-4b82-8364-770c7812d47f": {
    kk: "Назарбаев Университеті",
    ru: "Назарбаев Университет",
    en: "Nazarbayev University",
  },
}

function normalizeForMatch(value: string) {
  return value.trim().toLowerCase()
}

export function getLocalizedStopName(
  originalName: string | null | undefined,
  stopCode: string | null | undefined,
  locale: Locale,
  fields?: StopLocalizedNameFields | null
): string {
  const rawName = (originalName ?? "").trim()

  const fromFields =
    locale === "kk"
      ? fields?.name_kk
      : locale === "ru"
        ? fields?.name_ru
        : fields?.name_en
  if (fromFields && fromFields.trim()) return fromFields.trim()

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

