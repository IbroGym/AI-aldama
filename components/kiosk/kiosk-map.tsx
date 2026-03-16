import type { BusStop } from "@/lib/types/database"
import { MapPin } from "lucide-react"

interface KioskMapProps {
  stop?: BusStop
}

export function KioskMap({ stop }: KioskMapProps) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          <div className="text-sm font-semibold text-slate-900">
            Stop location
          </div>
        </div>
        {stop?.zone && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            {stop.zone}
          </span>
        )}
      </div>

      <div className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-100 via-slate-50 to-slate-100 md:h-52">
        {/* Simple stylised “mini map” placeholder – can be replaced with real map later */}
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute inset-10 rounded-[40%] border border-sky-400/40 blur-2xl" />
          <div className="absolute left-1/4 top-1/3 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-500/40" />
          <div className="absolute right-1/5 bottom-1/4 h-24 w-24 translate-x-1/2 translate-y-1/2 rounded-full border border-indigo-400/40" />
        </div>

        {stop && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.8)]">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <div className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-white/90 backdrop-blur">
                {stop.name}
              </div>
            </div>
          </div>
        )}

        {!stop && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            No stop selected
          </div>
        )}
      </div>

      {stop?.address && (
        <div className="text-xs text-slate-500">
          {stop.address}
        </div>
      )}
    </div>
  )
}

