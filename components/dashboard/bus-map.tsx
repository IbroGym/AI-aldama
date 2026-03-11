"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { BusPosition, BusStop } from "@/lib/types/database"
import { Bus, MapPin } from "lucide-react"

interface BusMapProps {
  positions: BusPosition[]
  stops: BusStop[]
}

export function BusMap({ positions, stops }: BusMapProps) {
  // Calculate bounds for the simulated map
  const allLats = [...positions.map(p => p.latitude), ...stops.map(s => s.latitude)]
  const allLngs = [...positions.map(p => p.longitude), ...stops.map(s => s.longitude)]
  
  const minLat = Math.min(...allLats)
  const maxLat = Math.max(...allLats)
  const minLng = Math.min(...allLngs)
  const maxLng = Math.max(...allLngs)
  
  const latRange = maxLat - minLat || 0.01
  const lngRange = maxLng - minLng || 0.01

  const getPosition = (lat: number, lng: number) => ({
    x: ((lng - minLng) / lngRange) * 100,
    y: ((maxLat - lat) / latRange) * 100,
  })

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Live Fleet Map</CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span>Buses</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-accent" />
              <span>Stops</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-secondary/50">
          {/* Grid lines */}
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-6">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className="border border-border/20" />
            ))}
          </div>

          {/* Bus Stops */}
          {stops.map((stop) => {
            const pos = getPosition(stop.latitude, stop.longitude)
            return (
              <div
                key={stop.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                title={stop.name}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 ring-1 ring-accent/40">
                  <MapPin className="h-3 w-3 text-accent" />
                </div>
              </div>
            )
          })}

          {/* Buses */}
          {positions.map((position) => {
            const pos = getPosition(position.latitude, position.longitude)
            const bus = position.bus
            const routeColor = bus?.current_route?.color || "#3B82F6"
            
            return (
              <div
                key={position.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-500"
                style={{ 
                  left: `${pos.x}%`, 
                  top: `${pos.y}%`,
                  transform: `translate(-50%, -50%) rotate(${position.heading || 0}deg)`
                }}
                title={`${bus?.bus_number || 'Bus'} - ${bus?.current_route?.route_name || 'Unknown Route'}`}
              >
                <div 
                  className="flex h-7 w-7 items-center justify-center rounded-full shadow-md ring-2 ring-background"
                  style={{ backgroundColor: routeColor }}
                >
                  <Bus className="h-4 w-4 text-white" style={{ transform: `rotate(-${position.heading || 0}deg)` }} />
                </div>
              </div>
            )
          })}

          {positions.length === 0 && stops.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No active buses or stops to display
            </div>
          )}
        </div>

        {/* Bus List */}
        <div className="mt-4 space-y-2">
          {positions.slice(0, 4).map((position) => {
            const bus = position.bus
            return (
              <div key={position.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    style={{ 
                      borderColor: bus?.current_route?.color,
                      color: bus?.current_route?.color
                    }}
                  >
                    {bus?.bus_number}
                  </Badge>
                  <span className="text-muted-foreground">{bus?.current_route?.route_name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {position.speed ? `${Math.round(position.speed)} km/h` : 'Stationary'}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
