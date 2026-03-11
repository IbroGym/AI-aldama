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
      <div className="flex-1 rounded-2xl bg-[#0d1424] p-6">
        <div className="mb-6 flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Next Arrivals</h2>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-white/5" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 rounded-2xl bg-[#0d1424] p-6">
      <div className="mb-6 flex items-center gap-2">
        <Clock className="h-5 w-5 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">Next Arrivals</h2>
      </div>

      {etas.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-white/50">
          <div className="text-center">
            <Bus className="mx-auto mb-2 h-12 w-12 opacity-50" />
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
                className={`flex items-center justify-between rounded-xl p-4 transition-colors ${
                  isImminent 
                    ? "animate-pulse bg-green-600/20 ring-1 ring-green-500/50" 
                    : "bg-white/5"
                } ${index === 0 ? "ring-2 ring-blue-500/50" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white"
                    style={{ backgroundColor: routeColor }}
                  >
                    {eta.route?.route_number || "?"}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {eta.route?.route_name || "Unknown Route"}
                    </div>
                    <div className="text-sm text-white/60">
                      Bus {eta.bus?.bus_number || "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-3xl font-bold tabular-nums ${
                    isImminent ? "text-green-400" : "text-white"
                  }`}>
                    {formatArrival(eta.predicted_arrival)}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-xs text-white/50">
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
