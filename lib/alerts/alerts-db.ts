import type { SupabaseClient } from "@supabase/supabase-js"
import type { Alert } from "@/lib/types/database"
import { formatAlertMutationError } from "@/lib/alerts/supabase-alert-errors"
import type { AlertWritePayload } from "@/lib/alerts/validate-alert-payload"

function rpcPayload(id: string | null, payload: AlertWritePayload) {
  return {
    p_id: id,
    p_alert_type: payload.alert_type,
    p_severity: payload.severity,
    p_title: payload.title,
    p_message: payload.message,
    p_is_active: payload.is_active,
    p_starts_at: payload.starts_at,
    p_ends_at: payload.ends_at,
  }
}

async function saveViaRpc(
  db: SupabaseClient,
  id: string | null,
  payload: AlertWritePayload
): Promise<{ alert?: Alert; error?: string; rpcMissing?: boolean }> {
  const { data, error } = await db.rpc("save_kiosk_alert", rpcPayload(id, payload))

  if (error) {
    if (
      error.code === "PGRST202" ||
      /save_kiosk_alert/i.test(error.message ?? "") ||
      /function.*does not exist/i.test(error.message ?? "")
    ) {
      return { rpcMissing: true }
    }
    const msg = error.message ?? ""
    if (/Forbidden/i.test(msg)) {
      return {
        error:
          "Недостаточно прав: в таблице profiles у вашего пользователя должна быть роль admin или operator.",
      }
    }
    return { error: formatAlertMutationError(error) }
  }

  if (!data) {
    return { error: formatAlertMutationError(null, true) }
  }

  return { alert: data as Alert }
}

async function saveViaTable(
  db: SupabaseClient,
  id: string | null,
  payload: AlertWritePayload
): Promise<{ alert?: Alert; error?: string }> {
  if (id === null) {
    const { data, error } = await db.from("alerts").insert(payload).select("*").maybeSingle()
    if (error) return { error: formatAlertMutationError(error) }
    if (!data) return { error: formatAlertMutationError(null, true) }
    return { alert: data as Alert }
  }

  const { data, error } = await db
    .from("alerts")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) return { error: formatAlertMutationError(error) }
  if (!data) return { error: formatAlertMutationError(null, true) }
  return { alert: data as Alert }
}

export async function insertAlertRow(
  db: SupabaseClient,
  payload: AlertWritePayload,
  fallbackDb?: SupabaseClient
): Promise<{ alert?: Alert; error?: string }> {
  const rpc = await saveViaRpc(db, null, payload)
  if (rpc.alert) return rpc
  if (!rpc.rpcMissing) return { error: rpc.error }

  const tableDb = fallbackDb ?? db
  return saveViaTable(tableDb, null, payload)
}

export async function updateAlertRow(
  db: SupabaseClient,
  id: string,
  payload: AlertWritePayload,
  fallbackDb?: SupabaseClient
): Promise<{ alert?: Alert; error?: string }> {
  const rpc = await saveViaRpc(db, id, payload)
  if (rpc.alert) return rpc
  if (!rpc.rpcMissing) return { error: rpc.error }

  const tableDb = fallbackDb ?? db
  return saveViaTable(tableDb, id, payload)
}

export async function deleteAlertRow(
  db: SupabaseClient,
  id: string,
  fallbackDb?: SupabaseClient
): Promise<{ ok?: boolean; error?: string }> {
  const { data, error } = await db.rpc("delete_kiosk_alert", { p_id: id })

  if (!error) {
    if (data === true) return { ok: true }
    return { error: "Alert not found" }
  }

  if (
    error.code === "PGRST202" ||
    /delete_kiosk_alert/i.test(error.message ?? "") ||
    /function.*does not exist/i.test(error.message ?? "")
  ) {
    const tableDb = fallbackDb ?? db
    const { data: row, error: delErr } = await tableDb
      .from("alerts")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle()
    if (delErr) return { error: formatAlertMutationError(delErr) }
    if (!row) return { error: formatAlertMutationError(null, true) }
    return { ok: true }
  }

  if (/Forbidden/i.test(error.message ?? "")) {
    return { error: "Удаление доступно только роли admin." }
  }
  return { error: formatAlertMutationError(error) }
}
