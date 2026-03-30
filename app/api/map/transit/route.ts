import { createClientOrNull } from "@/lib/supabase/server"
import { getTransitContext } from "@/lib/vehicles/vehicle-service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Static-ish network: stops + route polylines for the map.
 * GTFS static shapes can extend this payload later without breaking clients.
 */
export async function GET() {
  const supabase = await createClientOrNull()
  const ctx = await getTransitContext(supabase)
  return NextResponse.json(ctx)
}
