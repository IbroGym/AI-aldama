"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import type { BusStop, Alert, EtaPrediction, BusRoute } from "@/lib/types/database"
import type { EtaArrivalDTO } from "@/lib/vehicles/types"
import { KioskHeader } from "./kiosk-header"
import { KioskArrivals } from "./kiosk-arrivals"
import { KioskAlerts } from "./kiosk-alerts"
import { KioskVoiceAssistant } from "./kiosk-voice-assistant"
import { KioskStopSelector } from "./kiosk-stop-selector"

const KioskMap = dynamic(
  () => import("./kiosk-map").then((m) => m.KioskMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100 md:h-52" />
      </div>
    ),
  },
)
import { KioskWeather } from "./kiosk-weather"
import { KioskEmergencyActions } from "./kiosk-emergency-actions"
import { useI18n } from "@/components/i18n-provider"
import { getLocalizedStopName } from "@/lib/i18n/stops"
import {
  useSmoothedSimulationArrivals,
  type SmoothedEtaArrival,
} from "@/hooks/use-smoothed-simulation-etas"
import { ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID } from "@/lib/vehicles/route10-nu-demo-stops"

interface KioskDisplayProps {
  stops: BusStop[]
  defaultStopId?: string
  alerts: Alert[]
}

interface EtaWithDetails extends EtaPrediction {
  bus?: { bus_number: string }
  route?: BusRoute
}

const ROUTES_TO_SHOW = new Set(["10", "12", "46"])
const DEFAULT_ROUTE_NUMBERS = Array.from(ROUTES_TO_SHOW)

const STOP_ROUTE_OVERRIDES_BY_CODE: Record<string, string[]> = {
  "ccd5e97f-c483-4209-96d7-8d64466fdc26": ["10"],
  "12cabd75-d75d-4b82-8364-770c7812d47f": ["10"],
}

const STOP_ROUTE_OVERRIDES_BY_ID: Record<string, string[]> = {
  [ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID]: ["10"],
}

function getAllowedRouteNumbers(stop?: BusStop): string[] {
  if (stop?.id && STOP_ROUTE_OVERRIDES_BY_ID[stop.id]) {
    return STOP_ROUTE_OVERRIDES_BY_ID[stop.id]
  }
  const stopCode = stop?.stop_code
  if (stopCode && STOP_ROUTE_OVERRIDES_BY_CODE[stopCode]) {
    return STOP_ROUTE_OVERRIDES_BY_CODE[stopCode]
  }

  const normalizedName = (stop?.name || "").toLowerCase()
  if (
    normalizedName.includes("nazarbaev") ||
    normalizedName.includes("nazarbayev") ||
    normalizedName.includes("назарбаев")
  ) {
    return ["10"]
  }

  return DEFAULT_ROUTE_NUMBERS
}

function toKioskEta(
  a: SmoothedEtaArrival,
  stopId: string
): EtaWithDetails {
  const route: BusRoute = {
    id: a.route_id,
    route_number: a.route_number,
    route_name: a.route_name,
    color: a.route_color,
    is_active: true,
    created_at: "",
    updated_at: "",
  }
  return {
    id: `sim-${a.vehicle_id}-${stopId}`,
    stop_id: stopId,
    bus_id: a.vehicle_id,
    route_id: a.route_id,
    predicted_arrival: a.predicted_arrival,
    confidence: a.confidence_pct / 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    bus: { bus_number: a.bus_label },
    route,
  }
}

