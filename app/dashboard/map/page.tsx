import { DashboardHeader } from "@/components/dashboard/header"
import { TransitMap } from "@/components/dashboard/transit-map"
import { getServerI18n } from "@/lib/i18n/server"

export default async function MapPage() {
  const { t } = await getServerI18n()

  return (
    <div className="flex flex-col">
      <DashboardHeader
        title={t("dashboard.map.pageTitle")}
        description={t("dashboard.map.pageDescription")}
      />
      <main className="flex-1 p-6">
        <TransitMap />
      </main>
    </div>
  )
}
