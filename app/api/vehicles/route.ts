import { createClientOrNull } from "@/lib/supabase/server"
import { getVehiclesPayload } from "@/lib/vehicles/vehicle-service"
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/vehicles
 * Query:
 * - stop_id: optional bus_stops.id — focus stop (ETAs + route highlight)
 * - filter=stop: when stop_id is set, return only vehicles on routes serving that stop
 *
 * Future: swap body of getVehiclesPayload for GTFS-Realtime VehiclePositions.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const stopId = searchParams.get("stop_id")
  const filter = searchParams.get("filter")
  const debug = searchParams.get("debug") === "1"

  const supabase = await createClientOrNull()
  const payload = await getVehiclesPayload(supabase, {
    focus_stop_id: stopId || null,
    filter_stop_only: filter === "stop" && !!stopId,
    include_debug: debug,
  })
  console.info(
    `[sim-speed] /api/vehicles multiplier=${payload.simulation_speed_multiplier}`,
  )

  return NextResponse.json(payload)
}
