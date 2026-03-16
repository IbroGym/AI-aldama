"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { IdleScreen } from "./idle-screen"

interface KioskShellProps {
  children: React.ReactNode
  sleepAfterMs?: number
}

const DEFAULT_SLEEP_AFTER_MS = 60_000

export function KioskShell({ children, sleepAfterMs = DEFAULT_SLEEP_AFTER_MS }: KioskShellProps) {
  const [awake, setAwake] = useState(false)
  const lastActivityAtRef = useRef<number>(Date.now())
  const supabase = useMemo(() => createClient(), [])
  const kioskId = process.env.NEXT_PUBLIC_KIOSK_ID || "demo"

  const wake = useCallback(() => {
    lastActivityAtRef.current = Date.now()
    setAwake(true)
  }, [])

  const markActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now()
  }, [])

  useEffect(() => {
    // Touchscreen + mouse testing
    const onPointer = () => {
      wake()
    }
    const onKeyDown = () => {
      wake()
    }
    const onPointerMove = () => {
      if (awake) markActivity()
    }

    window.addEventListener("pointerdown", onPointer, { passive: true })
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    return () => {
      window.removeEventListener("pointerdown", onPointer)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("pointermove", onPointerMove)
    }
  }, [awake, markActivity, wake])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!awake) return
      const idleForMs = Date.now() - lastActivityAtRef.current
      if (idleForMs >= sleepAfterMs) setAwake(false)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [awake, sleepAfterMs])

  useEffect(() => {
    if (!supabase) return

    // Listen for motion events coming from the hardware.
    // Expected table: public.kiosk_events with kiosk_id + type.
    const channel = supabase
      .channel(`kiosk-wake-${kioskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kiosk_events", filter: `kiosk_id=eq.${kioskId}` },
        (payload) => {
          const type = (payload.new as { type?: string } | null)?.type
          if (!type || type === "motion" || type === "wake") wake()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [kioskId, supabase, wake])

  return (
    <div className="relative min-h-screen">
      {children}
      {!awake ? <IdleScreen onWake={wake} /> : null}
    </div>
  )
}

