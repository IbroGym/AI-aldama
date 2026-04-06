import { createClient } from "@/lib/supabase/server"
import { KioskDisplay } from "@/components/kiosk/kiosk-display"
import { KioskShell } from "@/components/kiosk/kiosk-shell"
import { getServerLocale } from "@/lib/i18n/server"
import { getLocalizedStopName } from "@/lib/i18n/stops"
import {
  KIOSK_SELECTOR_EXTRA_STOP_IDS,
  KIOSK_TEATR_ASTANA_OPERA_STOP_ID,
} from "@/lib/kiosk/kiosk-selector-extra-stop-ids"
import { ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID } from "@/lib/vehicles/route10-nu-demo-stops"
import { getEtaPayload } from "@/lib/vehicles/vehicle-service"

export default async function KioskPage() {
  const supabase = await createClient()
  const locale = await getServerLocale()

  /** Demo kiosk: outbound-side Route 10 Nazarbayev University platform. */
  const featuredOutboundNuStopCode = ROUTE_10_NU_OUTBOUND_SIDE_STOP_ID

  if (process.env.NODE_ENV === "development") {
    console.info(
      "[kiosk] featured outbound NU bound to public.bus_stops.id",
      featuredOutboundNuStopCode,
    )
  }

  const kioskStopOrFilter = [
    "has_display.eq.true",
    `stop_code.eq.${featuredOutboundNuStopCode}`,
    ...KIOSK_SELECTOR_EXTRA_STOP_IDS.map((id) => `id.eq.${id}`),
  ].join(",")

  const { data: stops } = await supabase
    .from("bus_stops")
    .select("*")
    .eq("is_active", true)
    // Stops with a physical display, featured NU row, plus curated kiosk-only ids.
    .or(kioskStopOrFilter)
    .order("name")

  const defaultStop =
    stops?.find((s) => s.stop_code === featuredOutboundNuStopCode) ?? stops?.[0]

  if (process.env.NODE_ENV === "development") {
    console.info("[kiosk] featured stop row from DB", {
      found: !!defaultStop && defaultStop.stop_code === featuredOutboundNuStopCode,
      id: defaultStop?.id,
      stop_code: defaultStop?.stop_code,
      name: defaultStop?.name,
    })
    console.info("[kiosk] Teatr Astana Opera stop in picker", {
      stop_id: KIOSK_TEATR_ASTANA_OPERA_STOP_ID,
      in_list: (stops ?? []).some((s) => s.id === KIOSK_TEATR_ASTANA_OPERA_STOP_ID),
    })
  }

  if (process.env.NODE_ENV === "development" && defaultStop?.id) {
    const etaDebug = await getEtaPayload(supabase, defaultStop.id, true)
    console.info("[kiosk demo] outbound eta debug", {
      stop_id: defaultStop.id,
      stop_code: defaultStop.stop_code,
      arrivals_count: etaDebug.arrivals.length,
      sample: etaDebug.arrivals.slice(0, 5).map((a) => ({
        vehicle_id: a.vehicle_id,
        route_number: a.route_number,
        eta_minutes: a.eta_minutes,
      })),
    })
  }

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("is_active", true)
    .order("severity", { ascending: false })

  return (
    <KioskShell>
      <KioskDisplay 
        stops={(stops || []).map((s) => ({
          ...s,
          name: getLocalizedStopName(s.name, s.stop_code, locale, s, s.id),
        }))}
        defaultStopId={defaultStop?.id}
        alerts={alerts || []}
      />
    </KioskShell>
  )
}
