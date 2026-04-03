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

interface KioskMapProps {
  stop?: BusStop
  stopId?: string
}

type MiniVehicle = {
  id: string
  lat: number
  lng: number
  route_number: string
  route_color: string
  eta_minutes?: number
}

function busIcon(color: string) {
  return L.divIcon({
    className: "bus-marker-root",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #0f172a;box-shadow:0 1px 4px rgba(0,0,0,.22)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export function KioskMap({ stop, stopId }: KioskMapProps) {
  const { t } = useI18n()
  const isDev = process.env.NODE_ENV === "development"
  const [vehicles, setVehicles] = useState<MiniVehicle[]>([])

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
          // Keep mini-map consistent with kiosk arrivals: show only buses
          // with an actionable ETA for the selected stop.
          setVehicles((data.vehicles ?? []).filter((v) => v.eta_minutes != null))
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
  }, [stopId, stop?.stop_code, isDev])

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
        {stop ? (
          <MapContainer
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
            {vehicles.slice(0, 8).map((v) => (
              <Marker
                key={v.id}
                position={[v.lat, v.lng]}
                icon={busIcon(v.route_color)}
              >
                <Tooltip direction="top">{v.route_number}</Tooltip>
              </Marker>
            ))}
          </MapContainer>
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

