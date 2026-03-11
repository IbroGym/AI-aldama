import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Alert } from "@/lib/types/database"
import { Bell, AlertTriangle, Info, Wrench, Clock } from "lucide-react"

interface ActiveAlertsProps {
  alerts: Alert[]
}

export function ActiveAlerts({ alerts }: ActiveAlertsProps) {
  const getAlertIcon = (type: Alert["alert_type"]) => {
    switch (type) {
      case "delay": return <Clock className="h-4 w-4" />
      case "cancellation": return <AlertTriangle className="h-4 w-4" />
      case "reroute": return <AlertTriangle className="h-4 w-4" />
      case "maintenance": return <Wrench className="h-4 w-4" />
      case "info": return <Info className="h-4 w-4" />
      default: return <Bell className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: Alert["severity"]) => {
    switch (severity) {
      case "critical": return "bg-destructive text-destructive-foreground"
      case "high": return "bg-destructive/80 text-destructive-foreground"
      case "medium": return "bg-warning text-warning-foreground"
      case "low": return "bg-muted text-muted-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-4 w-4" />
          Active Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              No active alerts - All services running normally
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`rounded p-1 ${getSeverityColor(alert.severity)}`}>
                      {getAlertIcon(alert.alert_type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">{alert.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {alert.severity}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Started: {formatDate(alert.starts_at)}</span>
                  {alert.ends_at && (
                    <>
                      <span>•</span>
                      <span>Ends: {formatDate(alert.ends_at)}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
