"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, type Locale, isLocale } from "@/lib/i18n/config"
import { getTranslator } from "@/lib/i18n/utils"

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

interface I18nProviderProps {
  initialLocale: Locale
  children: React.ReactNode
}

export function I18nProvider({ initialLocale, children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_COOKIE_NAME)
    if (isLocale(stored) && stored !== locale) {
      setLocaleState(stored)
      return
    }
    if (!stored) {
      window.localStorage.setItem(LOCALE_COOKIE_NAME, locale)
    }
  }, [locale])

  useEffect(() => {
    document.documentElement.lang = locale
    const secure = window.location.protocol === "https:" ? "; secure" : ""
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax${secure}`
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    if (!SUPPORTED_LOCALES.includes(next)) return
    setLocaleState(next)
    window.localStorage.setItem(LOCALE_COOKIE_NAME, next)
  }, [])

  const t = useMemo(() => getTranslator(locale), [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return context
}
