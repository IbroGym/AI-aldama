"use client"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BusStop } from "@/lib/types/database"
import type { MapRouteDTO, TransitContextDTO, VehicleDTO } from "@/lib/vehicles/types"
import { cn } from "@/lib/utils"
import {
  Fragment,
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
import { X } from "lucide-react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

/** Minimal ETA row — same shape as kiosk arrivals list items. */
export type KioskExpandedEtaRow = {
  id: string
  bus_id: string
  predicted_arrival: string
  route?: {
    route_number: string
    route_name?: string | null
    color?: string | null
  } | null
  bus?: { bus_number?: string } | null
}

/** Zoom when user taps "return to stop" or when tracking a bus — street-level, subject to map maxZoom. */
const STOP_RESET_ZOOM = 16
const STOP_ONLY_PAD_DEG = 0.004
/** Extra margin around focused content for maxBounds (pan limit), as fraction of span. */
const PAN_LIMIT_MARGIN_RATIO = 0.38
const PAN_LIMIT_MIN_MARGIN_DEG = 0.012
const PAN_LIMIT_MAX_MARGIN_LAT = 0.055
const PAN_LIMIT_MAX_MARGIN_LNG = 0.07

function servingRoutesForStop(
  transit: TransitContextDTO | null,
  stopId: string,
  relevantRouteNumbers: string[],
  etas: KioskExpandedEtaRow[],
): MapRouteDTO[] {
  if (!transit?.routes.length) return []
  const rel = new Set(relevantRouteNumbers)
  const byStop = transit.routes.filter(
    (r) => rel.has(r.route_number) && r.stop_ids_ordered.includes(stopId),
  )
  if (byStop.length) return byStop
  const fromArrivals = new Set(
    etas
      .map((e) => e.route?.route_number)
      .filter((x): x is string => !!x),
  )
  const byEta = transit.routes.filter((r) => fromArrivals.has(r.route_number))
  if (byEta.length) return byEta
  return transit.routes.filter((r) => rel.has(r.route_number))
}

function extendBoundsWithCoords(
  b: L.LatLngBounds,
  coords: [number, number][] | undefined,
) {
  if (!coords?.length) return
  for (const [lat, lng] of coords) {
    b.extend([lat, lng])
  }
}

/**
 * Bounds around stop + visible route geometries + optional bus positions.
 */
function computeFocusedLatLngBounds(
  stopCenter: [number, number],
  routes: MapRouteDTO[],
  vehicles: Pick<VehicleDTO, "lat" | "lng">[],
): L.LatLngBounds {
  const b = L.latLngBounds(stopCenter, stopCenter)
  for (const route of routes) {
    if (route.coordinates_by_direction) {
      extendBoundsWithCoords(
        b,
        route.coordinates_by_direction.outbound ?? route.coordinates,
      )
      extendBoundsWithCoords(
        b,
        route.coordinates_by_direction.inbound ?? route.coordinates,
      )
    } else {
      extendBoundsWithCoords(b, route.coordinates)
    }
  }
  for (const v of vehicles) {
    b.extend([v.lat, v.lng])
  }
  const sw = b.getSouthWest()
  const ne = b.getNorthEast()
  const latSpan = ne.lat - sw.lat
  const lngSpan = ne.lng - sw.lng
  if (latSpan < 1e-8 && lngSpan < 1e-8) {
    return L.latLngBounds(
      [stopCenter[0] - STOP_ONLY_PAD_DEG, stopCenter[1] - STOP_ONLY_PAD_DEG],
      [stopCenter[0] + STOP_ONLY_PAD_DEG, stopCenter[1] + STOP_ONLY_PAD_DEG],
    )
  }
  return b
}

/** Wider bounds so the user cannot pan far away from the current transit context. */
function panLimitBoundsFromFocused(focused: L.LatLngBounds): L.LatLngBounds {
  const sw = focused.getSouthWest()
  const ne = focused.getNorthEast()
  const latSpan = Math.max(ne.lat - sw.lat, STOP_ONLY_PAD_DEG * 2)
  const lngSpan = Math.max(ne.lng - sw.lng, STOP_ONLY_PAD_DEG * 2)
  let latM = Math.max(latSpan * PAN_LIMIT_MARGIN_RATIO, PAN_LIMIT_MIN_MARGIN_DEG)
  let lngM = Math.max(lngSpan * PAN_LIMIT_MARGIN_RATIO, PAN_LIMIT_MIN_MARGIN_DEG)
  latM = Math.min(latM, PAN_LIMIT_MAX_MARGIN_LAT)
  lngM = Math.min(lngM, PAN_LIMIT_MAX_MARGIN_LNG)
  return L.latLngBounds(
    [sw.lat - latM, sw.lng - lngM],
    [ne.lat + latM, ne.lng + lngM],
  )
}

/** Same visual language as dashboard `busRotatedIcon` — circle + white arrow, rotated by `heading_deg`. */
function kioskBusRotatedIcon(
  color: string,
  headingDeg: number,
  size: number,
  emphasized: boolean,
) {
  const ring = emphasized
    ? "box-shadow:0 0 0 4px rgba(250,204,21,0.95),0 2px 10px rgba(0,0,0,.35)"
    : "box-shadow:0 2px 6px rgba(0,0,0,.25)"
  const borderW = emphasized ? 3 : 2
  const arrowH = Math.max(5, Math.round(size * 0.31))
  const arrowW = Math.max(3, Math.round(size * 0.15))
  const mb = Math.max(1, Math.round(size * 0.08))
  return L.divIcon({
    className: "kiosk-bus-marker-root",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${borderW}px solid #0f172a;display:flex;align-items:center;justify-content:center;transform:rotate(${headingDeg}deg);${ring}"><span style="width:0;height:0;border-left:${arrowW}px solid transparent;border-right:${arrowW}px solid transparent;border-bottom:${arrowH}px solid #fff;margin-bottom:${mb}px"></span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function MapFocusController({
  stopCenter,
  panLimitBounds,
  fitGeneration,
  onReady,
}: {
  stopCenter: [number, number]
  panLimitBounds: L.LatLngBounds
  /** Bump when the map should re-apply the stop-centered view (open, filter change, first route load). */
  fitGeneration: number
  onReady: (api: {
    resetView: () => void
    trackStopAndBus: (busLat: number, busLng: number) => void
  }) => void
}) {
  const map = useMap()

  useEffect(() => {
    map.setMaxBounds(panLimitBounds)
    map.setMinZoom(11)
    map.setMaxZoom(17)
  }, [map, panLimitBounds])

  const applyStopFocusView = useCallback(
    (animate: boolean) => {
      map.invalidateSize()
      map.setView(stopCenter, STOP_RESET_ZOOM, { animate })
    },
    [map, stopCenter],
  )

  useEffect(() => {
    const resetView = () => applyStopFocusView(true)
    const trackStopAndBus = (busLat: number, busLng: number) => {
      map.invalidateSize()
      map.setView([busLat, busLng], STOP_RESET_ZOOM, { animate: true })
    }
    onReady({ resetView, trackStopAndBus })
    return () => onReady({ resetView: () => {}, trackStopAndBus: () => {} })
  }, [map, onReady, applyStopFocusView])

  useEffect(() => {
    const t = window.setTimeout(() => {
      applyStopFocusView(false)
    }, 0)
    return () => clearTimeout(t)
  }, [fitGeneration, applyStopFocusView])

  return null
}

export function KioskExpandedTransitMap({
  open,
  onOpenChange,
  stop,
  stopId,
  relevantRouteNumbers,
  etas,
  currentTime,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stop: BusStop
  stopId: string
  relevantRouteNumbers: string[]
  etas: KioskExpandedEtaRow[]
  currentTime: Date
}) {
  const { t } = useI18n()
  const [transit, setTransit] = useState<TransitContextDTO | null>(null)
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([])
  const [routeFilter, setRouteFilter] = useState<"all" | string>("all")
  const mapApiRef = useRef<{
    resetView: () => void
    trackStopAndBus: (lat: number, lng: number) => void
  } | null>(null)

  const stopCenter = useMemo<[number, number]>(
    () => [stop.latitude, stop.longitude],
    [stop.latitude, stop.longitude],
  )

  useEffect(() => {
    if (!open) return
    setRouteFilter("all")
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/map/transit", { cache: "no-store" })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as TransitContextDTO
        if (!cancelled) setTransit(data)
      } catch {
        if (!cancelled) setTransit(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !stopId) {
      setVehicles([])
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(
          `/api/vehicles?stop_id=${encodeURIComponent(stopId)}&filter=stop`,
          { cache: "no-store" },
        )
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { vehicles: VehicleDTO[] }
        if (!cancelled) setVehicles(data.vehicles ?? [])
      } catch {
        if (!cancelled) setVehicles([])
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 4000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [open, stopId])

  /** Avoid recomputing serving routes on every `etas` reference change (parent re-renders). */
  const etaRouteSignature = useMemo(
    () =>
      [
        ...new Set(
          etas
            .map((e) => e.route?.route_number)
            .filter((x): x is string => !!x),
        ),
      ]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .join("|"),
    [etas],
  )

  const servingRoutes = useMemo(
    () => servingRoutesForStop(transit, stopId, relevantRouteNumbers, etas),
    // etas read here; etaRouteSignature gates recomputation so parent ETA list churn does not refit the map.
    [transit, stopId, relevantRouteNumbers, etaRouteSignature],
  )

  const chipRouteNumbers = useMemo(() => {
    const nums = new Set<string>()
    servingRoutes.forEach((r) => nums.add(r.route_number))
    etas.forEach((e) => {
      if (e.route?.route_number) nums.add(e.route.route_number)
    })
    relevantRouteNumbers.forEach((n) => nums.add(n))
    return Array.from(nums).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )
  }, [servingRoutes, etas, relevantRouteNumbers])

  const visibleRoutes = useMemo(() => {
    if (routeFilter === "all") return servingRoutes
    return servingRoutes.filter((r) => r.route_number === routeFilter)
  }, [servingRoutes, routeFilter])

  const visibleVehicles = useMemo(() => {
    const routeNums = new Set(visibleRoutes.map((r) => r.route_number))
    let list = vehicles.filter((v) => routeNums.has(v.route_number))
    if (routeFilter !== "all") {
      list = list.filter((v) => v.route_number === routeFilter)
    }
    return list
  }, [vehicles, visibleRoutes, routeFilter])

  const [fitKey, setFitKey] = useState(0)
  useEffect(() => {
    if (!open) return
    setFitKey((k) => k + 1)
  }, [open, routeFilter])

  const servingRoutesLenRef = useRef(-1)
  useEffect(() => {
    if (!open) {
      servingRoutesLenRef.current = -1
      return
    }
    const n = servingRoutes.length
    if (servingRoutesLenRef.current === 0 && n > 0) {
      setFitKey((k) => k + 1)
    }
    servingRoutesLenRef.current = n
  }, [open, servingRoutes.length])

  const corridorBounds = useMemo(
    () => computeFocusedLatLngBounds(stopCenter, visibleRoutes, []),
    [stopCenter, visibleRoutes],
  )

  const panLimitBounds = useMemo(
    () => panLimitBoundsFromFocused(corridorBounds),
    [corridorBounds],
  )

  const primaryVehicleId = useMemo(() => {
    let list = etas
    if (routeFilter !== "all") {
      list = list.filter((e) => e.route?.route_number === routeFilter)
    }
    const sorted = [...list].sort(
      (a, b) =>
        new Date(a.predicted_arrival).getTime() -
        new Date(b.predicted_arrival).getTime(),
    )
    return sorted[0]?.bus_id ?? null
  }, [etas, routeFilter])

  const minutesUntil = useCallback(
    (iso: string) => {
      const arrival = new Date(iso)
      const diffMs = arrival.getTime() - currentTime.getTime()
      return Math.max(0, Math.round(diffMs / 60000))
    },
    [currentTime],
  )

  const formatArrival = useCallback(
    (iso: string) => {
      const mins = minutesUntil(iso)
      if (mins === 0) return t("common.now")
      if (mins === 1) return `1 ${t("common.minute")}`
      return `${mins} ${t("common.minutes")}`
    },
    [minutesUntil, t],
  )

  const overlayEtas = useMemo(() => {
    let list = etas
    if (routeFilter !== "all") {
      list = list.filter((e) => e.route?.route_number === routeFilter)
    }
    return list.slice(0, 6)
  }, [etas, routeFilter])

  const registerMapApi = useCallback(
    (api: {
      resetView: () => void
      trackStopAndBus: (lat: number, lng: number) => void
    }) => {
      mapApiRef.current = api
    },
    [],
  )

  const handleTrackNextBus = () => {
    if (!primaryVehicleId) return
    const bus = vehicles.find((v) => v.id === primaryVehicleId)
    if (!bus) return
    mapApiRef.current?.trackStopAndBus(bus.lat, bus.lng)
  }

  const etaForVehicle = useCallback(
    (vehicleId: string) =>
      etas.find((e) => e.bus_id === vehicleId) ?? null,
    [etas],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "!inset-0 !left-0 !top-0 !flex h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 rounded-none border-0 p-0 shadow-none duration-300",
        )}
      >
        <DialogTitle className="sr-only">{t("kiosk.expandMapTitle")}</DialogTitle>

        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {stop.name}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={routeFilter === "all" ? "default" : "outline"}
                className="h-8 min-h-8 rounded-full px-3 text-xs"
                onClick={() => setRouteFilter("all")}
              >
                {t("kiosk.mapAllRoutes")}
              </Button>
              {chipRouteNumbers.map((num) => (
                <Button
                  key={num}
                  type="button"
                  size="sm"
                  variant={routeFilter === num ? "default" : "outline"}
                  className="h-8 min-h-8 rounded-full px-3 text-xs font-bold"
                  onClick={() => setRouteFilter(num)}
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => mapApiRef.current?.resetView()}
            >
              {t("kiosk.mapResetStop")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              disabled={!primaryVehicleId}
              onClick={handleTrackNextBus}
            >
              {t("kiosk.mapTrackNextBus")}
            </Button>
            <DialogClose asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0 rounded-full"
                aria-label={t("kiosk.mapClose")}
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <MapContainer
            key={`${stopId}-${open ? "open" : "closed"}`}
            center={stopCenter}
            zoom={STOP_RESET_ZOOM}
            maxBounds={panLimitBounds}
            maxBoundsViscosity={0.92}
            scrollWheelZoom
            dragging
            touchZoom
            doubleClickZoom
            zoomControl
            className="z-0 h-full min-h-[50vh] w-full [&_.leaflet-control-zoom]:border-slate-200"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapFocusController
              stopCenter={stopCenter}
              panLimitBounds={panLimitBounds}
              fitGeneration={fitKey}
              onReady={registerMapApi}
            />

            {visibleRoutes.map((route) => {
              if (route.coordinates_by_direction) {
                const outbound =
                  route.coordinates_by_direction.outbound ?? route.coordinates
                const inbound =
                  route.coordinates_by_direction.inbound ?? route.coordinates
                return (
                  <Fragment key={`${route.id}:dir`}>
                    <Polyline
                      positions={outbound.map(
                        ([lat, lng]) => [lat, lng] as [number, number],
                      )}
                      pathOptions={{
                        color: route.color,
                        weight: 6,
                        opacity: 0.88,
                      }}
                    />
                    <Polyline
                      positions={inbound.map(
                        ([lat, lng]) => [lat, lng] as [number, number],
                      )}
                      pathOptions={{
                        color: route.color,
                        weight: 5,
                        opacity: 0.45,
                        dashArray: "10 8",
                      }}
                    />
                  </Fragment>
                )
              }
              return (
                <Polyline
                  key={route.id}
                  positions={route.coordinates.map(
                    ([lat, lng]) => [lat, lng] as [number, number],
                  )}
                  pathOptions={{
                    color: route.color,
                    weight: 6,
                    opacity: 0.85,
                  }}
                />
              )
            })}

            <CircleMarker
              center={stopCenter}
              radius={12}
              pathOptions={{
                color: "#0f172a",
                fillColor: "#3b82f6",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Tooltip permanent={false} direction="top">
                {stop.name}
              </Tooltip>
            </CircleMarker>

            {visibleVehicles.map((v) => {
              const emphasized = v.id === primaryVehicleId
              const size = emphasized ? 28 : 22
              const row = etaForVehicle(v.id)
              const etaLabel =
                v.eta_minutes != null
                  ? `~${v.eta_minutes} ${t("common.minutes")}`
                  : row
                    ? formatArrival(row.predicted_arrival)
                    : "—"
              return (
                <Marker
                  key={v.id}
                  position={[v.lat, v.lng]}
                  icon={kioskBusRotatedIcon(
                    v.route_color,
                    v.heading_deg ?? 0,
                    size,
                    emphasized,
                  )}
                >
                  <Popup>
                    <div className="min-w-[140px] space-y-1 text-slate-900">
                      <div className="text-sm font-bold">
                        {t("kiosk.bus")} {v.route_number}
                      </div>
                      <div className="text-xs text-slate-600">
                        {row?.bus?.bus_number
                          ? `${t("kiosk.bus")} ${row.bus.bus_number}`
                          : v.route_name}
                      </div>
                      <div className="text-xs font-medium">
                        {t("kiosk.mapEtaToStop")}: {etaLabel}
                      </div>
                    </div>
                  </Popup>
                  <Tooltip direction="top" offset={[0, -8]}>
                    {v.route_number}
                    {emphasized ? " •" : ""}
                  </Tooltip>
                </Marker>
              )
            })}
          </MapContainer>

          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[1000] flex max-h-[38%] flex-col justify-end sm:left-auto sm:right-3 sm:max-w-sm">
            <div className="pointer-events-auto max-h-full overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("kiosk.mapUpcomingTitle")}
              </div>
              <div className="text-sm font-semibold text-slate-900">{stop.name}</div>
              {overlayEtas.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  {t("kiosk.noUpcomingArrivals")}
                </p>
              ) : (
                <ul className="mt-2 max-h-[28vh] space-y-2 overflow-y-auto pr-1 text-sm">
                  {overlayEtas.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                    >
                      <span
                        className="flex h-7 min-w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                        style={{
                          backgroundColor: e.route?.color || "#3b82f6",
                        }}
                      >
                        {e.route?.route_number ?? "?"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                        {e.bus?.bus_number
                          ? `${t("kiosk.bus")} ${e.bus.bus_number}`
                          : ""}
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">
                        {formatArrival(e.predicted_arrival)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
