import type { Alert } from "@/lib/types/database"

const ALERT_TYPES: Alert["alert_type"][] = [
  "delay",
  "cancellation",
  "reroute",
  "maintenance",
  "info",
]

const SEVERITIES: Alert["severity"][] = ["low", "medium", "high", "critical"]

export type AlertPayloadInput = {
  alert_type?: string
  severity?: string
  title?: string
  message?: string
  is_active?: boolean
  starts_at?: string | null
  ends_at?: string | null
}

export type AlertWritePayload = Pick<
  Alert,
  "alert_type" | "severity" | "title" | "message" | "is_active" | "starts_at" | "ends_at"
>

export function parseAlertPayload(body: AlertPayloadInput): {
  data?: AlertWritePayload
  error?: string
} {
  const alert_type = body.alert_type as Alert["alert_type"] | undefined
  const severity = body.severity as Alert["severity"] | undefined
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const message = typeof body.message === "string" ? body.message.trim() : ""

  if (!alert_type || !ALERT_TYPES.includes(alert_type)) {
    return { error: "Invalid alert_type" }
  }
  if (!severity || !SEVERITIES.includes(severity)) {
    return { error: "Invalid severity" }
  }
  if (title.length < 2 || title.length > 255) {
    return { error: "Title must be 2–255 characters" }
  }
  if (message.length < 2) {
    return { error: "Message is required" }
  }

  const starts_at =
    body.starts_at && body.starts_at.length > 0
      ? new Date(body.starts_at).toISOString()
      : new Date().toISOString()

  let ends_at: string | null = null
  if (body.ends_at && body.ends_at.length > 0) {
    ends_at = new Date(body.ends_at).toISOString()
    if (Number.isNaN(Date.parse(ends_at))) {
      return { error: "Invalid ends_at" }
    }
    if (new Date(ends_at) <= new Date(starts_at)) {
      return { error: "End time must be after start time" }
    }
  }

  return {
    data: {
      alert_type,
      severity,
      title,
      message,
      is_active: body.is_active !== false,
      starts_at,
      ends_at,
    },
  }
}
