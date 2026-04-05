/**
 * Kiosk route titles from DB are sometimes stored as a full loop label, e.g.
 * "Origin – Terminal – Origin". For arrivals we only show origin → terminal.
 */
export function formatKioskRouteLineName(routeName: string): string {
  const t = routeName.trim()
  if (!t) return t
  const parts = t
    .split(/\s*[–—]\s*|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length >= 3 && parts[0] === parts[parts.length - 1]) {
    return parts.slice(0, -1).join(" – ")
  }
  return t
}
