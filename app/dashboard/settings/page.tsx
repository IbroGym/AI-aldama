import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Settings, Database, Cpu, Wifi, Shield } from "lucide-react"
import { getServerI18n } from "@/lib/i18n/server"

export default async function SettingsPage() {
  const { t } = await getServerI18n()

  return (
    <div className="flex flex-col">
      <DashboardHeader title={t("dashboard.settingsTitle")} description={t("dashboard.settingsDescription")} />

      <main className="flex-1 space-y-6 p-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4" />
                {t("dashboard.settings.systemStatus")}
              </CardTitle>
              <CardDescription>{t("dashboard.settings.systemStatusDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.apiService")}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <Badge variant="outline" className="text-green-600">{t("dashboard.settings.online")}</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.aiHandler")}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <Badge variant="outline" className="text-green-600">{t("dashboard.active")}</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.realtimeUpdates")}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <Badge variant="outline" className="text-green-600">{t("dashboard.settings.connected")}</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.etaEngine")}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <Badge variant="outline" className="text-green-600">{t("dashboard.settings.running")}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                {t("dashboard.settings.database")}
              </CardTitle>
              <CardDescription>{t("dashboard.settings.databaseDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.connection")}</span>
                <Badge variant="outline" className="text-green-600">{t("dashboard.settings.connected")}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.tables")}</span>
                <span className="text-sm font-medium text-foreground">11</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.rlsEnabled")}</span>
                <Badge variant="outline" className="text-green-600">{t("dashboard.settings.yes")}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.realtime")}</span>
                <Badge variant="outline" className="text-green-600">{t("dashboard.settings.enabled")}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Network */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="h-4 w-4" />
                {t("dashboard.settings.network")}
              </CardTitle>
              <CardDescription>{t("dashboard.settings.networkDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.apiGateway")}</span>
                <Badge variant="outline" className="text-green-600">HTTPS</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.rateLimiting")}</span>
                <span className="text-sm font-medium text-foreground">100 req/min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.aiProvider")}</span>
                <span className="text-sm font-medium text-foreground">OpenAI</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.speechApi")}</span>
                <span className="text-sm font-medium text-foreground">Web Speech</span>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                {t("dashboard.settings.security")}
              </CardTitle>
              <CardDescription>{t("dashboard.settings.securityDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.authentication")}</span>
                <Badge variant="outline" className="text-green-600">Supabase Auth</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.rlsEnabled")}</span>
                <Badge variant="outline" className="text-green-600">{t("dashboard.settings.enabled")}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.apiAuth")}</span>
                <span className="text-sm font-medium text-foreground">JWT Tokens</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("dashboard.settings.publicAccess")}</span>
                <span className="text-sm font-medium text-foreground">{t("dashboard.settings.kioskOnly")}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Architecture Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              {t("dashboard.settings.architecture")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-secondary p-4">
                <div className="font-semibold text-foreground">{t("dashboard.settings.layerPhysical")}</div>
                <p className="mt-1 text-muted-foreground">
                  {t("dashboard.settings.layerPhysicalDesc")}
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <div className="font-semibold text-foreground">{t("dashboard.settings.layerNetwork")}</div>
                <p className="mt-1 text-muted-foreground">
                  {t("dashboard.settings.layerNetworkDesc")}
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <div className="font-semibold text-foreground">{t("dashboard.settings.layerBackendAi")}</div>
                <p className="mt-1 text-muted-foreground">
                  {t("dashboard.settings.layerBackendAiDesc")}
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <div className="font-semibold text-foreground">{t("dashboard.settings.layerData")}</div>
                <p className="mt-1 text-muted-foreground">
                  {t("dashboard.settings.layerDataDesc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
