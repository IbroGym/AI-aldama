import {
  getAllowedSimulationSpeeds,
  getSimulationClockSnapshot,
  isAllowedSimulationSpeed,
  setSimulationSpeedMultiplier,
} from "@/lib/vehicles/sim-clock"
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

function assertDevelopment() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return null
}

export async function GET() {
  const denied = assertDevelopment()
  if (denied) return denied

  const clock = getSimulationClockSnapshot()
  console.info(
    `[sim-speed] read via GET multiplier=${clock.simulation_speed_multiplier}`,
  )
  return NextResponse.json({
    simulation_speed_multiplier: clock.simulation_speed_multiplier,
    allowed_multipliers: getAllowedSimulationSpeeds(),
    server_time_ms: clock.real_now_ms,
    sim_time_ms: clock.sim_now_ms,
  })
}

export async function POST(req: NextRequest) {
  const denied = assertDevelopment()
  if (denied) return denied

  let body: { multiplier?: number } = {}
  try {
    body = (await req.json()) as { multiplier?: number }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const raw = Number(body.multiplier)
  if (!Number.isFinite(raw) || !isAllowedSimulationSpeed(raw)) {
    return NextResponse.json(
      {
        error: "Invalid multiplier",
        allowed_multipliers: getAllowedSimulationSpeeds(),
      },
      { status: 400 }
    )
  }

  const updated = setSimulationSpeedMultiplier(raw)
  console.info(
    `[sim-speed] changed multiplier=${updated.simulation_speed_multiplier}`,
  )
  return NextResponse.json({
    simulation_speed_multiplier: updated.simulation_speed_multiplier,
    allowed_multipliers: getAllowedSimulationSpeeds(),
    server_time_ms: updated.real_now_ms,
    sim_time_ms: updated.sim_now_ms,
  })
}
