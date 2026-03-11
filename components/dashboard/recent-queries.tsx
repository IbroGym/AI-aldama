import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AiQueryLog } from "@/lib/types/database"
import { MessageSquare, CheckCircle, XCircle } from "lucide-react"

interface RecentQueriesProps {
  queries: AiQueryLog[]
}

export function RecentQueries({ queries }: RecentQueriesProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.round(diffMs / 60000)
    
    if (diffMins < 1) return "Just now"
    if (diffMins === 1) return "1 min ago"
    if (diffMins < 60) return `${diffMins} mins ago`
    if (diffMins < 1440) return `${Math.round(diffMins / 60)} hrs ago`
    
    return date.toLocaleDateString()
  }

  const getIntentColor = (intent: string | null) => {
    switch (intent) {
      case "eta_query": return "bg-primary/10 text-primary"
      case "route_query": return "bg-accent/10 text-accent"
      case "schedule_query": return "bg-chart-3/10 text-chart-3"
      case "service_status": return "bg-chart-4/10 text-chart-4"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const formatIntent = (intent: string | null) => {
    if (!intent) return "Unknown"
    return intent.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ")
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="h-4 w-4" />
          Recent AI Queries
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {queries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent queries</p>
          ) : (
            queries.map((query) => (
              <div key={query.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {query.question}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {query.answer || "No response"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {query.was_successful ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className={getIntentColor(query.intent)}>
                    {formatIntent(query.intent)}
                  </Badge>
                  {query.stop && (
                    <span className="text-muted-foreground">
                      at {query.stop.name}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {formatTime(query.created_at)}
                  </span>
                  {query.response_time_ms && (
                    <span className="text-muted-foreground">
                      {query.response_time_ms}ms
                    </span>
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
