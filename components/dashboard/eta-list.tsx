import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { EtaPrediction } from "@/lib/types/database"
import { Clock } from "lucide-react"

interface EtaListProps {
  etas: EtaPrediction[]
}

export function EtaList({ etas }: EtaListProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffMins = Math.round(diffMs / 60000)
    
    if (diffMins < 1) return "Now"
    if (diffMins === 1) return "1 min"
    if (diffMins < 60) return `${diffMins} mins`
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "bg-green-500"
    if (confidence >= 0.75) return "bg-yellow-500"
    return "bg-orange-500"
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4" />
          Upcoming Arrivals
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-3">
          {etas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming arrivals</p>
          ) : (
            etas.map((eta) => (
              <div
                key={eta.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: eta.route?.color,
                      color: eta.route?.color,
                    }}
                  >
                    {eta.route?.route_number}
                  </Badge>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {eta.stop?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Bus {eta.bus?.bus_number}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {formatTime(eta.predicted_arrival)}
                    </div>
                    <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      <div
                        className={`h-1.5 w-1.5 rounded-full ${getConfidenceColor(eta.confidence)}`}
                      />
                      {Math.round(eta.confidence * 100)}% conf.
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
