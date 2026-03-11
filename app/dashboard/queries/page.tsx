import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MessageSquare, CheckCircle, XCircle, TrendingUp } from "lucide-react"

export default async function QueriesPage() {
  const supabase = await createClient()

  const { data: queries } = await supabase
    .from("ai_query_logs")
    .select("*, stop:bus_stops(name)")
    .order("created_at", { ascending: false })
    .limit(50)

  // Calculate stats
  const totalQueries = queries?.length || 0
  const successfulQueries = queries?.filter((q) => q.was_successful).length || 0
  const avgResponseTime = queries?.reduce((acc, q) => acc + (q.response_time_ms || 0), 0) / totalQueries || 0

  // Group by intent
  const intentCounts = queries?.reduce((acc, q) => {
    const intent = q.intent || "unknown"
    acc[intent] = (acc[intent] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
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
    <div className="flex flex-col">
      <DashboardHeader title="AI Queries" description="Monitor passenger questions and AI responses" />

      <main className="flex-1 space-y-6 p-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalQueries}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {totalQueries ? Math.round((successfulQueries / totalQueries) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{Math.round(avgResponseTime)}ms</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top Intent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {Object.entries(intentCounts || {}).sort((a, b) => b[1] - a[1])[0]?.[0]?.replace("_", " ") || "N/A"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Intent breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Query Intents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(intentCounts || {}).map(([intent, count]) => (
                <div key={intent} className="flex items-center gap-2">
                  <Badge className={getIntentColor(intent)}>
                    {formatIntent(intent)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Query log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Recent Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Stop</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries?.map((query) => (
                  <TableRow key={query.id}>
                    <TableCell>
                      {query.was_successful ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium text-foreground">
                      {query.question}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getIntentColor(query.intent)}>
                        {formatIntent(query.intent)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {query.stop?.name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {query.response_time_ms}ms
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(query.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