export function KioskDisplay({ stops, defaultStopId, alerts }: KioskDisplayProps) {
  const { t, locale } = useI18n()
  const isDev = process.env.NODE_ENV === "development"
  const [selectedStopId, setSelectedStopId] = useState(
    () => defaultStopId || stops[0]?.id,
  )

  useEffect(() => {
    if (!isDev) return
    const row = stops.find((s) => s.id === selectedStopId)
    console.info("[kiosk] selected stop (API uses bus_stops.id only)", {
      selectedStopId,
      selectedStopCode: row?.stop_code,
      inboundNuBusStopId: ROUTE_10_NU_INBOUND_SIDE_BUS_STOP_ID,
    })
  }, [isDev, selectedStopId, stops])

  useEffect(() => {
    if (!isDev) return
    const row = stops.find((s) => s.id === (defaultStopId || stops[0]?.id))
    console.info("[kiosk] init from server props", {
      defaultStopIdProp: defaultStopId,
      resolvedInitialId: defaultStopId || stops[0]?.id,
      row: row
        ? { id: row.id, stop_code: row.stop_code, name: row.name }
        : null,
    })
  }, [isDev, defaultStopId, stops])

  useEffect(() => {
    if (!isDev || !defaultStopId) return
    if (!stops.some((s) => s.id === defaultStopId)) {
      console.warn(
        "[kiosk] defaultStopId not in stops list — Radix Select may not show a value",
        { defaultStopId, stopIdsInList: stops.map((s) => s.id) },
      )
    }
  }, [isDev, defaultStopId, stops])

  // Demo/dev support: when we change kiosk binding (defaultStopId) on the server,
  // keep the client selection synchronized so /api/eta and /api/vehicles match.
  useEffect(() => {
    if (!isDev || !defaultStopId) return
    setSelectedStopId((prev) => (prev === defaultStopId ? prev : defaultStopId))
  }, [isDev, defaultStopId])
  const [rawArrivals, setRawArrivals] = useState<EtaArrivalDTO[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const firstLoadForStop = useRef(true)

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
  const allowedRouteSet = useMemo(
    () => new Set(allowedRouteNumbers),
    [allowedRouteNumbers]
  )

  const smoothed = useSmoothedSimulationArrivals(rawArrivals, !!selectedStopId)

  const etas: EtaWithDetails[] = useMemo(() => {
    if (!selectedStopId || !smoothed.length) return []
    return smoothed
      .filter((a) => allowedRouteSet.has(a.route_number))
      .slice(0, 8)
      .map((a) => toKioskEta(a, selectedStopId))
  }, [smoothed, selectedStopId, allowedRouteSet])

  useEffect(() => {
    if (!isDev || !selectedStopId) return
    console.info("[kiosk-eta] raw /api/eta response", {
      stop_id: selectedStopId,
      raw_count: rawArrivals?.length ?? 0,
      raw_vehicle_ids: (rawArrivals ?? []).map((a) => a.vehicle_id),
      raw_route_numbers: (rawArrivals ?? []).map((a) => a.route_number),
    })
  }, [isDev, rawArrivals, selectedStopId])

  useEffect(() => {
    if (!isDev || !selectedStopId) return
    console.info("[kiosk-eta] final arrivals after kiosk filters", {
      stop_id: selectedStopId,
      allowed_routes: allowedRouteNumbers,
      smoothed_count: smoothed.length,
      final_count: etas.length,
      final_vehicle_ids: etas.map((e) => e.bus_id),
      final_route_numbers: etas.map((e) => e.route?.route_number ?? "unknown"),
    })
  }, [isDev, selectedStopId, allowedRouteNumbers, smoothed, etas])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    firstLoadForStop.current = true
  }, [selectedStopId])

  const fetchSimulationEtas = useCallback(async () => {
    if (!selectedStopId) return

    if (firstLoadForStop.current) setLoading(true)
    try {
      const stopRow = stops.find((s) => s.id === selectedStopId)
      if (isDev) {
        console.info("[kiosk] GET /api/eta", {
          stop_id_query: selectedStopId,
          stop_code_row: stopRow?.stop_code,
        })
      }
      const res = await fetch(
        `/api/eta?stop_id=${encodeURIComponent(selectedStopId)}${isDev ? "&debug=1&trace=1" : ""}`,
        { cache: "no-store" }
      )
      if (!res.ok) {
        setRawArrivals([])
        return
      }
      const data = (await res.json()) as { arrivals: EtaArrivalDTO[] }
      setRawArrivals(data.arrivals ?? [])
    } catch {
      setRawArrivals([])
    } finally {
      if (firstLoadForStop.current) {
        setLoading(false)
        firstLoadForStop.current = false
      }
    }
  }, [selectedStopId, isDev, stops])

  useEffect(() => {
    void fetchSimulationEtas()
    const interval = setInterval(() => void fetchSimulationEtas(), 4000)
    return () => clearInterval(interval)
  }, [fetchSimulationEtas])

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f7fb] text-slate-900">
      <KioskHeader
        stopName={selectedStop?.name || t("kiosk.unknownStop")}
        currentTime={currentTime}
        stopIdForApi={selectedStopId}
        showDevStopIds={isDev}
      />

      <main className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
          <div className="hidden w-full min-w-[320px] flex-1 flex-col gap-4 lg:flex lg:flex-[1.3]">
            <KioskArrivals etas={etas} loading={loading} currentTime={currentTime} />
            <KioskAlerts alerts={alerts} />
          </div>

          <div className="flex w-full flex-1 flex-col gap-4 lg:flex-[2.2]">
            <KioskMap
              stop={selectedStop}
              stopId={selectedStopId}
              etas={etas}
              relevantRouteNumbers={allowedRouteNumbers}
              currentTime={currentTime}
            />

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)] lg:p-6">
              <KioskVoiceAssistant stopId={selectedStopId} stopName={selectedStop?.name} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:hidden">
              <KioskArrivals etas={etas} loading={loading} currentTime={currentTime} />
            </div>
          </div>

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
                showDevStopIds={isDev}
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
