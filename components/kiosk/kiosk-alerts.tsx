"use client"

import { useState, useEffect } from "react"
import type { Alert } from "@/lib/types/database"
import { AlertTriangle, Info, Clock, Wrench, ChevronLeft, ChevronRight } from "lucide-react"

interface KioskAlertsProps {
  alerts: Alert[]
}

export function KioskAlerts({ alerts }: KioskAlertsProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Auto-rotate through alerts
  useEffect(() => {
    if (alerts.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % alerts.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [alerts.length])

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-300/70">
        <div className="flex items-center gap-2 text-green-700">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="font-medium">All services running normally</span>
        </div>
      </div>
    )
  }

  const getAlertIcon = (type: Alert["alert_type"]) => {
    switch (type) {
      case "delay": return <Clock className="h-5 w-5" />
      case "cancellation": return <AlertTriangle className="h-5 w-5" />
      case "reroute": return <AlertTriangle className="h-5 w-5" />
      case "maintenance": return <Wrench className="h-5 w-5" />
      case "info": return <Info className="h-5 w-5" />
      default: return <Info className="h-5 w-5" />
    }
  }

  const getSeverityStyles = (severity: Alert["severity"]) => {
    switch (severity) {
      case "critical": return "bg-red-50 ring-red-400/70 text-red-700"
      case "high": return "bg-orange-50 ring-orange-400/70 text-orange-700"
      case "medium": return "bg-yellow-50 ring-yellow-400/70 text-yellow-700"
      case "low": return "bg-blue-50 ring-blue-400/70 text-blue-700"
      default: return "bg-slate-50 ring-slate-200 text-slate-700"
    }
  }

  const currentAlert = alerts[currentIndex]

  return (
    <div className={`rounded-2xl p-4 ring-1 shadow-sm ${getSeverityStyles(currentAlert.severity)}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{getAlertIcon(currentAlert.alert_type)}</div>
          <div>
            <div className="font-semibold">{currentAlert.title}</div>
            <p className="mt-1 text-sm opacity-80">{currentAlert.message}</p>
          </div>
        </div>

        {alerts.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + alerts.length) % alerts.length)}
              className="rounded-lg bg-white/10 p-1.5 transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs opacity-60">
              {currentIndex + 1}/{alerts.length}
            </span>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % alerts.length)}
              className="rounded-lg bg-white/10 p-1.5 transition-colors hover:bg-white/20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
