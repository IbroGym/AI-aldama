import type { EtaPrediction, BusRoute } from "@/lib/types/database"
import { Bus, Clock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface EtaWithDetails extends EtaPrediction {
  bus?: { bus_number: string }
  route?: BusRoute
}

interface KioskArrivalsProps {
  etas: EtaWithDetails[]
  loading: boolean
  currentTime: Date
}

export function KioskArrivals({ etas, loading, currentTime }: KioskArrivalsProps) {
  const getMinutesUntil = (dateStr: string) => {
    const arrival = new Date(dateStr)
    const diffMs = arrival.getTime() - currentTime.getTime()
    return Math.max(0, Math.round(diffMs / 60000))
  }

  const formatArrival = (dateStr: string) => {
    const mins = getMinutesUntil(dateStr)
    if (mins === 0) return "NOW"
    if (mins === 1) return "1 min"
    if (mins < 60) return `${mins} mins`
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          <h2 className="text-xl font-semibold text-slate-900">Next Arrivals</h2>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex items-center gap-2">
        <Clock className="h-5 w-5 text-blue-500" />
        <h2 className="text-xl font-semibold text-slate-900">Next Arrivals</h2>
      </div>

      {etas.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-slate-400">
          <div className="text-center">
            <Bus className="mx-auto mb-2 h-12 w-12 text-slate-300" />
            <p>No upcoming arrivals at this stop</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {etas.map((eta, index) => {
            const mins = getMinutesUntil(eta.predicted_arrival)
            const isImminent = mins <= 2
            const routeColor = eta.route?.color || "#3B82F6"

            return (
            <div
              key={eta.id}
              className={`flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors ${
                isImminent 
                  ? "animate-pulse border-green-400/70 bg-green-50 ring-1 ring-green-400/60" 
                  : index === 0
                    ? "border-blue-400/70 bg-blue-50 ring-1 ring-blue-400/60"
                    : ""
              }`}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm"
                    style={{ backgroundColor: routeColor }}
                  >
                    {eta.route?.route_number || "?"}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      {eta.route?.route_name || "Unknown Route"}
                    </div>
                    <div className="text-sm text-slate-500">
                      Bus {eta.bus?.bus_number || "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`whitespace-nowrap text-lg font-semibold tabular-nums ${
                    isImminent ? "text-green-600" : "text-slate-900"
                  }`}>
                    {formatArrival(eta.predicted_arrival)}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-xs text-slate-500">
                    <div 
                      className={`h-1.5 w-1.5 rounded-full ${
                        eta.confidence >= 0.9 ? "bg-green-500" :
                        eta.confidence >= 0.75 ? "bg-yellow-500" : "bg-orange-500"
                      }`} 
                    />
                    {Math.round(eta.confidence * 100)}% confidence
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
