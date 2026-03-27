import { createClient } from "@/lib/supabase/server"
import { KioskDisplay } from "@/components/kiosk/kiosk-display"
import { KioskShell } from "@/components/kiosk/kiosk-shell"
import { getServerLocale } from "@/lib/i18n/server"
import { getLocalizedStopName } from "@/lib/i18n/stops"

export default async function KioskPage() {
  const supabase = await createClient()
  const locale = await getServerLocale()

  // A featured stop that should always be available on the kiosk UI.
  // This uses `stop_code` because GTFS import sets it to `stop_id` when `stop_code` is absent.
  const featuredStopCode = "ccd5e97f-c483-4209-96d7-8d64466fdc26"

  // Default to first stop for demo
  const { data: stops } = await supabase
    .from("bus_stops")
    .select("*")
    .eq("is_active", true)
    // Normally we show only stops configured for a physical display.
    // For this specific stop, include it even if `has_display=false`.
    .or(`has_display.eq.true,stop_code.eq.${featuredStopCode}`)
    .order("name")

  const defaultStop = stops?.[0]

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("is_active", true)
    .order("severity", { ascending: false })

  return (
    <KioskShell>
      <KioskDisplay 
        stops={(stops || []).map((s) =>
          s.stop_code === featuredStopCode
            ? { ...s, name: getLocalizedStopName(s.name, s.stop_code, locale, s) }
            : s
        )}
        defaultStopId={defaultStop?.id}
        alerts={alerts || []}
      />
    </KioskShell>
  )
}
