import { NextResponse } from "next/server"
import { deleteAlertRow, updateAlertRow } from "@/lib/alerts/alerts-db"
import {
  parseAlertPayload,
  type AlertPayloadInput,
} from "@/lib/alerts/validate-alert-payload"
import {
  canDeleteAlerts,
  canManageAlerts,
  getDashboardSession,
} from "@/lib/auth/dashboard-role"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const { user, role } = await getDashboardSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canManageAlerts(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: AlertPayloadInput
  try {
    body = (await request.json()) as AlertPayloadInput
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parseAlertPayload(body)
  if (parsed.error || !parsed.data) {
    return NextResponse.json({ error: parsed.error ?? "Invalid payload" }, { status: 400 })
  }

  const serviceDb = createServiceRoleClient()
  const { alert, error } = await updateAlertRow(
    supabase,
    id,
    parsed.data,
    serviceDb ?? undefined
  )

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ alert })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const { user, role } = await getDashboardSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canDeleteAlerts(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const serviceDb = createServiceRoleClient()
  const { ok, error } = await deleteAlertRow(supabase, id, serviceDb ?? undefined)

  if (error || !ok) {
    return NextResponse.json({ error: error ?? "Delete failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
