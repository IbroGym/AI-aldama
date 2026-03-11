import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard/header"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { BusMap } from "@/components/dashboard/bus-map"
import { RecentQueries } from "@/components/dashboard/recent-queries"
import { ActiveAlerts } from "@/components/dashboard/active-alerts"
import { EtaList } from "@/components/dashboard/eta-list"

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: buses },
    { data: stops },
    { data: alerts },
    { data: queries },
    { data: etas },
    { data: positions },
  ] = await Promise.all([
    supabase.from("buses").select("*, current_route:bus_routes(*)"),
    supabase.from("bus_stops").select("*").eq("is_active", true),
    supabase.from("alerts").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("ai_query_logs").select("*, stop:bus_stops(name)").order("created_at", { ascending: false }).limit(10),
    supabase.from("eta_predictions").select("*, bus:buses(*), stop:bus_stops(*), route:bus_routes(*)").order("predicted_arrival", { ascending: true }).limit(10),
    supabase.from("bus_positions").select("*, bus:buses(*, current_route:bus_routes(*))").order("recorded_at", { ascending: false }),
  ])

  const activeBuses = buses?.filter((b) => b.is_active) || []
  const latestPositions = positions?.reduce((acc, pos) => {
    if (!acc[pos.bus_id] || new Date(pos.recorded_at) > new Date(acc[pos.bus_id].recorded_at)) {
      acc[pos.bus_id] = pos
    }
    return acc
  }, {} as Record<string, typeof positions[0]>)

  const stats = {
    totalBuses: buses?.length || 0,
    activeBuses: activeBuses.length,
    totalStops: stops?.length || 0,
    activeAlerts: alerts?.length || 0,
    todayQueries: queries?.length || 0,
  }

  return (
    <div className="flex flex-col">
      <DashboardHeader title="Dashboard Overview" />
      
      <main className="flex-1 space-y-6 p-6">
        <StatsCards stats={stats} />
        
        <div className="grid gap-6 lg:grid-cols-2">
          <BusMap 
            positions={Object.values(latestPositions || {})} 
            stops={stops || []} 
          />
          <EtaList etas={etas || []} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentQueries queries={queries || []} />
          <ActiveAlerts alerts={alerts || []} />
        </div>
      </main>
    </div>
  )
}
