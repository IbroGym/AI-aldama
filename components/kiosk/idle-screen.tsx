"use client"

import { useEffect } from "react"
import { useI18n } from "@/components/i18n-provider"

interface IdleScreenProps {
  onWake: () => void
}

export function IdleScreen({ onWake }: IdleScreenProps) {
  const { t } = useI18n()
  useEffect(() => {
    const handleWake = () => onWake()
    window.addEventListener("pointerdown", handleWake, { passive: true })
    window.addEventListener("keydown", handleWake)
    return () => {
      window.removeEventListener("pointerdown", handleWake)
      window.removeEventListener("keydown", handleWake)
    }
  }, [onWake])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 text-slate-900 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-8 text-center">
        <div className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {t("kiosk.idleTitle")}
        </div>
        <div className="text-base text-slate-600 md:text-lg">
          {t("kiosk.idleSubtitle")}
        </div>

        <div className="mt-2 h-10 w-10 animate-pulse rounded-full bg-blue-500/10 ring-2 ring-blue-500/40" />

        <div className="text-xs text-slate-400">
          {t("kiosk.idleExit")}
        </div>
      </div>
    </div>
  )
}

