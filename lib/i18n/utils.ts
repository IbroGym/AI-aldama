import { DEFAULT_LOCALE, type Locale } from "./config"
import { messages } from "./messages"

export type TranslateFn = (key: string, fallback?: string) => string

export function getTranslator(locale: Locale): TranslateFn {
  const localeMessages = messages[locale] || messages[DEFAULT_LOCALE]
  return (key: string, fallback?: string) => localeMessages[key] ?? fallback ?? key
}
