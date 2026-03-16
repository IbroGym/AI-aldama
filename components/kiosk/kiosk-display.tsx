"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { BusStop, Alert, EtaPrediction, BusRoute } from "@/lib/types/database"
import { KioskHeader } from "./kiosk-header"
import { KioskArrivals } from "./kiosk-arrivals"
import { KioskAlerts } from "./kiosk-alerts"
import { KioskVoiceAssistant } from "./kiosk-voice-assistant"
import { KioskStopSelector } from "./kiosk-stop-selector"
import { KioskMap } from "./kiosk-map"

interface KioskDisplayProps {
  stops: BusStop[]
  defaultStopId?: string
  alerts: Alert[]
}

interface EtaWithDetails extends EtaPrediction {
  bus?: { bus_number: string }
  route?: BusRoute
}

// All available routes in the system
const ALL_ROUTES = [
  { id: "r1", route_number: "42", route_name: "Downtown Express", color: "#3B82F6" },
  { id: "r2", route_number: "15", route_name: "Airport Line", color: "#10B981" },
  { id: "r3", route_number: "7", route_name: "University Circle", color: "#F59E0B" },
  { id: "r4", route_number: "23", route_name: "Harbor Route", color: "#8B5CF6" },
  { id: "r5", route_number: "31", route_name: "Tech Park Shuttle", color: "#EC4899" },
  { id: "r6", route_number: "8", route_name: "Riverside Local", color: "#06B6D4" },
  { id: "r7", route_number: "55", route_name: "Medical Center", color: "#EF4444" },
  { id: "r8", route_number: "19", route_name: "Stadium Express", color: "#84CC16" },
]

// Deterministic hash function for stop ID to get consistent routes per stop
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Generate mock ETAs that are always in the future relative to current time
// Each stop gets a different subset of routes based on its ID
function generateMockEtas(stopId: string): EtaWithDetails[] {
  const now = new Date()
  const stopHash = hashString(stopId)
  
  // Each stop gets 2-4 different routes based on its hash
  const numRoutes = 2 + (stopHash % 3)
  const routeStartIndex = stopHash % ALL_ROUTES.length
  const stopRoutes: typeof ALL_ROUTES = []
  
  for (let i = 0; i < numRoutes; i++) {
    const routeIndex = (routeStartIndex + i * 2) % ALL_ROUTES.length
    stopRoutes.push(ALL_ROUTES[routeIndex])
  }
  
  // Generate different arrival patterns per stop
  const baseOffset = (stopHash % 5) + 1 // 1-5 minutes base offset
  const frequency = 5 + (stopHash % 8) // 5-12 minutes between arrivals
  
  const etas: EtaWithDetails[] = []
  let busCounter = 100 + (stopHash % 100)
  
  // Generate arrivals for each route at this stop
  for (let routeIdx = 0; routeIdx < stopRoutes.length; routeIdx++) {
    const route = stopRoutes[routeIdx]
    const routeOffset = baseOffset + (routeIdx * 3) // Stagger routes
    
    // Each route has 1-2 upcoming buses
    const numBuses = 1 + ((stopHash + routeIdx) % 2)
    
    for (let busIdx = 0; busIdx < numBuses; busIdx++) {
      const arrivalMins = routeOffset + (busIdx * frequency) + (routeIdx * 2)
      const arrival = new Date(now.getTime() + arrivalMins * 60000)
      
      etas.push({
        id: `mock-eta-${stopId}-${route.id}-${busIdx}`,
        stop_id: stopId,
        bus_id: `bus-${busCounter}`,
        route_id: route.id,
        predicted_arrival: arrival.toISOString(),
        confidence: 0.78 + (((stopHash + routeIdx + busIdx) % 22) / 100),
        source: "simulation" as const,
        created_at: now.toISOString(),
        bus: { bus_number: `B${busCounter}` },
        route: route as BusRoute,
      })
      
      busCounter++
    }
  }
  
  // Sort by arrival time and limit to 6
  return etas
    .sort((a, b) => new Date(a.predicted_arrival).getTime() - new Date(b.predicted_arrival).getTime())
    .slice(0, 6)
}

