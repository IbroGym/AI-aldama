"use client"

import { useMemo, useState } from "react"
import { Ambulance, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
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

type EmergencyKind = "police" | "ambulance"

interface KioskEmergencyActionsProps {
  stopName?: string
}

export function KioskEmergencyActions({ stopName }: KioskEmergencyActionsProps) {
  const [open, setOpen] = useState<EmergencyKind | null>(null)

  const copy = useMemo(() => {
    const place = stopName ? ` to ${stopName}` : " to this bus stop"
    return {
      police: {
        title: "Call Police (SOS)",
        description: `When you click “Call police”, the police will arrive${place} in 3 minutes.`,
        confirm: "Call police",
      },
      ambulance: {
        title: "Call ambulance",
        description: `When you click “Call ambulance”, the ambulance will arrive within 9 minutes${place}.`,
        confirm: "Call ambulance",
      },
      decline: "Decline",
    }
  }, [stopName])

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Emergency</div>
          <div className="mt-0.5 text-xs text-slate-500">SOS or ambulance</div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setOpen("police")}
            className="h-10 w-10 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
            aria-label="SOS - call police"
            title="SOS - Police"
          >
            <ShieldAlert className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setOpen("ambulance")}
            className="h-10 w-10 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            aria-label="Call ambulance"
            title="Ambulance"
          >
            <Ambulance className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={open === "police"} onOpenChange={(v) => setOpen(v ? "police" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.police.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.police.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.decline}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => setOpen(null)}
            >
              {copy.police.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={open === "ambulance"} onOpenChange={(v) => setOpen(v ? "ambulance" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.ambulance.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.ambulance.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.decline}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setOpen(null)}
            >
              {copy.ambulance.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

