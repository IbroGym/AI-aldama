"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { EtaArrivalDTO } from "@/lib/vehicles/types"

export type SmoothedEtaArrival = EtaArrivalDTO & {
  /** ISO time derived from smoothed minutes (for kiosk list) */
  predicted_arrival: string
}

function pruneMapsToRawVehicleIds(
  rawIds: Set<string>,
  targets: Map<string, number>,
  smoothed: Map<string, number>,
  holdUntilMs: Map<string, number>,
  prevRawEta: Map<string, number>,
): string[] {
  const removed: string[] = []
  const allKeys = new Set<string>([
    ...targets.keys(),
    ...smoothed.keys(),
    ...holdUntilMs.keys(),
    ...prevRawEta.keys(),
  ])
  for (const id of allKeys) {
    if (!rawIds.has(id)) {
      removed.push(id)
      targets.delete(id)
      smoothed.delete(id)
      holdUntilMs.delete(id)
      prevRawEta.delete(id)
    }
  }
  return removed
}

/**
 * Lerps displayed ETA minutes toward server targets between polls (no jumps).
 * Smoothed state is keyed only by vehicle_id and is pruned whenever raw does not contain that id.
 */
export function useSmoothedSimulationArrivals(
  raw: EtaArrivalDTO[] | null,
  enabled: boolean
): SmoothedEtaArrival[] {
  const targets = useRef(new Map<string, number>())
  const smoothed = useRef(new Map<string, number>())
  const holdUntilMs = useRef(new Map<string, number>())
  const prevRawEta = useRef(new Map<string, number>())
  const lastDevLogRawSig = useRef<string>("")
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!enabled) return

    if (!raw?.length) {
      targets.current.clear()
      smoothed.current.clear()
      holdUntilMs.current.clear()
      prevRawEta.current.clear()
      setVersion((v) => v + 1)
      return
    }

    const rawIds = new Set(raw.map((a) => a.vehicle_id))
    pruneMapsToRawVehicleIds(
      rawIds,
      targets.current,
      smoothed.current,
      holdUntilMs.current,
      prevRawEta.current,
    )

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

    const rawIds = new Set(raw.map((a) => a.vehicle_id))
    const removed = pruneMapsToRawVehicleIds(
      rawIds,
      targets.current,
      smoothed.current,
      holdUntilMs.current,
      prevRawEta.current,
    )

    const seen = new Set<string>()
    const dedupedRaw = raw.filter((a) => {
      if (seen.has(a.vehicle_id)) return false
      seen.add(a.vehicle_id)
      return true
    })

    if (process.env.NODE_ENV === "development") {
      const sig = dedupedRaw.map((a) => a.vehicle_id).join("|")
      if (removed.length > 0 || sig !== lastDevLogRawSig.current) {
        lastDevLogRawSig.current = sig
        console.info("[smoothed-eta]", {
          raw_vehicle_ids: dedupedRaw.map((a) => a.vehicle_id),
          smoothed_vehicle_ids: [...smoothed.current.keys()],
          removed_vehicle_ids: removed,
        })
      }
    }

    const now = Date.now()
    return dedupedRaw
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
