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
import { KioskWeather } from "./kiosk-weather"
import { KioskEmergencyActions } from "./kiosk-emergency-actions"
import { useI18n } from "@/components/i18n-provider"
import { getLocalizedStopName } from "@/lib/i18n/stops"

interface KioskDisplayProps {
  stops: BusStop[]
  defaultStopId?: string
  alerts: Alert[]
}

interface EtaWithDetails extends EtaPrediction {
  bus?: { bus_number: string }
  route?: BusRoute
}

// Routes that should be shown on the kiosk
const ROUTES_TO_SHOW = new Set(["10", "12"])
const DEFAULT_ROUTE_NUMBERS = Array.from(ROUTES_TO_SHOW)

// Per-stop overrides for routes that should be visible in the kiosk.
// stop_code in bus_stops for this GTFS feed is the GTFS stop_id.
const STOP_ROUTE_OVERRIDES: Record<string, string[]> = {
  "ccd5e97f-c483-4209-96d7-8d64466fdc26": ["10"], // Назарбаев Университет
  "12cabd75-d75d-4b82-8364-770c7812d47f": ["10"], // Назарбаев Университет (alternate stop_id)
}

// Mock ETAs fallback routes (when Supabase is missing/unavailable)
const MOCK_ROUTES: Array<{ id: string; route_number: string; route_name: string; color: string }> = [
  { id: "mock-r10", route_number: "10", route_name: "Route 10", color: "#3B82F6" },
  { id: "mock-r12", route_number: "12", route_name: "Route 12", color: "#10B981" },
]
const MOCK_ROUTES_BY_NUMBER = Object.fromEntries(MOCK_ROUTES.map((route) => [route.route_number, route]))

function getAllowedRouteNumbers(stop?: BusStop): string[] {
  const stopCode = stop?.stop_code
  if (stopCode && STOP_ROUTE_OVERRIDES[stopCode]) return STOP_ROUTE_OVERRIDES[stopCode]

  // Keep this robust even if GTFS stop IDs change between feed versions.
  const normalizedName = (stop?.name || "").toLowerCase()
  if (normalizedName.includes("nazarbaev") || normalizedName.includes("nazarbayev") || normalizedName.includes("назарбаев")) {
    return ["10"]
  }

  return DEFAULT_ROUTE_NUMBERS
}

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
function generateMockEtas(stopId: string, allowedRouteNumbers: string[]): EtaWithDetails[] {
  const now = new Date()
  const stopHash = hashString(stopId)
  const stopRoutes = allowedRouteNumbers
    .map((routeNumber) => MOCK_ROUTES_BY_NUMBER[routeNumber])
    .filter((route): route is (typeof MOCK_ROUTES)[number] => !!route)

  if (stopRoutes.length === 0) return []
  
  // Generate different arrival patterns per stop
  const baseOffset = (stopHash % 5) + 1 // 1-5 minutes base offset
  const frequency = 5 + (stopHash % 8) // 5-12 minutes between arrivals
  
  const etas: EtaWithDetails[] = []
  let busCounter = 100 + (stopHash % 100)
  
  // Generate arrivals for allowed routes at this stop
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
  const { t, locale } = useI18n()
  const [selectedStopId, setSelectedStopId] = useState(defaultStopId || stops[0]?.id)
  const [etas, setEtas] = useState<EtaWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [usesMockData, setUsesMockData] = useState(false)

  const localizedStops = useMemo(
    () =>
      stops.map((s) => ({
        ...s,
        name: getLocalizedStopName(s.name, s.stop_code, locale, s),
      })),
    [stops, locale]
  )

  const selectedStop = localizedStops.find((s) => s.id === selectedStopId)
  const allowedRouteNumbers = getAllowedRouteNumbers(selectedStop)
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
      setEtas(generateMockEtas(selectedStopId, allowedRouteNumbers))
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
        // Fetch more so we can filter to only routes 10/12.
        .limit(30)

      if (error) {
        console.log("[v0] Supabase error, using mock data:", error.message)
        setEtas(generateMockEtas(selectedStopId, allowedRouteNumbers))
        setUsesMockData(true)
      } else if (!data || data.length === 0) {
        // No data in database, use mock data for demonstration
        setEtas(generateMockEtas(selectedStopId, allowedRouteNumbers))
        setUsesMockData(true)
      } else {
        const allowedRouteSet = new Set(allowedRouteNumbers)
        const filtered = data
          .filter((eta) => allowedRouteSet.has(String(eta.route?.route_number ?? "")))
          .slice(0, 6)

        setEtas(filtered)
        setUsesMockData(false)
      }
    } catch (err) {
      console.log("[v0] Fetch error, using mock data:", err)
      setEtas(generateMockEtas(selectedStopId, allowedRouteNumbers))
      setUsesMockData(true)
    }
    setLoading(false)
  }, [selectedStopId, supabase, allowedRouteNumbers])

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
      setEtas(generateMockEtas(selectedStopId, allowedRouteNumbers))
    }, 60000) // Refresh mock data every minute

    return () => clearInterval(refreshInterval)
  }, [usesMockData, selectedStopId, allowedRouteNumbers])

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
        stopName={selectedStop?.name || t("kiosk.unknownStop")} 
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
            <KioskWeather
              latitude={selectedStop?.latitude}
              longitude={selectedStop?.longitude}
              locationLabel={selectedStop?.name || undefined}
            />
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <KioskStopSelector 
                stops={localizedStops} 
                selectedStopId={selectedStopId} 
                onSelect={setSelectedStopId} 
              />
            </div>
            <KioskEmergencyActions stopName={selectedStop?.name} />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{t("kiosk.footerLeft")}</span>
          <span>{t("kiosk.footerRight")}</span>
        </div>
      </footer>
    </div>
  )
}
