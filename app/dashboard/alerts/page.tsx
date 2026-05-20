import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/header"
import { AlertsManager } from "@/components/dashboard/alerts-manager"
import { getServerI18n } from "@/lib/i18n/server"
import {
  canDeleteAlerts,
  canManageAlerts,
  getDashboardSession,
} from "@/lib/auth/dashboard-role"
import type { Alert } from "@/lib/types/database"

export default async function AlertsPage() {
  const { t } = await getServerI18n()
  const supabase = await createClient()
  const { role } = await getDashboardSession(supabase)

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .order("is_active", { ascending: false })
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title={t("dashboard.alertsTitle")}
        description={t("dashboard.alertsDescription")}
      />
      <AlertsManager
        initialAlerts={(alerts ?? []) as Alert[]}
        canManage={canManageAlerts(role)}
        canDelete={canDeleteAlerts(role)}
      />
    </div>
  )
}
