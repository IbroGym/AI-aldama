"use client"

import { useI18n } from "@/components/i18n-provider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TransitContextDTO, VehicleDTO } from "@/lib/vehicles/types"
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
  useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

type CapturedPoint = { lat: number; lng: number }

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

function CaptureEvents({
  enabled,
  onCapture,
}: {
  enabled: boolean
  onCapture: (p: CapturedPoint) => void
}) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return
      onCapture({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export function TransitMapView() {
  const { t } = useI18n()
  const isDev = process.env.NODE_ENV === "development"
  const [transit, setTransit] = useState<TransitContextDTO | null>(null)
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([])
  const [highlightedIds, setHighlightedIds] = useState<string[]>([])
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const [onlyMyStop, setOnlyMyStop] = useState(false)
  const [selectedBus, setSelectedBus] = useState<VehicleDTO | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sourceNote, setSourceNote] = useState("")
  const [enabledRouteIds, setEnabledRouteIds] = useState<string[]>([])
  const [focusedRouteId, setFocusedRouteId] = useState<string | null>(null)
  const [focusedDirection, setFocusedDirection] = useState<"outbound" | "inbound">(
    "outbound",
  )
  const [simSpeed, setSimSpeed] = useState<number>(1)
  const pendingSimSpeedRef = useRef<number | null>(null)
  const [updatingSimSpeed, setUpdatingSimSpeed] = useState(false)
  const [simSpeedError, setSimSpeedError] = useState<string | null>(null)
  const [captureMode, setCaptureMode] = useState(false)
  const [capturedPoints, setCapturedPoints] = useState<CapturedPoint[]>([])

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
        simulation_speed_multiplier?: number
      }
      setVehicles(data.vehicles)
      setHighlightedIds(data.highlighted_route_ids ?? [])
      if (typeof data.simulation_speed_multiplier === "number") {
        const pending = pendingSimSpeedRef.current
        if (pending == null || pending === data.simulation_speed_multiplier) {
          pendingSimSpeedRef.current = null
          setSimSpeed(data.simulation_speed_multiplier)
        }
      }
    } catch {
      /* keep last snapshot */
    }
  }, [selectedStopId, onlyMyStop])

  const setSimulationSpeed = useCallback(
    async (nextMultiplier: number) => {
      if (!isDev) return
      setSimSpeedError(null)
      const previous = simSpeed
      pendingSimSpeedRef.current = nextMultiplier
      setSimSpeed(nextMultiplier)
      setUpdatingSimSpeed(true)
      try {
        const res = await fetch("/api/dev/simulation-speed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ multiplier: nextMultiplier }),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `HTTP ${res.status}`)
        }
        const data = (await res.json()) as {
          simulation_speed_multiplier?: number
          error?: string
        }
        if (typeof data.simulation_speed_multiplier === "number") {
          setSimSpeed(data.simulation_speed_multiplier)
          pendingSimSpeedRef.current = null
        } else {
          throw new Error(data.error || "Backend did not return simulation speed")
        }
        void fetchVehicles()
      } catch (error) {
        pendingSimSpeedRef.current = null
        setSimSpeed(previous)
        setSimSpeedError(
          error instanceof Error
            ? `Failed to set simulation speed: ${error.message}`
            : "Failed to set simulation speed",
        )
      } finally {
        setUpdatingSimSpeed(false)
      }
    },
    [fetchVehicles, isDev, simSpeed],
  )

  useEffect(() => {
    void fetchTransit()
  }, [fetchTransit])

  useEffect(() => {
    if (!isDev) return
    const run = async () => {
      try {
        const res = await fetch("/api/dev/simulation-speed")
        if (!res.ok) return
        const data = (await res.json()) as { simulation_speed_multiplier?: number }
        if (typeof data.simulation_speed_multiplier === "number") {
          if (pendingSimSpeedRef.current != null) return
          setSimSpeed(data.simulation_speed_multiplier)
        }
      } catch {
        /* dev control unavailable */
      }
    }
    void run()
  }, [isDev])

  useEffect(() => {
    if (!transit) return
    setEnabledRouteIds((prev) => {
      const all = transit.routes.map((r) => r.id)
      if (prev.length === 0) return all
      const merged = all.filter((id) => prev.includes(id))
      return merged.length ? merged : all
    })
  }, [transit])

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

  const stopById = useMemo(
    () => new Map((transit?.stops ?? []).map((s) => [s.id, s])),
    [transit],
  )
  const route10 = useMemo(
    () => transit?.routes.find((r) => r.route_number === "10") ?? null,
    [transit],
  )
  const visibleRouteIds = useMemo(() => {
    if (!transit) return new Set<string>()
    if (focusedRouteId) return new Set([focusedRouteId])
    return new Set(enabledRouteIds)
  }, [transit, focusedRouteId, enabledRouteIds])
  const visibleRoutes = useMemo(
    () => (transit?.routes ?? []).filter((r) => visibleRouteIds.has(r.id)),
    [transit, visibleRouteIds],
  )
  const visibleVehicles = useMemo(
    () => smoothed.filter((v) => visibleRouteIds.has(v.route_id)),
    [smoothed, visibleRouteIds],
  )
  useEffect(() => {
    if (!selectedBus) return
    if (!visibleRouteIds.has(selectedBus.route_id)) {
      setSelectedBus(null)
    }
  }, [selectedBus, visibleRouteIds])
  const focusedRoute = useMemo(
    () => transit?.routes.find((r) => r.id === focusedRouteId) ?? null,
    [focusedRouteId, transit],
  )
  const focusedDirectionDebug = useMemo(
    () =>
      transit?.route_direction_debug?.find((d) => d.route_id === focusedRouteId) ??
      null,
    [focusedRouteId, transit],
  )
  const focusedOrderDiag = useMemo(
    () =>
      transit?.route_order_diagnostics?.find((d) => d.route_id === focusedRouteId) ??
      null,
    [focusedRouteId, transit],
  )
  const route10Manifest = transit?.route10_debug_override_manifest
  const route10OutboundRows = useMemo(
    () =>
      (route10Manifest?.outbound_entries ?? []).map((e) => ({
        ...e,
        direction: "outbound" as const,
      })),
    [route10Manifest],
  )
  const route10InboundRows = useMemo(
    () =>
      (route10Manifest?.inbound_entries ?? []).map((e) => ({
        ...e,
        direction: "inbound" as const,
      })),
    [route10Manifest],
  )
  const route10OutboundSummary = useMemo(() => {
    const total = route10OutboundRows.length
    const found = route10OutboundRows.filter((r) => r.matched_by_stop_code).length
    return { total, found, missing: total - found }
  }, [route10OutboundRows])
  const route10InboundSummary = useMemo(() => {
    const total = route10InboundRows.length
    const found = route10InboundRows.filter((r) => r.matched_by_stop_code).length
    return { total, found, missing: total - found }
  }, [route10InboundRows])

  const renderedDirectionStopCount = useMemo(() => {
    if (!focusedDirectionDebug) return 0
    return focusedDirection === "outbound"
      ? focusedDirectionDebug.outbound_stop_ids.length
      : focusedDirectionDebug.inbound_stop_ids.length
  }, [focusedDirection, focusedDirectionDebug])

  const toggleRoute = (routeId: string, on: boolean) => {
    setEnabledRouteIds((prev) =>
      on ? Array.from(new Set([...prev, routeId])) : prev.filter((id) => id !== routeId),
    )
  }

  const fmt = (n: number) => n.toFixed(6)
  const asArrayString = useMemo(() => {
    const lines = capturedPoints.map((p) => `  [${fmt(p.lat)}, ${fmt(p.lng)}],`)
    if (!lines.length) return "[]"
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "")
    return `[\n${lines.join("\n")}\n]`
  }, [capturedPoints])

  const copyCaptured = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(asArrayString)
    } catch {
      // Minimal fallback for environments where clipboard is blocked.
      const ta = document.createElement("textarea")
      ta.value = asArrayString
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
    }
  }, [asArrayString])

  const capturePointIcon = useCallback((index0: number) => {
    const n = index0 + 1
    return L.divIcon({
      className: "capture-point-icon",
      html: `<div style="width:22px;height:22px;border-radius:50%;background:#f97316;border:2px solid #0f172a;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0f172a;box-shadow:0 2px 6px rgba(0,0,0,.25)">${n}</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    })
  }, [])

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
                {isDev ? ` · sim speed ${simSpeed}x` : ""}
                {isDev && simSpeedError ? ` · ${simSpeedError}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {isDev && (
                <div className="flex items-center gap-2 rounded border px-2 py-1">
                  <Label htmlFor="sim-speed" className="text-xs font-normal">
                    Sim speed
                  </Label>
                  <select
                    id="sim-speed"
                    className="rounded border bg-background px-2 py-1 text-xs"
                    value={String(simSpeed)}
                    disabled={updatingSimSpeed}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      if (!Number.isFinite(next)) return
                      void setSimulationSpeed(next)
                    }}
                  >
                    {[1, 5, 10, 20].map((m) => (
                      <option key={`sim-${m}`} value={String(m)}>
                        {m}x
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2 rounded border px-2 py-1">
                <Label className="text-xs font-normal">Focus route 10</Label>
                <Switch
                  checked={focusedRouteId === route10?.id}
                  disabled={!route10}
                  onCheckedChange={(on) => {
                    setFocusedRouteId(on ? route10?.id ?? null : null)
                    if (on && route10) {
                      setEnabledRouteIds([route10.id])
                    }
                  }}
                />
              </div>
                <div className="flex items-center gap-2 rounded border px-2 py-1">
                  <Label htmlFor="capture-coordinates" className="text-xs font-normal">
                    Capture coordinates
                  </Label>
                  <Switch
                    id="capture-coordinates"
                    checked={captureMode}
                    onCheckedChange={setCaptureMode}
                  />
                </div>
              {focusedRouteId === route10?.id && (
                <div className="flex items-center gap-1 rounded border px-2 py-1">
                  <Label className="text-xs font-normal">Direction</Label>
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-xs ${focusedDirection === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => setFocusedDirection("outbound")}
                  >
                    Outbound
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-xs ${focusedDirection === "inbound" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => setFocusedDirection("inbound")}
                  >
                    Inbound
                  </button>
                </div>
              )}
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
              <CaptureEvents
                enabled={captureMode}
                onCapture={(p) =>
                  setCapturedPoints((prev) => [...prev, p])
                }
              />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {visibleRoutes.map((route) => {
                if (
                  route.route_number === "10" &&
                  route.coordinates_by_direction
                ) {
                  const outbound = route.coordinates_by_direction.outbound ?? route.coordinates
                  const inbound = route.coordinates_by_direction.inbound ?? route.coordinates

                  if (focusedRouteId === route.id) {
                    const active =
                      focusedDirection === "outbound" ? outbound : inbound
                    return (
                      <Polyline
                        key={`${route.id}:${focusedDirection}`}
                        positions={active.map(
                          ([lat, lng]) => [lat, lng] as [number, number],
                        )}
                        pathOptions={{
                          color: route.color,
                          ...routeStyle(route.id),
                          dashArray:
                            focusedDirection === "inbound" ? "7 6" : undefined,
                        }}
                      />
                    )
                  }

                  return (
                    <Fragment key={`${route.id}:outbound+inbound`}>
                      <Polyline
                        key={`${route.id}:outbound`}
                        positions={outbound.map(
                          ([lat, lng]) => [lat, lng] as [number, number],
                        )}
                        pathOptions={{
                          color: route.color,
                          ...routeStyle(route.id),
                        }}
                      />
                      <Polyline
                        key={`${route.id}:inbound`}
                        positions={inbound.map(
                          ([lat, lng]) => [lat, lng] as [number, number],
                        )}
                        pathOptions={{
                          color: route.color,
                          ...routeStyle(route.id),
                          dashArray: "7 6",
                          opacity: 0.35,
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
                      ...routeStyle(route.id),
                    }}
                  />
                )
              })}
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
                        if (captureMode) return
                        setSelectedStopId(stop.id)
                        setSelectedBus(null)
                      },
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                      {stop.name}
                    </Tooltip>
                    {!captureMode && (
                      <Popup>
                        <div className="text-sm font-medium">{stop.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {stop.stop_code}
                        </div>
                      </Popup>
                    )}
                  </CircleMarker>
                )
              })}
              {visibleVehicles.map((v) => (
                <Marker
                  key={v.id}
                  position={[v.lat, v.lng]}
                  icon={busRotatedIcon(v.route_color, v.heading_deg)}
                  eventHandlers={{
                    click: () => {
                      if (captureMode) return
                      setSelectedBus(v)
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]}>
                    {v.route_number}
                    {focusedRoute?.route_number === "10" &&
                      v.route_number === "10" && (
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          • {v.direction ?? focusedDirection}
                          {v.distance_along_m != null
                            ? ` • ${Math.round(v.distance_along_m)}m`
                            : ""}
                          {v.terminal_pause_active ? " (pause)" : ""}
                        </span>
                      )}
                  </Tooltip>
                </Marker>
              ))}

              {capturedPoints.length > 0 && (
                <>
                  <Polyline
                    positions={capturedPoints.map(
                      (p) => [p.lat, p.lng] as [number, number],
                    )}
                    pathOptions={{
                      color: "#f97316",
                      weight: 3,
                      opacity: 0.85,
                      dashArray: "6 5",
                    }}
                  />
                  {capturedPoints.map((p, i) => (
                    <Marker
                      key={`${i}-${p.lat}-${p.lng}`}
                      position={[p.lat, p.lng]}
                      icon={capturePointIcon(i)}
                    />
                  ))}
                </>
              )}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full shrink-0 lg:w-80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Route debug controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">Coordinate capture</div>
              <div className="text-xs text-muted-foreground">points: {capturedPoints.length}</div>
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  disabled={capturedPoints.length === 0}
                  onClick={() =>
                    setCapturedPoints((prev) =>
                      prev.slice(0, Math.max(0, prev.length - 1)),
                    )
                  }
                >
                  Undo last point
                </button>
                <button
                  type="button"
                  className="rounded border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  disabled={capturedPoints.length === 0}
                  onClick={() => setCapturedPoints([])}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  className="rounded border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  disabled={capturedPoints.length === 0}
                  onClick={() => void copyCaptured()}
                  title="Copies as JavaScript array of [lat, lng] tuples"
                >
                  Copy as array
                </button>
              </div>

              <div className="max-h-52 overflow-auto rounded border">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">[lat, lng]</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capturedPoints.map((p, i) => (
                      <tr key={`${i}-${p.lat}-${p.lng}`} className="border-t">
                        <td className="px-2 py-1 font-mono">{i + 1}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground">
                          [{fmt(p.lat)}, {fmt(p.lng)}]
                        </td>
                      </tr>
                    ))}
                    {capturedPoints.length === 0 && (
                      <tr>
                        <td className="px-2 py-2 text-muted-foreground" colSpan={2}>
                          Enable “Capture coordinates”, then click on the map.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {capturedPoints.length > 0 && (
                <div className="text-[11px] text-muted-foreground">{asArrayString}</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {(transit?.routes ?? []).map((route) => {
              const enabled = enabledRouteIds.includes(route.id)
              return (
                <div key={route.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="truncate text-left text-xs hover:underline"
                    onClick={() => setFocusedRouteId(route.id)}
                    title={`${route.route_number} • ${route.id}`}
                  >
                    {route.route_number} • {route.id.slice(0, 8)} • {route.route_name}
                  </button>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(on) => toggleRoute(route.id, on)}
                  />
                </div>
              )
            })}
          </div>
          {focusedRoute?.route_number === "10" && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <div className="font-medium">Route 10 diagnostics</div>
              <div className="mt-1">
                order source: {focusedOrderDiag?.order_source ?? focusedRoute.order_source ?? "db"}
              </div>
              <div>
                geometry source:{" "}
                {(
                  focusedDirection === "outbound"
                    ? focusedRoute.geometry_source_by_direction?.outbound
                    : focusedRoute.geometry_source_by_direction?.inbound
                ) ??
                  focusedRoute.geometry_source ??
                  "stop_polyline"}
              </div>
              <div>
                geometry points:{" "}
                {(
                  focusedDirection === "outbound"
                    ? focusedRoute.geometry_point_count_by_direction?.outbound
                    : focusedRoute.geometry_point_count_by_direction?.inbound
                ) ??
                  focusedRoute.geometry_point_count ??
                  focusedRoute.coordinates.length}
              </div>
              <div>rendered direction: {focusedDirection}</div>
              <div>rendered stop count: {renderedDirectionStopCount}</div>
              <div>
                outbound stops: {focusedDirectionDebug?.outbound_stop_ids.length ?? 0}
              </div>
              <div>
                inbound stops: {focusedDirectionDebug?.inbound_stop_ids.length ?? 0}
              </div>
              <div className="mt-2 border-t pt-2">
                <div>bus_stops loaded in transit context: {transit?.bus_stops_loaded_count ?? 0}</div>
                <div>active-query count: {transit?.bus_stops_active_query_count ?? 0}</div>
                <div>
                  debug stop_code supplement count:{" "}
                  {transit?.bus_stops_debug_code_supplement_count ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  load scope: {transit?.bus_stops_load_scope ?? "unknown"}
                </div>
              </div>
            </div>
          )}
          {focusedRoute?.route_number === "10" && (
            <div className="space-y-3 rounded-md border p-2">
              <div className="text-xs font-medium">Route 10 outbound stop_code diagnostics</div>
              <div className="text-[11px] text-muted-foreground">
                total: {route10OutboundSummary.total} · matched by stop_code:{" "}
                {route10OutboundSummary.found} · missing: {route10OutboundSummary.missing}
              </div>
              <div className="max-h-40 overflow-auto rounded border">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">override stop_code</th>
                      <th className="px-2 py-1 text-left">matched</th>
                      <th className="px-2 py-1 text-left">id</th>
                      <th className="px-2 py-1 text-left">stop_code</th>
                      <th className="px-2 py-1 text-left">name</th>
                      <th className="px-2 py-1 text-left">dir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {route10OutboundRows.map((row, i) => (
                      <tr key={`out-${row.override_stop_code}-${i}`} className="border-t">
                        <td className="px-2 py-1 font-mono">{row.override_stop_code}</td>
                        <td className="px-2 py-1">
                          {row.matched_by_stop_code ? "yes (stop_code)" : "no"}
                        </td>
                        <td className="px-2 py-1 font-mono">
                          {row.resolved_id ?? "—"}
                        </td>
                        <td className="px-2 py-1 font-mono">
                          {row.resolved_stop_code ?? "—"}
                        </td>
                        <td className="px-2 py-1">{row.resolved_name ?? "—"}</td>
                        <td className="px-2 py-1">{row.direction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs font-medium">
                Route 10 inbound stop_code diagnostics (temporary reverse)
              </div>
              <div className="text-[11px] text-muted-foreground">
                total: {route10InboundSummary.total} · matched by stop_code:{" "}
                {route10InboundSummary.found} · missing: {route10InboundSummary.missing}
              </div>
              <div className="max-h-40 overflow-auto rounded border">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">override stop_code</th>
                      <th className="px-2 py-1 text-left">matched</th>
                      <th className="px-2 py-1 text-left">id</th>
                      <th className="px-2 py-1 text-left">stop_code</th>
                      <th className="px-2 py-1 text-left">name</th>
                      <th className="px-2 py-1 text-left">dir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {route10InboundRows.map((row, i) => (
                      <tr key={`in-${row.override_stop_code}-${i}`} className="border-t">
                        <td className="px-2 py-1 font-mono">{row.override_stop_code}</td>
                        <td className="px-2 py-1">
                          {row.matched_by_stop_code ? "yes (stop_code)" : "no"}
                        </td>
                        <td className="px-2 py-1 font-mono">
                          {row.resolved_id ?? "—"}
                        </td>
                        <td className="px-2 py-1 font-mono">
                          {row.resolved_stop_code ?? "—"}
                        </td>
                        <td className="px-2 py-1">{row.resolved_name ?? "—"}</td>
                        <td className="px-2 py-1">{row.direction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="border-t pt-2" />
          <div className="text-sm font-medium">{t("dashboard.map.busDetails")}</div>
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
