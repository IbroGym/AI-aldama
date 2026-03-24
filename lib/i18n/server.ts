import { cookies } from "next/headers"
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, type Locale, isLocale } from "./config"
import { getTranslator } from "./utils"

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export async function getServerI18n() {
  const locale = await getServerLocale()
  return {
    locale,
    t: getTranslator(locale),
  }
}
