"use client"

import { Button } from "@/components/ui/button"
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config"
import { useI18n } from "@/components/i18n-provider"

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {SUPPORTED_LOCALES.map((item) => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant={locale === item ? "default" : "ghost"}
          className="h-7 px-2 text-xs"
          onClick={() => setLocale(item as Locale)}
        >
          {t(`lang.${item}`)}
        </Button>
      ))}
    </div>
  )
}