export function KioskDisplay({ stops, defaultStopId, alerts }: KioskDisplayProps) {
  const [selectedStopId, setSelectedStopId] = useState(defaultStopId || stops[0]?.id)
  const [etas, setEtas] = useState<EtaWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [usesMockData, setUsesMockData] = useState(false)

  const selectedStop = stops.find(s => s.id === selectedStopId)
  const supabase = useMemo(() => createClient(), [])

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch ETAs for selected stop
  const fetchEtas = useCallback(async () => {
    if (!selectedStopId) return

    // If supabase is not configured, use mock data
    if (!supabase) {
      setEtas(generateMockEtas(selectedStopId))
      setLoading(false)
      setUsesMockData(true)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("eta_predictions")
        .select("*, bus:buses(bus_number), route:bus_routes(*)")
        .eq("stop_id", selectedStopId)
        .gte("predicted_arrival", new Date().toISOString())
        .order("predicted_arrival", { ascending: true })
        .limit(6)

      if (error) {
        console.log("[v0] Supabase error, using mock data:", error.message)
        setEtas(generateMockEtas(selectedStopId))
        setUsesMockData(true)
      } else if (!data || data.length === 0) {
        // No data in database, use mock data for demonstration
        setEtas(generateMockEtas(selectedStopId))
        setUsesMockData(true)
      } else {
        setEtas(data)
        setUsesMockData(false)
      }
    } catch (err) {
      console.log("[v0] Fetch error, using mock data:", err)
      setEtas(generateMockEtas(selectedStopId))
      setUsesMockData(true)
    }
    setLoading(false)
  }, [selectedStopId, supabase])

  useEffect(() => {
    fetchEtas()

    // Refresh ETAs every 30 seconds
    const interval = setInterval(fetchEtas, 30000)
    return () => clearInterval(interval)
  }, [fetchEtas])

  // If using mock data, regenerate ETAs periodically to keep them fresh
  useEffect(() => {
    if (!usesMockData || !selectedStopId) return

    const refreshInterval = setInterval(() => {
      setEtas(generateMockEtas(selectedStopId))
    }, 60000) // Refresh mock data every minute

    return () => clearInterval(refreshInterval)
  }, [usesMockData, selectedStopId])

  // Subscribe to realtime updates (only if supabase is configured)
  useEffect(() => {
    if (!selectedStopId || !supabase) return

    const channel = supabase
      .channel(`kiosk-${selectedStopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "eta_predictions",
          filter: `stop_id=eq.${selectedStopId}`,
        },
        () => {
          // Refetch ETAs on any change
          fetchEtas()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedStopId, supabase, fetchEtas])

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f7fb] text-slate-900">
      <KioskHeader 
        stopName={selectedStop?.name || "Unknown Stop"} 
        currentTime={currentTime}
        stopCode={selectedStop?.stop_code}
      />

      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Secondary info column: arrivals + alerts */}
          <div className="hidden w-full min-w-[320px] flex-1 flex-col gap-4 lg:flex lg:flex-[1.3]">
            <KioskArrivals etas={etas} loading={loading} currentTime={currentTime} />
            <KioskAlerts alerts={alerts} />
          </div>

          {/* Primary focus: center column – map on top, assistant beneath */}
          <div className="flex w-full flex-1 flex-col gap-4 lg:flex-[2.2]">
            <KioskMap stop={selectedStop} />

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)] lg:p-6">
              <KioskVoiceAssistant stopId={selectedStopId} stopName={selectedStop?.name} />
            </div>

            {/* Compact arrivals for small screens only */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:hidden">
              <KioskArrivals etas={etas} loading={loading} currentTime={currentTime} />
            </div>
          </div>

          {/* Right sidebar: stop selector + alerts */}
          <div className="flex w-full flex-col gap-4 lg:w-96">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <KioskStopSelector 
                stops={stops} 
                selectedStopId={selectedStopId} 
                onSelect={setSelectedStopId} 
              />
            </div>
            <KioskAlerts alerts={alerts} />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Smart Bus Stop System</span>
          <span>Ask anything about your trip</span>
        </div>
      </footer>
    </div>
  )
}
