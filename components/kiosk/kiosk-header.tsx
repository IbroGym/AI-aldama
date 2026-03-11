import { Bus, MapPin } from "lucide-react"
import Link from "next/link"

interface KioskHeaderProps {
  stopName: string
  currentTime: Date
  stopCode?: string
}

export function KioskHeader({ stopName, currentTime, stopCode }: KioskHeaderProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { 
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <header className="border-b border-white/10 bg-[#0d1424]">
      <div className="flex items-center justify-between px-4 py-4 lg:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Bus className="h-7 w-7 text-white" />
          </div>
          <div>
            <div className="text-lg font-bold text-white">Smart Bus</div>
            <div className="text-sm text-white/60">Transit System</div>
          </div>
        </Link>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            <div>
              <div className="font-semibold text-white">{stopName}</div>
              {stopCode && (
                <div className="text-xs text-white/60">Stop #{stopCode}</div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums text-white">
              {formatTime(currentTime)}
            </div>
            <div className="text-sm text-white/60">{formatDate(currentTime)}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
