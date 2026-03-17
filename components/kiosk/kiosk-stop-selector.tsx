"use client"

import type { BusStop } from "@/lib/types/database"
import { MapPin, ChevronDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface KioskStopSelectorProps {
  stops: BusStop[]
  selectedStopId?: string
  onSelect: (stopId: string) => void
}

export function KioskStopSelector({ stops, selectedStopId, onSelect }: KioskStopSelectorProps) {
  // Group stops by zone
  const stopsByZone = stops.reduce((acc, stop) => {
    const zone = stop.zone || "Other"
    if (!acc[zone]) acc[zone] = []
    acc[zone].push(stop)
    return acc
  }, {} as Record<string, BusStop[]>)

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-slate-900">Select Stop</h3>
      </div>

      <Select value={selectedStopId} onValueChange={onSelect}>
        <SelectTrigger className="w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 [&>svg]:text-slate-400">
          <SelectValue placeholder="Choose a stop" />
        </SelectTrigger>
        <SelectContent className="max-h-64 border-slate-200 bg-white text-slate-900">
          {Object.entries(stopsByZone).map(([zone, zoneStops]) => (
            <div key={zone}>
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-400">
                {zone}
              </div>
              {zoneStops.map((stop) => (
                <SelectItem
                  key={stop.id}
                  value={stop.id}
                  className="cursor-pointer text-slate-900 focus:bg-slate-100 focus:text-slate-900"
                >
                  <div className="flex items-center gap-2">
                    <span>{stop.name}</span>
                    <span className="text-xs text-slate-400">#{stop.stop_code}</span>
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      {selectedStopId && (
        <div className="mt-3 space-y-1 text-xs text-slate-500">
          {stops.find(s => s.id === selectedStopId)?.address && (
            <p>{stops.find(s => s.id === selectedStopId)?.address}</p>
          )}
          <div className="flex items-center gap-3">
            {stops.find(s => s.id === selectedStopId)?.has_shelter && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Shelter
              </span>
            )}
            {stops.find(s => s.id === selectedStopId)?.has_display && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Display
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
