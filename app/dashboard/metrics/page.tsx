"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Clock, Zap, Server } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

interface Metric {
  id: string
  metric_name: string
  metric_value: number
  metric_unit: string
  tags: Record<string, string> | null
  recorded_at: string
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchMetrics = async () => {
      const { data } = await supabase
        .from("system_metrics")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(200)

      setMetrics(data || [])
      setLoading(false)
    }

    fetchMetrics()
  }, [supabase])

  // Group metrics by name
  const metricsByName = metrics.reduce((acc, metric) => {
    if (!acc[metric.metric_name]) acc[metric.metric_name] = []
    acc[metric.metric_name].push(metric)
    return acc
  }, {} as Record<string, Metric[]>)

  // Prepare chart data for response times
  const responseTimeData = metricsByName["api_response_time"]
    ?.slice(0, 20)
    .reverse()
    .map((m, i) => ({
      name: i + 1,
      value: Math.round(m.metric_value),
      endpoint: m.tags?.endpoint || "unknown",
    })) || []

  // Get latest values for each metric
  const latestMetrics = Object.entries(metricsByName).reduce((acc, [name, values]) => {
    acc[name] = values[0]
    return acc
  }, {} as Record<string, Metric>)

  // Prepare bar chart data for metric types
  const barChartData = Object.entries(metricsByName).map(([name, values]) => ({
    name: name.replace(/_/g, " "),
    average: Math.round(values.reduce((sum, v) => sum + v.metric_value, 0) / values.length),
    latest: Math.round(values[0]?.metric_value || 0),
  }))

  if (loading) {
    return (
      <div className="flex flex-col">
        <DashboardHeader title="System Metrics" description="Real-time system performance monitoring" />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="text-muted-foreground">Loading metrics...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <DashboardHeader title="System Metrics" description="Real-time system performance monitoring" />

      <main className="flex-1 space-y-6 p-6">
        {/* Current metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">API Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {Math.round(latestMetrics["api_response_time"]?.metric_value || 0)}ms
              </div>
              <p className="text-xs text-muted-foreground">
                {latestMetrics["api_response_time"]?.tags?.endpoint || "average"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Buses</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {Math.round(latestMetrics["active_buses"]?.metric_value || 0)}
              </div>
              <p className="text-xs text-muted-foreground">currently tracking</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Daily AI Queries</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {Math.round(latestMetrics["daily_queries"]?.metric_value || 0)}
              </div>
              <p className="text-xs text-muted-foreground">questions answered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Uptime</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {(latestMetrics["system_uptime"]?.metric_value || 0).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">last 24 hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Response Time Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metrics Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="latest" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed metrics table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Metric Values</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(metricsByName).map(([name, values]) => (
                <div key={name} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                  <div>
                    <div className="font-medium text-foreground capitalize">
                      {name.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {values[0]?.tags?.endpoint || values[0]?.tags?.service || "system"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-foreground">
                      {values[0]?.metric_value.toFixed(1)} {values[0]?.metric_unit}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      avg: {(values.reduce((sum, v) => sum + v.metric_value, 0) / values.length).toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
