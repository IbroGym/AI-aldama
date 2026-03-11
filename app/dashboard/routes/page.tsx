import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Route, MapPin, Bus } from "lucide-react"

export default async function RoutesPage() {
  const supabase = await createClient()

  const { data: routes } = await supabase
    .from("bus_routes")
    .select("*")
    .order("route_number")

  const { data: routeStops } = await supabase
    .from("route_stops")
    .select("*, stop:bus_stops(*)")
    .order("stop_sequence")

  const { data: buses } = await supabase
    .from("buses")
    .select("*")
    .eq("is_active", true)

  // Group stops by route
  const stopsByRoute = routeStops?.reduce((acc, rs) => {
    if (!acc[rs.route_id]) acc[rs.route_id] = []
    acc[rs.route_id].push(rs)
    return acc
  }, {} as Record<string, typeof routeStops>)

  // Count buses by route
  const busesByRoute = buses?.reduce((acc, bus) => {
    if (bus.current_route_id) {
      acc[bus.current_route_id] = (acc[bus.current_route_id] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex flex-col">
      <DashboardHeader title="Routes" description="Manage bus routes and schedules" />

      <main className="flex-1 space-y-4 p-6">
        {routes?.map((route) => {
          const stops = stopsByRoute?.[route.id] || []
          const busCount = busesByRoute?.[route.id] || 0

          return (
            <Card key={route.id}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
                      style={{ backgroundColor: route.color }}
                    >
                      {route.route_number}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{route.route_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {stops.length} stops
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Bus className="h-4 w-4" />
                      {busCount} active
                    </div>
                    <Badge variant={route.is_active ? "default" : "secondary"}>
                      {route.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  {stops.map((rs, index) => (
                    <div key={rs.id} className="flex items-center">
                      <div className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-foreground">{rs.stop?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          +{rs.scheduled_time_offset}m
                        </span>
                      </div>
                      {index < stops.length - 1 && (
                        <div className="mx-1 h-px w-4 bg-border" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </main>
    </div>
  )
}
