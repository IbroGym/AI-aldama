import type { SupabaseClient } from "@supabase/supabase-js"
import type { Alert } from "@/lib/types/database"

/** Alerts currently shown on kiosk: active flag + within start/end window. */
export async function fetchKioskActiveAlerts(
  supabase: SupabaseClient
): Promise<Alert[]> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("is_active", true)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })

  return (data ?? []) as Alert[]
}
