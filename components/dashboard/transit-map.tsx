"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const TransitMapView = dynamic(
  () =>
    import("./transit-map-view").then((m) => ({ default: m.TransitMapView })),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="h-[min(70vh,560px)] w-full rounded-lg" />
    ),
  },
)

export function TransitMap() {
  return <TransitMapView />
}
