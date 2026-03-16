import { createClient } from "@/lib/supabase/server"
import { KioskDisplay } from "@/components/kiosk/kiosk-display"
import { KioskShell } from "@/components/kiosk/kiosk-shell"

export default async function KioskPage() {
  const supabase = await createClient()

  // Default to first stop for demo
  const { data: stops } = await supabase
    .from("bus_stops")
    .select("*")
    .eq("is_active", true)
    .eq("has_display", true)
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
        stops={stops || []} 
        defaultStopId={defaultStop?.id}
        alerts={alerts || []}
      />
    </KioskShell>
  )
}
