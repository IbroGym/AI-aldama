"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { EtaArrivalDTO } from "@/lib/vehicles/types"

export type SmoothedEtaArrival = EtaArrivalDTO & {
  /** ISO time derived from smoothed minutes (for kiosk list) */
  predicted_arrival: string
}

/**
 * Lerps displayed ETA minutes toward server targets between polls (no jumps).
 */
export function useSmoothedSimulationArrivals(
  raw: EtaArrivalDTO[] | null,
  enabled: boolean
): SmoothedEtaArrival[] {
  const targets = useRef(new Map<string, number>())
  const smoothed = useRef(new Map<string, number>())
  const holdUntilMs = useRef(new Map<string, number>())
  const prevRawEta = useRef(new Map<string, number>())
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!enabled || !raw?.length) {
      if (!raw?.length) {
        targets.current.clear()
        smoothed.current.clear()
        holdUntilMs.current.clear()
        prevRawEta.current.clear()
      }
      return
    }
    const now = Date.now()
    for (const a of raw) {
      const prev = prevRawEta.current.get(a.vehicle_id)
      const jumpUp = prev != null && a.eta_minutes - prev >= 6
      const wasImminent = prev != null && prev <= 3
      if (jumpUp && wasImminent) {
        holdUntilMs.current.set(a.vehicle_id, now + 40_000)
      }
      prevRawEta.current.set(a.vehicle_id, a.eta_minutes)
      targets.current.set(a.vehicle_id, a.eta_minutes)
      if (!smoothed.current.has(a.vehicle_id)) {
        smoothed.current.set(a.vehicle_id, a.eta_minutes)
      }
    }
    for (const id of [...smoothed.current.keys()]) {
      if (!raw.find((x) => x.vehicle_id === id)) {
        smoothed.current.delete(id)
        targets.current.delete(id)
        prevRawEta.current.delete(id)
        holdUntilMs.current.delete(id)
      }
    }
  }, [raw, enabled])

  useEffect(() => {
    if (!enabled) return
    let frame: number
    const loop = () => {
      let moved = false
      for (const [vid, target] of targets.current) {
        const cur = smoothed.current.get(vid) ?? target
        const next = cur + (target - cur) * 0.14
        if (Math.abs(next - cur) > 0.015) {
          smoothed.current.set(vid, next)
          moved = true
        } else if (Math.abs(target - cur) > 0.01) {
          smoothed.current.set(vid, target)
          moved = true
        }
      }
      if (moved) setVersion((v) => v + 1)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [enabled])

  return useMemo(() => {
    if (!raw || !enabled) return []
    const now = Date.now()
    return raw
      .filter((a) => {
        const hold = holdUntilMs.current.get(a.vehicle_id) ?? 0
        return hold <= now
      })
      .map((a) => {
      const mins = smoothed.current.get(a.vehicle_id) ?? a.eta_minutes
      const predicted_arrival = new Date(
        Date.now() + mins * 60_000
      ).toISOString()
      return {
        ...a,
        predicted_arrival,
      }
    })
  }, [raw, enabled, version])
}
