import { createClientOrNull } from "@/lib/supabase/server"
import { getEtaPayload } from "@/lib/vehicles/vehicle-service"
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/eta?stop_id=...
 * Sorted arrivals at the stop — same simulation snapshot as /api/vehicles.
 */
export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams
  const stopId = searchParams.get("stop_id")
  const debug = searchParams.get("debug") === "1"
  if (!stopId) {
    return NextResponse.json(
      { error: "stop_id is required" },
      { status: 400 }
    )
  }

  const supabase = await createClientOrNull()
  const payload = await getEtaPayload(supabase, stopId, debug)
  return NextResponse.json(payload)
}
