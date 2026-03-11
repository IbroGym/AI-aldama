import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Monitor, Home } from "lucide-react"

export default async function StopsPage() {
  const supabase = await createClient()

  const { data: stops } = await supabase
    .from("bus_stops")
    .select("*")
    .order("zone")
    .order("name")

  // Group stops by zone
  const stopsByZone = stops?.reduce((acc, stop) => {
    const zone = stop.zone || "Other"
    if (!acc[zone]) acc[zone] = []
    acc[zone].push(stop)
    return acc
  }, {} as Record<string, typeof stops>)

  return (
    <div className="flex flex-col">
      <DashboardHeader title="Bus Stops" description="Manage all bus stops in the network" />

      <main className="flex-1 space-y-6 p-6">
        {Object.entries(stopsByZone || {}).map(([zone, zoneStops]) => (
          <div key={zone}>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Home className="h-5 w-5 text-muted-foreground" />
              {zone}
              <Badge variant="secondary" className="ml-2">
                {zoneStops?.length} stops
              </Badge>
            </h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {zoneStops?.map((stop) => (
                <Card key={stop.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapPin className="h-4 w-4" />
                        {stop.name}
                      </CardTitle>
                      <Badge variant={stop.is_active ? "default" : "secondary"}>
                        {stop.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stop Code</span>
                      <span className="font-mono font-medium text-foreground">{stop.stop_code}</span>
                    </div>
                    {stop.address && (
                      <div className="text-sm text-muted-foreground">
                        {stop.address}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs">
                      {stop.has_shelter && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Shelter
                        </span>
                      )}
                      {stop.has_display && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Monitor className="h-3 w-3" />
                          Display
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
