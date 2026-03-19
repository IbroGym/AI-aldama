"use client"

import { useEffect, useMemo, useState } from "react"
import { Cloud, CloudRain, CloudSnow, Sun, Wind } from "lucide-react"

type WeatherStatus = "idle" | "loading" | "ready" | "error"

interface KioskWeatherProps {
  latitude?: number
  longitude?: number
  locationLabel?: string
}

type OpenMeteoCurrent = {
  temperature_2m?: number
  wind_speed_10m?: number
  weather_code?: number
}

type OpenMeteoDaily = {
  temperature_2m_max?: number[]
  temperature_2m_min?: number[]
  precipitation_probability_max?: number[]
}

type OpenMeteoResponse = {
  current?: OpenMeteoCurrent
  daily?: OpenMeteoDaily
}

const ASTANA = { lat: 51.1694, lon: 71.4491, label: "Astana" }

function clampCoord(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function getIcon(code?: number) {
  // Open-Meteo weather codes: https://open-meteo.com/en/docs
  if (code == null) return Cloud
  if (code === 0) return Sun
  if ([1, 2, 3].includes(code)) return Cloud
  if ([45, 48].includes(code)) return Cloud
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow
  return Cloud
}

function formatTemp(v?: number) {
  if (v == null || Number.isNaN(v)) return "—"
  return `${Math.round(v)}°`
}

export function KioskWeather({ latitude, longitude, locationLabel }: KioskWeatherProps) {
  const coords = useMemo(() => {
    if (typeof latitude === "number" && typeof longitude === "number") {
      return {
        lat: clampCoord(latitude, -90, 90),
        lon: clampCoord(longitude, -180, 180),
        label: locationLabel || "This stop",
      }
    }
    return ASTANA
  }, [latitude, longitude, locationLabel])

  const [status, setStatus] = useState<WeatherStatus>("idle")
  const [data, setData] = useState<OpenMeteoResponse | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus("loading")
      try {
        const url = new URL("https://api.open-meteo.com/v1/forecast")
        url.searchParams.set("latitude", String(coords.lat))
        url.searchParams.set("longitude", String(coords.lon))
        url.searchParams.set("current", "temperature_2m,wind_speed_10m,weather_code")
        url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max")
        url.searchParams.set("timezone", "auto")

        const res = await fetch(url.toString(), { cache: "no-store" })
        if (!res.ok) throw new Error(`Weather API error: ${res.status}`)
        const json = (await res.json()) as OpenMeteoResponse
        if (cancelled) return

        setData(json)
        setLastUpdatedAt(Date.now())
        setStatus("ready")
      } catch {
        if (cancelled) return
        setStatus("error")
      }
    }

    load()
    const interval = window.setInterval(load, 10 * 60 * 1000) // every 10 minutes
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [coords.lat, coords.lon])

  const Icon = getIcon(data?.current?.weather_code)
  const max = data?.daily?.temperature_2m_max?.[0]
  const min = data?.daily?.temperature_2m_min?.[0]
  const pop = data?.daily?.precipitation_probability_max?.[0]

  return (
    <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Weather</h3>
        <span className="text-xs text-slate-500">{coords.label}</span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
            <Icon className="h-6 w-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-semibold text-slate-900">
              {status === "ready" ? formatTemp(data?.current?.temperature_2m) : "—"}
            </div>
            <div className="text-xs text-slate-500">
              {status === "loading" ? "Loading…" : status === "error" ? "Unavailable" : "Now"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Max</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatTemp(max)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Min</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatTemp(min)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Rain</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{pop == null ? "—" : `${Math.round(pop)}%`}</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4" />
            <span>
              {status === "ready" && data?.current?.wind_speed_10m != null
                ? `${Math.round(data.current.wind_speed_10m)} m/s`
                : "—"}
            </span>
          </div>
          <span>{lastUpdatedAt ? `Updated ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ""}</span>
        </div>
      </div>
    </div>
  )
}

