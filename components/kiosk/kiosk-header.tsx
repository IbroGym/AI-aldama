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
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-4 lg:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700">
            <Bus className="h-7 w-7" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">Smart Bus</div>
            <div className="text-sm text-slate-500">Transit System</div>
          </div>
        </Link>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            <div>
              <div className="font-semibold text-slate-900">{stopName}</div>
              {stopCode && (
                <div className="text-xs text-slate-500">Stop #{stopCode}</div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums text-slate-900">
              {formatTime(currentTime)}
            </div>
            <div className="text-sm text-slate-500">{formatDate(currentTime)}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
