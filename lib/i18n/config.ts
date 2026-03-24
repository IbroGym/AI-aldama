export const SUPPORTED_LOCALES = ["kk", "ru", "en"] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "kk"

export const LOCALE_COOKIE_NAME = "locale"

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && SUPPORTED_LOCALES.includes(value as Locale)
}
