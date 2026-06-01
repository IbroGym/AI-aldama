"use client"

import type { BusStop } from "@/lib/types/database"
import { MapPin } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { useEffect, useMemo, useState } from "react"
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import {
  KioskExpandedTransitMap,
  type KioskExpandedEtaRow,
} from "./kiosk-expanded-transit-map"

interface KioskMapProps {
  stop?: BusStop
  stopId?: string
  /** Same arrivals as the kiosk list — used for expanded overlay + next-bus highlight. */
  etas?: KioskExpandedEtaRow[]
  /** Route numbers this kiosk considers for the stop (from getAllowedRouteNumbers). */
  relevantRouteNumbers?: string[]
  currentTime?: Date
}

type MiniVehicle = {
  id: string
  lat: number
  lng: number
  route_number: string
  route_color: string
  heading_deg?: number
  eta_minutes?: number
}

/** Matches dashboard bus marker: colored circle + white arrow along `heading_deg`. */
function miniKioskBusIcon(color: string, headingDeg: number) {
  const size = 18
  const arrowH = Math.max(5, Math.round(size * 0.31))
  const arrowW = Math.max(3, Math.round(size * 0.15))
  const mb = Math.max(1, Math.round(size * 0.08))
  return L.divIcon({
    className: "bus-marker-root",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #0f172a;display:flex;align-items:center;justify-content:center;transform:rotate(${headingDeg}deg);box-shadow:0 1px 4px rgba(0,0,0,.22)"><span style="width:0;height:0;border-left:${arrowW}px solid transparent;border-right:${arrowW}px solid transparent;border-bottom:${arrowH}px solid #fff;margin-bottom:${mb}px"></span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function KioskMap({
  stop,
  stopId,
  etas = [],
  relevantRouteNumbers = [],
  currentTime = new Date(),
}: KioskMapProps) {
  const { t } = useI18n()
  const isDev = process.env.NODE_ENV === "development"
  const [vehicles, setVehicles] = useState<MiniVehicle[]>([])
  const [expandedOpen, setExpandedOpen] = useState(false)

  useEffect(() => {
    if (!stopId) {
      setVehicles([])
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        if (isDev) {
          console.info("[kiosk] GET /api/vehicles", {
            stop_id_query: stopId,
            stop_code_row: stop?.stop_code,
          })
        }
        const res = await fetch(
          `/api/vehicles?stop_id=${encodeURIComponent(stopId)}&filter=stop`,
          { cache: "no-store" }
        )
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { vehicles: MiniVehicle[] }
        if (!cancelled) {
          const allowed = new Set(
            relevantRouteNumbers.length
              ? relevantRouteNumbers
              : ["10", "12", "46"],
          )
          const list = (data.vehicles ?? []).filter((v) =>
            allowed.has(v.route_number),
          )
          // Show all buses on kiosk-relevant routes (same as expanded map), not only those with ETA.
          const sorted = [...list].sort((a, b) => {
            const ae = a.eta_minutes
            const be = b.eta_minutes
            if (ae != null && be != null) return ae - be
            if (ae != null) return -1
            if (be != null) return 1
            return 0
          })
          setVehicles(sorted.slice(0, 12))
        }
      } catch {
        if (!cancelled) setVehicles([])
      }
    }
    void load()
    const interval = setInterval(() => void load(), 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [stopId, stop?.stop_code, isDev, relevantRouteNumbers])

  const center = useMemo<[number, number]>(
    () => [stop?.latitude ?? 51.1694, stop?.longitude ?? 71.4491],
    [stop?.latitude, stop?.longitude]
  )

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          <div className="text-sm font-semibold text-slate-900">
            {t("kiosk.stopLocation")}
          </div>
        </div>
        {stop?.zone && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            {stop.zone}
          </span>
        )}
      </div>

      <div className="relative h-40 overflow-hidden rounded-2xl md:h-52 [&_.leaflet-container]:z-0">
        {stop && stopId ? (
          <>
            <MapContainer
              key={stopId ?? "none"}
              center={center}
              zoom={14}
              scrollWheelZoom={false}
              dragging={false}
              doubleClickZoom={false}
              touchZoom={false}
              zoomControl={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CircleMarker
                center={[stop.latitude, stop.longitude]}
                radius={9}
                pathOptions={{
                  color: "#0f172a",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="top" offset={[0, -8]}>
                  {stop.name}
                </Tooltip>
              </CircleMarker>
              {vehicles.map((v) => (
                <Marker
                  key={v.id}
                  position={[v.lat, v.lng]}
                  icon={miniKioskBusIcon(
                    v.route_color,
                    v.heading_deg ?? 0,
                  )}
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    {v.route_number}
                    {v.eta_minutes != null
                      ? ` · ~${v.eta_minutes} ${t("common.minutes")}`
                      : ""}
                  </Tooltip>
                </Marker>
              ))}
            </MapContainer>
            {!expandedOpen && (
              <button
                type="button"
                className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-end bg-gradient-to-t from-slate-900/25 via-transparent to-transparent pb-2 text-center outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={() => setExpandedOpen(true)}
                aria-label={t("kiosk.expandMapTitle")}
              >
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-800 shadow-md backdrop-blur-sm">
                  {t("kiosk.mapTapHint")}
                </span>
              </button>
            )}
            <KioskExpandedTransitMap
              open={expandedOpen}
              onOpenChange={setExpandedOpen}
              stop={stop}
              stopId={stopId}
              relevantRouteNumbers={
                relevantRouteNumbers.length
                  ? relevantRouteNumbers
                  : ["10", "12", "46"]
              }
              etas={etas}
              currentTime={currentTime}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            {t("kiosk.noStopSelected")}
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
