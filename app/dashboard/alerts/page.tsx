import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell, AlertTriangle, Info, Clock, Wrench, CheckCircle } from "lucide-react"

export default async function AlertsPage() {
  const supabase = await createClient()

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .order("is_active", { ascending: false })
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })

  const activeAlerts = alerts?.filter((a) => a.is_active) || []
  const inactiveAlerts = alerts?.filter((a) => !a.is_active) || []

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "delay": return <Clock className="h-5 w-5" />
      case "cancellation": return <AlertTriangle className="h-5 w-5" />
      case "reroute": return <AlertTriangle className="h-5 w-5" />
      case "maintenance": return <Wrench className="h-5 w-5" />
      case "info": return <Info className="h-5 w-5" />
      default: return <Bell className="h-5 w-5" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-destructive text-destructive-foreground"
      case "high": return "bg-destructive/80 text-destructive-foreground"
      case "medium": return "bg-warning text-warning-foreground"
      case "low": return "bg-muted text-muted-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="flex flex-col">
      <DashboardHeader title="Service Alerts" description="Manage service notifications and alerts" />

      <main className="flex-1 space-y-6 p-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{activeAlerts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {activeAlerts.filter((a) => a.severity === "critical").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delays</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {activeAlerts.filter((a) => a.alert_type === "delay").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {activeAlerts.filter((a) => a.alert_type === "maintenance").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAlerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                No active alerts - All services running normally
              </div>
            ) : (
              <div className="space-y-4">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`rounded-lg p-2 ${getSeverityColor(alert.severity)}`}>
                          {getAlertIcon(alert.alert_type)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{alert.title}</h4>
                          <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Started: {formatDate(alert.starts_at)}</span>
                            {alert.ends_at && (
                              <>
                                <span>•</span>
                                <span>Ends: {formatDate(alert.ends_at)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className="capitalize">
                          {alert.alert_type}
                        </Badge>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Alerts */}
        {inactiveAlerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                Past Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inactiveAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground">
                        {getAlertIcon(alert.alert_type)}
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">{alert.title}</span>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(alert.starts_at)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">Resolved</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
