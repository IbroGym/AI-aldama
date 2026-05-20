import type { PostgrestError } from "@supabase/supabase-js"

/** Map PostgREST / RLS failures to text suitable for the admin UI. */
export function formatAlertMutationError(
  error: PostgrestError | null,
  notFound?: boolean
): string {
  if (notFound) {
    return (
      "Не удалось сохранить уведомление. Откройте Supabase → SQL Editor, выполните скрипт scripts/setup-kiosk-alerts.sql " +
      "(один раз). В таблице profiles у вашего пользователя должна быть роль admin или operator."
    )
  }
  if (!error) return "Unknown error"

  const msg = error.message ?? ""
  if (
    error.code === "PGRST116" ||
    /cannot coerce the result to a single json object/i.test(msg)
  ) {
    return formatAlertMutationError(null, true)
  }
  if (error.code === "42501" || /permission denied|row-level security/i.test(msg)) {
    return formatAlertMutationError(null, true)
  }
  return msg
}
