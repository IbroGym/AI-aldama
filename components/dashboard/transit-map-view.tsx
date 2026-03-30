"use client"

import { useI18n } from "@/components/i18n-provider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TransitContextDTO, VehicleDTO } from "@/lib/vehicles/types"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

function useSmoothedVehicles(vehicles: VehicleDTO[]): VehicleDTO[] {
  const smooth = useRef(new Map<string, { lat: number; lng: number }>())
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const alive = new Set(vehicles.map((v) => v.id))
    for (const id of smooth.current.keys()) {
      if (!alive.has(id)) smooth.current.delete(id)
    }
    for (const v of vehicles) {
      if (!smooth.current.has(v.id)) {
        smooth.current.set(v.id, { lat: v.lat, lng: v.lng })
      }
    }
  }, [vehicles])

  useEffect(() => {
    let frame: number
    const step = () => {
      let moved = false
      for (const v of vehicles) {
        const cur = smooth.current.get(v.id)
        if (!cur) continue
        const lat = cur.lat + (v.lat - cur.lat) * 0.2
        const lng = cur.lng + (v.lng - cur.lng) * 0.2
        if (
          Math.abs(lat - cur.lat) > 1e-7 ||
          Math.abs(lng - cur.lng) > 1e-7
        ) {
          moved = true
        }
        smooth.current.set(v.id, { lat, lng })
      }
      if (moved) {
        setVersion((x) => x + 1)
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [vehicles])

  return useMemo(
    () =>
      vehicles.map((v) => {
        const s = smooth.current.get(v.id)
        return s ? { ...v, lat: s.lat, lng: s.lng } : v
      }),
    [vehicles, version],
  )
}

function busRotatedIcon(color: string, headingDeg: number) {
  return L.divIcon({
    className: "bus-marker-root",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2px solid #0f172a;display:flex;align-items:center;justify-content:center;transform:rotate(${headingDeg}deg);box-shadow:0 2px 6px rgba(0,0,0,.25)"><span style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:8px solid #fff;margin-bottom:2px"></span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function FitAstana({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 12, { animate: false })
  }, [map, center])
  return null
}

export function TransitMapView() {
  const { t } = useI18n()
  const [transit, setTransit] = useState<TransitContextDTO | null>(null)
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([])
  const [highlightedIds, setHighlightedIds] = useState<string[]>([])
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const [onlyMyStop, setOnlyMyStop] = useState(false)
  const [selectedBus, setSelectedBus] = useState<VehicleDTO | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sourceNote, setSourceNote] = useState("")

  const smoothed = useSmoothedVehicles(vehicles)

  const center: [number, number] = useMemo(
    () =>
      transit
        ? [transit.center.lat, transit.center.lng]
        : [51.1694, 71.4491],
    [transit],
  )

  const fetchTransit = useCallback(async () => {
    try {
      const res = await fetch("/api/map/transit")
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as TransitContextDTO
      setTransit(data)
      setSourceNote(
        data.data_source === "mock"
          ? t("dashboard.map.dataMock")
          : t("dashboard.map.dataSupabase"),
      )
      setLoadError(null)
    } catch {
      setLoadError(t("dashboard.map.loadFailed"))
    }
  }, [t])

  const fetchVehicles = useCallback(async () => {
    const params = new URLSearchParams()
    if (selectedStopId) {
      params.set("stop_id", selectedStopId)
      if (onlyMyStop) params.set("filter", "stop")
    }
    try {
      const res = await fetch(`/api/vehicles?${params.toString()}`)
      if (!res.ok) return
      const data = (await res.json()) as {
        vehicles: VehicleDTO[]
        highlighted_route_ids: string[]
      }
      setVehicles(data.vehicles)
      setHighlightedIds(data.highlighted_route_ids ?? [])
    } catch {
      /* keep last snapshot */
    }
  }, [selectedStopId, onlyMyStop])

  useEffect(() => {
    void fetchTransit()
  }, [fetchTransit])

  useEffect(() => {
    void fetchVehicles()
    const id = window.setInterval(() => void fetchVehicles(), 4000)
    return () => clearInterval(id)
  }, [fetchVehicles])

  const routeStyle = useCallback(
    (routeId: string) => {
      const on = highlightedIds.includes(routeId)
      return {
        weight: on ? 6 : 3,
        opacity: selectedStopId ? (on ? 0.95 : 0.22) : 0.55,
      }
    },
    [highlightedIds, selectedStopId],
  )

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Card className="min-h-[520px] flex-1 overflow-hidden p-0">
        <CardHeader className="border-b px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{t("dashboard.map.title")}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {sourceNote}
                {loadError ? ` · ${loadError}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="only-stop"
                  checked={onlyMyStop}
                  disabled={!selectedStopId}
                  onCheckedChange={setOnlyMyStop}
                />
                <Label htmlFor="only-stop" className="text-xs font-normal">
                  {t("dashboard.map.onlyMyStop")}
                </Label>
              </div>
              {selectedStopId && (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setSelectedStopId(null)
                    setOnlyMyStop(false)
                    setSelectedBus(null)
                  }}
                >
                  {t("dashboard.map.clearStop")}
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative h-[min(70vh,560px)] w-full [&_.leaflet-container]:z-0">
            <MapContainer
              center={center}
              zoom={12}
              className="h-full w-full rounded-b-lg"
              scrollWheelZoom
            >
              <FitAstana center={center} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {transit?.routes.map((route) => (
                <Polyline
                  key={route.id}
                  positions={route.coordinates.map(([lat, lng]) => [lat, lng])}
                  pathOptions={{
                    color: route.color,
                    ...routeStyle(route.id),
                  }}
                />
              ))}
              {transit?.stops.map((stop) => {
                const selected = stop.id === selectedStopId
                return (
                  <CircleMarker
                    key={stop.id}
                    center={[stop.lat, stop.lng]}
                    radius={selected ? 11 : 7}
                    pathOptions={{
                      color: selected ? "#0f172a" : "#64748b",
                      fillColor: selected ? "#3b82f6" : "#94a3b8",
                      fillOpacity: 0.9,
                      weight: 2,
                    }}
                    eventHandlers={{
                      click: () => {
                        setSelectedStopId(stop.id)
                        setSelectedBus(null)
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                      {stop.name}
                    </Tooltip>
                    <Popup>
                      <div className="text-sm font-medium">{stop.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {stop.stop_code}
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
              {smoothed.map((v) => (
                <Marker
                  key={v.id}
                  position={[v.lat, v.lng]}
                  icon={busRotatedIcon(v.route_color, v.heading_deg)}
                  eventHandlers={{
                    click: () => setSelectedBus(v),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]}>
                    {v.route_number}
                  </Tooltip>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full shrink-0 lg:w-80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("dashboard.map.busDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!selectedBus ? (
            <p className="text-xs text-muted-foreground">
              {t("dashboard.map.selectBus")}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  style={{
                    borderColor: selectedBus.route_color,
                    color: selectedBus.route_color,
                  }}
                >
                  {t("dashboard.map.route")} {selectedBus.route_number}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {selectedBus.route_name}
                </span>
              </div>
              {selectedStopId && selectedBus.eta_minutes != null ? (
                <div className="rounded-md border bg-muted/40 p-3 text-xs">
                  <div className="font-medium text-foreground">
                    {t("dashboard.map.eta")}: ~{selectedBus.eta_minutes}{" "}
                    {t("common.minutes")}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {t("dashboard.map.confidence")}:{" "}
                    {selectedBus.eta_confidence_pct ?? "—"}%
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.map.etaHint")}
                </p>
              )}
              <div className="text-xs text-muted-foreground">
                {t("dashboard.map.speed")}:{" "}
                {Math.round(selectedBus.speed_kmh)} km/h
              </div>
            </>
          )}
          <div className="border-t pt-3 text-xs text-muted-foreground">
            {t("dashboard.map.pollingHint")}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
