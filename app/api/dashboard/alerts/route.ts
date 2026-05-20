import { NextResponse } from "next/server"
import { insertAlertRow } from "@/lib/alerts/alerts-db"
import { parseAlertPayload } from "@/lib/alerts/validate-alert-payload"
import {
  canManageAlerts,
  getDashboardSession,
} from "@/lib/auth/dashboard-role"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, role } = await getDashboardSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canManageAlerts(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parseAlertPayload(body as Record<string, unknown>)
  if (parsed.error || !parsed.data) {
    return NextResponse.json({ error: parsed.error ?? "Invalid payload" }, { status: 400 })
  }

  const serviceDb = createServiceRoleClient()
  const { alert, error } = await insertAlertRow(supabase, parsed.data, serviceDb ?? undefined)

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ alert }, { status: 201 })
}
