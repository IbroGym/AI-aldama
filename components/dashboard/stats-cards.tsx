"use client"

import { Bus, MapPin, Bell, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/i18n-provider"

interface StatsCardsProps {
  stats: {
    totalBuses: number
    activeBuses: number
    totalStops: number
    activeAlerts: number
    todayQueries: number
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { t } = useI18n()

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.activeBuses")}</CardTitle>
          <Bus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{stats.activeBuses}</div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.ofTotalBuses")} {stats.totalBuses} {t("dashboard.buses").toLowerCase()}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.busStops")}</CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{stats.totalStops}</div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.activeStopsInNetwork")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.activeAlerts")}</CardTitle>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{stats.activeAlerts}</div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.serviceNotifications")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.aiQueries")}</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{stats.todayQueries}</div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.recentQueries")}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
