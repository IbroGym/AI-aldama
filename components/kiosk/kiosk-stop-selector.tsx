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
    <div className="rounded-2xl bg-[#0d1424] p-4">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-blue-400" />
        <h3 className="font-semibold text-white">Select Stop</h3>
      </div>

      <Select value={selectedStopId} onValueChange={onSelect}>
        <SelectTrigger className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 [&>svg]:text-white/60">
          <SelectValue placeholder="Choose a stop" />
        </SelectTrigger>
        <SelectContent className="max-h-64 border-white/20 bg-[#0d1424] text-white">
          {Object.entries(stopsByZone).map(([zone, zoneStops]) => (
            <div key={zone}>
              <div className="px-2 py-1.5 text-xs font-semibold text-white/50">
                {zone}
              </div>
              {zoneStops.map((stop) => (
                <SelectItem
                  key={stop.id}
                  value={stop.id}
                  className="cursor-pointer text-white focus:bg-white/10 focus:text-white"
                >
                  <div className="flex items-center gap-2">
                    <span>{stop.name}</span>
                    <span className="text-xs text-white/40">#{stop.stop_code}</span>
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      {selectedStopId && (
        <div className="mt-3 space-y-1 text-xs text-white/50">
          {stops.find(s => s.id === selectedStopId)?.address && (
            <p>{stops.find(s => s.id === selectedStopId)?.address}</p>
          )}
          <div className="flex items-center gap-3">
            {stops.find(s => s.id === selectedStopId)?.has_shelter && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
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
