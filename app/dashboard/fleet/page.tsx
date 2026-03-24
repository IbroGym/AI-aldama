import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bus, MapPin, Gauge } from "lucide-react"
import { getServerI18n } from "@/lib/i18n/server"

export default async function FleetPage() {
  const { t } = await getServerI18n()
  const supabase = await createClient()

  const { data: buses } = await supabase
    .from("buses")
    .select("*, current_route:bus_routes(*)")
    .order("bus_number")

  const { data: positions } = await supabase
    .from("bus_positions")
    .select("*")
    .order("recorded_at", { ascending: false })

  // Get latest position for each bus
  const latestPositions = positions?.reduce((acc, pos) => {
    if (!acc[pos.bus_id]) {
      acc[pos.bus_id] = pos
    }
    return acc
  }, {} as Record<string, typeof positions[0]>)

  return (
    <div className="flex flex-col">
      <DashboardHeader title={t("dashboard.fleetTitle")} description={t("dashboard.fleetDescription")} />

      <main className="flex-1 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buses?.map((bus) => {
            const position = latestPositions?.[bus.id]
            const isActive = bus.is_active && position
            const timeSinceUpdate = position
              ? Math.round((Date.now() - new Date(position.recorded_at).getTime()) / 60000)
              : null

            return (
              <Card key={bus.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bus className="h-4 w-4" />
                      {bus.bus_number}
                    </CardTitle>
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? t("dashboard.active") : t("dashboard.inactive")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("dashboard.license")}</span>
                    <span className="font-medium text-foreground">{bus.license_plate}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("dashboard.capacity")}</span>
                    <span className="font-medium text-foreground">{bus.capacity} {t("dashboard.seats")}</span>
                  </div>
                  {bus.current_route && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("dashboard.route")}</span>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: bus.current_route.color,
                          color: bus.current_route.color,
                        }}
                      >
                        {bus.current_route.route_number}
                      </Badge>
                    </div>
                  )}
                  {position && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Gauge className="h-3 w-3" />
                          {t("dashboard.speed")}
                        </span>
                        <span className="font-medium text-foreground">
                          {position.speed ? `${Math.round(position.speed)} km/h` : t("dashboard.stationary")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {t("dashboard.location")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.lastUpdate")}: {timeSinceUpdate === 0 ? t("dashboard.justNow") : `${timeSinceUpdate} ${t("dashboard.minAgo")}`}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
