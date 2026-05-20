"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { Alert } from "@/lib/types/database"
import {
  Bell,
  AlertTriangle,
  Info,
  Clock,
  Wrench,
  CheckCircle,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type AlertFormState = {
  alert_type: Alert["alert_type"]
  severity: Alert["severity"]
  title: string
  message: string
  is_active: boolean
  starts_at: string
  ends_at: string
}

interface AlertsManagerProps {
  initialAlerts: Alert[]
  canManage: boolean
  canDelete: boolean
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultFormState(alert?: Alert): AlertFormState {
  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return {
    alert_type: alert?.alert_type ?? "info",
    severity: alert?.severity ?? "medium",
    title: alert?.title ?? "",
    message: alert?.message ?? "",
    is_active: alert?.is_active ?? true,
    starts_at: toDatetimeLocalValue(alert?.starts_at) || toDatetimeLocalValue(now.toISOString()),
    ends_at: toDatetimeLocalValue(alert?.ends_at) || toDatetimeLocalValue(weekLater.toISOString()),
  }
}

function formToPayload(form: AlertFormState) {
  return {
    alert_type: form.alert_type,
    severity: form.severity,
    title: form.title,
    message: form.message,
    is_active: form.is_active,
    starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
    ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
  }
}

export function AlertsManager({
  initialAlerts,
  canManage,
  canDelete,
}: AlertsManagerProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AlertFormState>(() => defaultFormState())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Alert | null>(null)
  const [deleting, setDeleting] = useState(false)

  const activeAlerts = useMemo(
    () => initialAlerts.filter((a) => a.is_active),
    [initialAlerts]
  )
  const inactiveAlerts = useMemo(
    () => initialAlerts.filter((a) => !a.is_active),
    [initialAlerts]
  )

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "delay":
        return <Clock className="h-5 w-5" />
      case "cancellation":
      case "reroute":
        return <AlertTriangle className="h-5 w-5" />
      case "maintenance":
        return <Wrench className="h-5 w-5" />
      default:
        return <Info className="h-5 w-5" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-destructive text-destructive-foreground"
      case "high":
        return "bg-destructive/80 text-destructive-foreground"
      case "medium":
        return "bg-warning text-warning-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString()

  const openCreate = () => {
    setEditingId(null)
    setForm(defaultFormState())
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (alert: Alert) => {
    setEditingId(alert.id)
    setForm(defaultFormState(alert))
    setFormError(null)
    setDialogOpen(true)
  }

  async function saveAlert() {
    setSaving(true)
    setFormError(null)
    const payload = formToPayload(form)
    const url = editingId
      ? `/api/dashboard/alerts/${editingId}`
      : "/api/dashboard/alerts"
    const method = editingId ? "PATCH" : "POST"

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setFormError(data.error ?? t("dashboard.alerts.saveFailed"))
        return
      }
      setDialogOpen(false)
      router.refresh()
    } catch {
      setFormError(t("dashboard.alerts.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(alert: Alert) {
    if (!canManage) return
    await fetch(`/api/dashboard/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        is_active: !alert.is_active,
        starts_at: alert.starts_at,
        ends_at: alert.ends_at,
      }),
    })
    router.refresh()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/dashboard/alerts/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setDeleteTarget(null)
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  const alertTypeLabel = (type: Alert["alert_type"]) =>
    t(`dashboard.alerts.type.${type}`, type)

  const severityLabel = (severity: Alert["severity"]) =>
    t(`dashboard.alerts.severity.${severity}`, severity)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6">
        {canManage ? (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("dashboard.alerts.create")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t("dashboard.alerts.viewerHint")}</p>
        )}
      </div>

      <main className="flex-1 space-y-6 p-6 pt-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.activeAlerts")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{activeAlerts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.critical")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {activeAlerts.filter((a) => a.severity === "critical").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.delays")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {activeAlerts.filter((a) => a.alert_type === "delay").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("dashboard.maintenance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {activeAlerts.filter((a) => a.alert_type === "maintenance").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              {t("dashboard.activeAlerts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAlerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {t("dashboard.noActiveAlerts")}
              </div>
            ) : (
              <div className="space-y-4">
                {activeAlerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    canManage={canManage}
                    canDelete={canDelete}
                    getAlertIcon={getAlertIcon}
                    getSeverityColor={getSeverityColor}
                    formatDate={formatDate}
                    alertTypeLabel={alertTypeLabel}
                    severityLabel={severityLabel}
                    onEdit={() => openEdit(alert)}
                    onDelete={() => setDeleteTarget(alert)}
                    onToggleActive={() => toggleActive(alert)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {inactiveAlerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                {t("dashboard.pastAlerts")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inactiveAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground">{getAlertIcon(alert.alert_type)}</div>
                      <div>
                        <span className="font-medium text-muted-foreground">{alert.title}</span>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(alert.starts_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{t("dashboard.resolved")}</Badge>
                      {canManage && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(alert)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteTarget(alert)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("dashboard.alerts.editTitle") : t("dashboard.alerts.createTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="alert-title">{t("dashboard.alerts.fieldTitle")}</Label>
              <Input
                id="alert-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t("dashboard.alerts.titlePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alert-message">{t("dashboard.alerts.fieldMessage")}</Label>
              <Textarea
                id="alert-message"
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder={t("dashboard.alerts.messagePlaceholder")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("dashboard.alerts.fieldType")}</Label>
                <Select
                  value={form.alert_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, alert_type: v as Alert["alert_type"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["delay", "cancellation", "reroute", "maintenance", "info"] as const).map(
                      (type) => (
                        <SelectItem key={type} value={type}>
                          {alertTypeLabel(type)}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("dashboard.alerts.fieldSeverity")}</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, severity: v as Alert["severity"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["low", "medium", "high", "critical"] as const).map((sev) => (
                      <SelectItem key={sev} value={sev}>
                        {severityLabel(sev)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="alert-starts">{t("dashboard.started")}</Label>
                <Input
                  id="alert-starts"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="alert-ends">{t("dashboard.ends")}</Label>
                <Input
                  id="alert-ends"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="alert-active">{t("dashboard.alerts.fieldActive")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.alerts.activeHint")}
                </p>
              </div>
              <Switch
                id="alert-active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_active: checked }))
                }
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t("dashboard.alerts.cancel")}
            </Button>
            <Button onClick={saveAlert} disabled={saving}>
              {saving ? t("dashboard.alerts.saving") : t("dashboard.alerts.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.alerts.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title
                ? `${t("dashboard.alerts.deleteDescription")} «${deleteTarget.title}»`
                : t("dashboard.alerts.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("dashboard.alerts.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("dashboard.alerts.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AlertRow({
  alert,
  canManage,
  canDelete,
  getAlertIcon,
  getSeverityColor,
  formatDate,
  alertTypeLabel,
  severityLabel,
  onEdit,
  onDelete,
  onToggleActive,
  t,
}: {
  alert: Alert
  canManage: boolean
  canDelete: boolean
  getAlertIcon: (type: string) => React.ReactNode
  getSeverityColor: (severity: string) => string
  formatDate: (dateStr: string) => string
  alertTypeLabel: (type: Alert["alert_type"]) => string
  severityLabel: (severity: Alert["severity"]) => string
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className={`rounded-lg p-2 ${getSeverityColor(alert.severity)}`}>
            {getAlertIcon(alert.alert_type)}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-foreground">{alert.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("dashboard.started")}: {formatDate(alert.starts_at)}
              </span>
              {alert.ends_at && (
                <>
                  <span>•</span>
                  <span>
                    {t("dashboard.ends")}: {formatDate(alert.ends_at)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline" className="capitalize">
              {alertTypeLabel(alert.alert_type)}
            </Badge>
            <Badge className={getSeverityColor(alert.severity)}>
              {severityLabel(alert.severity)}
            </Badge>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={alert.is_active} onCheckedChange={onToggleActive} />
                <span>{t("dashboard.alerts.onKiosk")}</span>
              </div>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {canDelete && (
                <Button variant="outline" size="sm" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
